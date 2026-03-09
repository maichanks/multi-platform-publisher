import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import compression from 'compression';
import { ConfigService } from '@nestjs/config';
import { WinstonModule } from 'nest-winston';
import * as winston from 'winston';
import { HttpExceptionFilter } from './modules/common/filters/http-exception.filter';
import { AppModule } from './app.module';

/**
 * Validate required configuration variables on startup
 */
function validateConfiguration(configService: ConfigService) {
  const logger = winston.createLogger({
    level: 'info',
    format: winston.format.simple(),
    transports: [new winston.transports.Console()],
  });

  const platformConfigs = [
    {
      name: 'Twitter',
      required: [
        'TWITTER_CLIENT_ID',
        'TWITTER_CLIENT_SECRET',
        'TWITTER_API_KEY',
        'TWITTER_API_SECRET',
      ],
      optional: ['TWITTER_REDIRECT_URI', 'TWITTER_BEARER_TOKEN'],
    },
    {
      name: 'Reddit',
      required: [
        'REDDIT_CLIENT_ID',
        'REDDIT_CLIENT_SECRET',
      ],
      optional: ['REDDIT_USER_AGENT', 'REDDIT_REDIRECT_URI'],
    },
    {
      name: 'LinkedIn',
      required: [
        'LINKEDIN_CLIENT_ID',
        'LINKEDIN_CLIENT_SECRET',
      ],
      optional: ['LINKEDIN_REDIRECT_URI'],
    },
  ];

  const nodeEnv = configService.get('NODE_ENV', 'development');
  const warnings: string[] = [];

  platformConfigs.forEach(platform => {
    const missingRequired = platform.required.filter(key => !configService.get(key));
    const missingOptional = platform.optional.filter(key => !configService.get(key));

    if (missingRequired.length > 0) {
      logger.error(`[Configuration] ${platform.name} platform: Missing required variables: ${missingRequired.join(', ')}`);
      if (nodeEnv === 'production') {
        throw new Error(`Cannot start: ${platform.name} configuration incomplete. Missing: ${missingRequired.join(', ')}`);
      }
    }

    if (missingOptional.length > 0) {
      warnings.push(`${platform.name}: optional missing: ${missingOptional.join(', ')}`);
    }

    if (missingRequired.length === 0) {
      logger.info(`[Configuration] ${platform.name} platform: Configuration OK`);
    }
  });

  if (warnings.length > 0) {
    logger.warn(`[Configuration] Optional variables not set:\n${warnings.join('\n')}`);
  }

  // Check critical app config
  const criticalVars = ['DATABASE_URL', 'REDIS_URL', 'ENCRYPTION_KEY', 'JWT_SECRET'];
  const missingCritical = criticalVars.filter(key => !configService.get(key));

  if (missingCritical.length > 0) {
    logger.error(`[Configuration] Missing critical variables: ${missingCritical.join(', ')}`);
    if (nodeEnv === 'production') {
      throw new Error(`Cannot start: Missing critical configuration: ${missingCritical.join(', ')}`);
    }
  }

  logger.info('[Configuration] Validation complete');
}

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // 安全中间件
  app.use(helmet());

  // 压缩响应
  app.use(compression());

  // 配置服务
  const configService = app.get(ConfigService);

  // 验证配置
  validateConfiguration(configService);

  // 启用 CORS
  const corsOrigins = configService.get('CORS_ORIGIN', 'http://localhost:5173').split(',');
  app.enableCors({
    origin: corsOrigins,
    credentials: true,
  });

  // 信任代理（如果在反向代理后运行）
  if (configService.get('ENABLE_HTTPS', 'false') === 'true') {
    app.set('trust proxy', 1);
  }

  // 全局验证管道
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // 全局异常过滤器
  app.useGlobalFilters(new HttpExceptionFilter());

  // 设置全局前缀
  const apiPrefix = configService.get('API_VERSION', 'v1');
  app.setGlobalPrefix(`api/${apiPrefix}`);

  // 设置端口
  const port = configService.get('PORT', 3000);

  // Swagger API 文档 (仅开发环境)
  if (configService.get('NODE_ENV') !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('Multi-Platform Publisher API')
      .setDescription('多平台内容发布系统 API 文档')
      .setVersion('1.0')
      .addBearerAuth()
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document);
  }

  // 健康检查端点
  app.get('/health', (req, res) => {
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: process.version,
      memory: process.memoryUsage(),
    });
  });

  // 错误处理中间件
  app.use((err: any, req: any, res: any, next: any) => {
    const logger = app.get(WinstonModule);
    logger.error('Unhandled exception:', err);

    const status = err.status || 500;
    const message = err.message || 'Internal server error';

    res.status(status).json({
      success: false,
      error: {
        code: err.code || 'INTERNAL_ERROR',
        message: configService.get('NODE_ENV') === 'production' && status === 500
          ? 'Something went wrong'
          : message,
        ...(configService.get('NODE_ENV') !== 'production' && { stack: err.stack }),
      },
    });
  });

  await app.listen(port, () => {
    const logger = app.get(WinstonModule);
    logger.log(`Application is running on: http://localhost:${port}/`);
    logger.log(`API Documentation: http://localhost:${port}/api/docs`);
  });
}

bootstrap();

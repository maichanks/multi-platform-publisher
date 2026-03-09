import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bull';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './strategies/jwt.strategy';
import { LocalStrategy } from './strategies/local.strategy';
import { GoogleStrategy } from './strategies/google.strategy';
import { GitHubStrategy } from './strategies/github.strategy';
import { UsersModule } from '../users/users.module';
import { RateLimitModule } from '../common/rate-limit.module';

@Module({
  imports: [
    ConfigModule,
    PassportModule,
    JwtModule.registerAsync({
      useFactory: async (configService: ConfigService) => ({
        secret: configService.getJwtSecret(),
        signOptions: {
          expiresIn: configService.get<number>('JWT_EXPIRES_IN', 86400), // 24 hours
        },
      }),
      inject: [ConfigService],
    }),
    BullModule.registerQueueAsync({
      name: 'login-attempts',
      useFactory: () => ({
        concurrency: 5,
      }),
    }),
    RateLimitModule,
    UsersModule,
  ],
  providers: [
    AuthService,
    {
      provide: 'AUTH_STRATEGIES',
      useValue: ['local', 'jwt', 'google', 'github'],
    },
    LocalStrategy,
    JwtStrategy,
    GoogleStrategy,
    GitHubStrategy,
  ],
  controllers: [AuthController],
  exports: [AuthService],
})
export class AuthModule {}

import { Injectable } from '@nestjs/common';
import { ConfigService as NestConfigService } from '@nestjs/config';

@Injectable()
export class ConfigService {
  constructor(private readonly config: NestConfigService) {}

  get<T = any>(key: string, defaultValue?: T): T {
    return this.config.get<T>(key, defaultValue);
  }

  getOrThrow<T = any>(key: string): T {
    const value = this.config.get<T>(key);
    if (value === undefined || value === null) {
      throw new Error(`Missing required environment variable: ${key}`);
    }
    return value;
  }

  has(key: string): boolean {
    return this.config.has(key);
  }

  // Convenience methods for common configs
  getDatabaseUrl(): string {
    return this.getOrThrow<string>('DATABASE_URL');
  }

  getRedisUrl(): string {
    return this.getOrThrow<string>('REDIS_URL');
  }

  getJwtSecret(): string {
    return this.getOrThrow<string>('JWT_SECRET');
  }

  getEncryptionKey(): string {
    return this.getOrThrow<string>('ENCRYPTION_KEY');
  }

  isProduction(): boolean {
    return this.get<string>('NODE_ENV', 'development') === 'production';
  }

  getCorsOrigins(): string[] {
    const origins = this.get<string>('CORS_ORIGIN', 'http://localhost:5173');
    return origins.split(',').map(s => s.trim());
  }

  getOpenRouterApiKey(): string | undefined {
    return this.get<string>('OPENROUTER_API_KEY');
  }

  getSmtpConfig(): {
    host: string;
    port: number;
    secure: boolean;
    user?: string;
    pass?: string;
    from: string;
  } {
    return {
      host: this.getOrThrow<string>('SMTP_HOST'),
      port: this.get<number>('SMTP_PORT', 587),
      secure: this.get<boolean>('SMTP_SECURE', false),
      user: this.get<string>('SMTP_USER'),
      pass: this.get<string>('SMTP_PASS'),
      from: this.getOrThrow<string>('SMTP_FROM'),
    };
  }
}

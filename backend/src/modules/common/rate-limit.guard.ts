import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ThrottlerGuard } from '@nestjs/throttler';
import { ConfigService } from '../config/config.service';

@Injectable()
export class RateLimitGuard extends ThrottlerGuard {
  constructor(
    private reflector: Reflector,
    private configService: ConfigService,
  ) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Check if route is exempt from rate limiting
    const isExempt = this.reflector.get<boolean>('throttler-exempt', context.getHandler());
    if (isExempt) {
      return true;
    }

    // Let parent class handle rate limiting
    return super.canActivate(context);
  }
}

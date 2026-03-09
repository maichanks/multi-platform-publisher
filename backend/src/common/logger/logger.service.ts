import { Injectable, LoggerService as NestLoggerService, Logger } from '@nestjs/common';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import { LoggerService as WinstonLoggerService } from 'nest-winston';

@Injectable()
export class LoggerService implements NestLoggerService {
  constructor(private readonly winston: WinstonLoggerService) {}

  log(message: any, context?: string) {
    this.winston.log(message, { context, level: 'info' });
  }

  error(message: any, trace?: string, context?: string) {
    this.winston.error(message, { context, trace, level: 'error' });
  }

  warn(message: any, context?: string) {
    this.winston.warn(message, { context, level: 'warn' });
  }

  debug(message: any, context?: string) {
    this.winston.debug(message, { context, level: 'debug' });
  }

  verbose(message: any, context?: string) {
    this.winston.verbose(message, { context, level: 'verbose' });
  }
}

import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    if (process.env.MOCK_MODE === 'true' || !process.env.DATABASE_URL) {
      console.log('⚠️ Mock mode: skipping Prisma database connection');
      return;
    }
    await this.$connect();
  }

  async onModuleDestroy() {
    if (process.env.MOCK_MODE === 'true' || !process.env.DATABASE_URL) {
      return;
    }
    await this.$disconnect();
  }
}

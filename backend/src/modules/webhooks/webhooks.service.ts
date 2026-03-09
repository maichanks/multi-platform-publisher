import { Injectable, HttpService } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { LoggerService } from '../../common/logger/logger.service';
import * as crypto from 'crypto';

interface WebhookEvent {
  event: string;
  workspaceId: string;
  timestamp: Date;
  payload: any;
}

@Injectable()
export class WebhooksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly httpService: HttpService,
    private readonly logger: LoggerService,
  ) {}

  async createWebhook(
    workspaceId: string,
    userId: string,
    createDto: {
      url: string;
      events: string[];
      secret?: string;
    },
  ) {
    // Verify membership
    await this.verifyWorkspaceMembership(workspaceId, userId);

    // Generate secret if not provided
    const secret = createDto.secret || crypto.randomBytes(32).toString('hex');

    const webhook = await this.prisma.webhook.create({
      data: {
        workspaceId,
        url: createDto.url,
        secret,
        events: createDto.events,
      },
    });

    this.logger.log(`Webhook created: ${webhook.id} for workspace ${workspaceId}`);

    return webhook;
  }

  async findAll(workspaceId: string, userId: string) {
    await this.verifyWorkspaceMembership(workspaceId, userId);

    const webhooks = await this.prisma.webhook.findMany({
      where: { workspaceId },
      orderBy: { createdAt: 'desc' },
    });

    return webhooks;
  }

  async findOne(workspaceId: string, webhookId: string, userId: string) {
    await this.verifyWorkspaceMembership(workspaceId, userId);

    const webhook = await this.prisma.webhook.findFirst({
      where: { id: webhookId, workspaceId },
    });

    if (!webhook) {
      throw new Error('Webhook not found');
    }

    return webhook;
  }

  async updateWebhook(
    workspaceId: string,
    webhookId: string,
    userId: string,
    updateDto: {
      url?: string;
      events?: string[];
      isActive?: boolean;
      secret?: string;
    },
  ) {
    await this.verifyWorkspaceMembership(workspaceId, userId, ['creator', 'admin']);

    const webhook = await this.prisma.webhook.findFirst({
      where: { id: webhookId, workspaceId },
    });

    if (!webhook) {
      throw new Error('Webhook not found');
    }

    const updated = await this.prisma.webhook.update({
      where: { id: webhookId },
      data: {
        ...(updateDto.url && { url: updateDto.url }),
        ...(updateDto.events && { events: updateDto.events }),
        ...(updateDto.isActive !== undefined && { isActive: updateDto.isActive }),
        ...(updateDto.secret && { secret: updateDto.secret }),
      },
    });

    this.logger.log(`Webhook updated: ${webhookId}`);

    return updated;
  }

  async deleteWebhook(workspaceId: string, webhookId: string, userId: string) {
    await this.verifyWorkspaceMembership(workspaceId, userId, ['creator', 'admin']);

    await this.prisma.webhook.delete({
      where: { id: webhookId, workspaceId },
    });

    this.logger.log(`Webhook deleted: ${webhookId}`);
    return { success: true, message: 'Webhook deleted' };
  }

  async testWebhook(workspaceId: string, webhookId: string, userId: string) {
    await this.verifyWorkspaceMembership(workspaceId, userId);

    const webhook = await this.prisma.webhook.findFirst({
      where: { id: webhookId, workspaceId, isActive: true },
    });

    if (!webhook) {
      throw new Error('Webhook not found or inactive');
    }

    const testEvent: WebhookEvent = {
      event: 'webhook.test',
      workspaceId,
      timestamp: new Date(),
      payload: {
        message: 'This is a test webhook from Multi-Platform Publisher',
        webhookId,
        triggeredBy: userId,
      },
    };

    const result = await this.deliverEvent(webhook, testEvent);

    return { success: true, data: result };
  }

  async dispatchEvent(workspaceId: string, event: string, payload: any) {
    // Find all active webhooks for this workspace that listen to this event
    const webhooks = await this.prisma.webhook.findMany({
      where: {
        workspaceId,
        isActive: true,
        events: { has: event },
      },
    });

    if (webhooks.length === 0) {
      return;
    }

    const eventData: WebhookEvent = {
      event,
      workspaceId,
      timestamp: new Date(),
      payload,
    };

    // Deliver to all matching webhooks (fire and forget, with error handling)
    await Promise.allSettled(
      webhooks.map(webhook => this.deliverEvent(webhook, eventData))
    );
  }

  private async deliverEvent(webhook: any, event: WebhookEvent): Promise<{ success: boolean; status?: number; error?: string }> {
    const payload = JSON.stringify(event);
    const signature = this.generateSignature(payload, webhook.secret);

    try {
      const response = await this.httpService
        .post(webhook.url, event, {
          headers: {
            'Content-Type': 'application/json',
            'X-MPP-Signature': signature,
            'X-MPP-Event': event.event,
            'User-Agent': 'MPP-Webhook/1.0',
          },
          timeout: 10000, // 10 second timeout
          validateStatus: () => true, // Don't throw on non-2xx
        })
        .toPromise();

      const isSuccess = response.status >= 200 && response.status < 300;

      // Update failure count and last sent/failed timestamps
      if (isSuccess) {
        await this.prisma.webhook.update({
          where: { id: webhook.id },
          data: {
            lastSentAt: new Date(),
            failureCount: 0,
          },
        });

        this.logger.log(`Webhook delivered: ${webhook.id} event: ${event.event} status: ${response.status}`);
      } else {
        await this.prisma.webhook.update({
          where: { id: webhook.id },
          data: {
            lastFailureAt: new Date(),
            failureCount: webhook.failureCount + 1,
          },
        });

        this.logger.warn(`Webhook failed: ${webhook.id} event: ${event.event} status: ${response.status}`);
      }

      return {
        success: isSuccess,
        status: response.status,
        error: isSuccess ? undefined : `HTTP ${response.status}`,
      };
    } catch (error: any) {
      await this.prisma.webhook.update({
        where: { id: webhook.id },
        data: {
          lastFailureAt: new Date(),
          failureCount: webhook.failureCount + 1,
        },
      });

      this.logger.error(`Webhook delivery error: ${webhook.id}`, error);

      return {
        success: false,
        error: error.message,
      };
    }
  }

  private generateSignature(payload: string, secret: string): string {
    return crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex');
  }

  private async verifyWorkspaceMembership(
    workspaceId: string,
    userId: string,
    allowedRoles?: string[],
  ): Promise<boolean> {
    const membership = await this.prisma.workspaceMember.findFirst({
      where: { workspaceId, userId },
    });

    if (!membership) {
      throw new Error('Not a workspace member');
    }

    if (allowedRoles && !allowedRoles.includes(membership.role)) {
      throw new Error('Insufficient permissions');
    }

    return true;
  }
}
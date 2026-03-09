import { Injectable, Logger, OnModuleInit, Cron } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { XiaohongshuAdapter } from '../adapters/xiaohongshu.adapter';
import { PlatformCredentials, PublishResult } from '../adapters/platform-adapter.interface';
import { RateLimiterService } from './rate-limiter.service';

export interface BatchPublishJob {
  id: string;
  posts: Array<{
    title: string;
    content: string;
    imageUrls?: string[];
    tags?: string[];
    location?: string;
    privacy?: 'public' | 'private' | 'friends';
  }>;
  credentials: PlatformCredentials;
  scheduledAt?: Date;
  status: 'pending' | 'running' | 'completed' | 'failed';
  results: PublishResult[];
  progress: {
    current: number;
    total: number;
  };
  error?: string;
}

@Injectable()
export class XiaohongshuPublisherService implements OnModuleInit {
  private readonly logger = new Logger(XiaohongshuPublisherService.name);
  private jobQueue: BatchPublishJob[] = [];
  private activeJobs: Map<string, BatchPublishJob> = new Map();
  private isProcessing = false;

  constructor(
    private readonly xiaohongshuAdapter: XiaohongshuAdapter,
    private readonly rateLimiter: RateLimiterService,
    private readonly configService: ConfigService,
  ) {}

  async onModuleInit(): Promise<void> {
    // Start the batch processor if configured
    if (this.configService.get('XHS_AUTO_PROCESS_QUEUE') === 'true') {
      this.startBatchProcessor();
    }
  }

  /**
   * Publish a single post (convenience wrapper)
   */
  async publishSingle(
    credentials: PlatformCredentials,
    post: {
      title: string;
      content: string;
      imageUrls?: string[];
      tags?: string[];
      location?: string;
      privacy?: 'public' | 'private' | 'friends';
    },
  ): Promise<PublishResult> {
    this.logger.log('Publishing single post', { title: post.title?.substring(0, 50) });

    try {
      // Apply rate limiting before publish
      await this.rateLimiter.consume('xiaohongshu', 'publish', 1);
      
      const result = await this.xiaohongshuAdapter.publish(credentials, post);
      return result;
    } catch (error: any) {
      this.logger.error('Single publish failed', { error: error.message });
      return {
        success: false,
        error: error.message,
        errorCode: 'PUBLISH_ERROR',
      };
    }
  }

  /**
   * Publish multiple posts as a batch with rate-limit-friendly delays
   * 
   * @param job - Batch job configuration
   * @param options - Publishing options:
   *   - delayMs: Milliseconds to wait between posts (default: 5000, min: 2000 to avoid rate limiting)
   *   - concurrency: Number of concurrent publishes (default: 1, Xiaohongshu typically requires serial)
   *   - stopOnFailure: If true, stops batch on first failure (default: false)
   * 
   * @returns BatchPublishJob with status and results
   */
  async publishBatch(
    job: Omit<BatchPublishJob, 'id' | 'status' | 'results' | 'progress'>,
    options: {
      delayMs?: number;
      concurrency?: number;
      stopOnFailure?: boolean;
    } = {},
  ): Promise<BatchPublishJob> {
    const jobId = `batch-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
    const delayMs = Math.max(options.delayMs ?? 5000, 2000); // Minimum 2s delay
    const concurrency = options.concurrency ?? 1;
    const stopOnFailure = options.stopOnFailure ?? false;

    const batchJob: BatchPublishJob = {
      id: jobId,
      posts: job.posts,
      credentials: job.credentials,
      scheduledAt: job.scheduledAt,
      status: 'pending',
      results: [],
      progress: { current: 0, total: job.posts.length },
    };

    this.activeJobs.set(jobId, batchJob);
    this.logger.log('Created batch publish job', { 
      jobId, 
      postCount: job.posts.length, 
      delayMs,
      concurrency 
    });

    // If scheduledAt is in the future, add to queue for scheduled execution
    if (job.scheduledAt && job.scheduledAt > new Date()) {
      this.jobQueue.push(batchJob);
      this.logger.log('Batch job scheduled', { jobId, scheduledAt: job.scheduledAt });
      return batchJob;
    }

    // Execute immediately (async, don't wait)
    this.executeBatchJob(batchJob, { delayMs, concurrency, stopOnFailure }).catch(err => {
      this.logger.error('Batch job failed with error', { jobId, error: err.message });
      batchJob.status = 'failed';
      batchJob.error = err.message;
    });

    return batchJob;
  }

  /**
   * Get status of a batch job
   */
  async getJobStatus(jobId: string): Promise<BatchPublishJob | null> {
    return this.activeJobs.get(jobId) || null;
  }

  /**
   * Cancel a pending or running batch job
   */
  async cancelJob(jobId: string): Promise<boolean> {
    const job = this.activeJobs.get(jobId);
    if (!job) return false;

    job.status = 'failed';
    job.error = 'Cancelled by user';
    
    // Remove from queue if pending
    this.jobQueue = this.jobQueue.filter(j => j.id !== jobId);
    
    this.logger.log('Batch job cancelled', { jobId });
    return true;
  }

  /**
   * List all active/completed jobs (with optional limit)
   */
  async listJobs(limit: number = 50): Promise<BatchPublishJob[]> {
    const jobs = Array.from(this.activeJobs.values())
      .sort((a, b) => new Date(b.progress.current - a.progress.current).getTime() - new Date(a.progress.current).getTime())
      .slice(0, limit);
    return jobs;
  }

  /**
   * Schedule a batch job for future execution
   */
  async scheduleBatch(
    job: Omit<BatchPublishJob, 'id' | 'status' | 'results' | 'progress'>,
    scheduledAt: Date,
  ): Promise<BatchPublishJob> {
    const batchJob: BatchPublishJob = {
      ...job,
      id: `batch-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
      status: 'pending',
      results: [],
      progress: { current: 0, total: job.posts.length },
      scheduledAt,
    };

    this.jobQueue.push(batchJob);
    this.activeJobs.set(batchJob.id, batchJob);

    this.logger.log('Batch job scheduled', { jobId: batchJob.id, scheduledAt });
    return batchJob;
  }

  /**
   * Internal batch processor execution
   */
  private async executeBatchJob(
    job: BatchPublishJob,
    options: { delayMs: number; concurrency: number; stopOnFailure: boolean },
  ): Promise<void> {
    job.status = 'running';
    this.isProcessing = true;

    try {
      const { posts, credentials } = job;
      const results: PublishResult[] = [];

      for (let i = 0; i < posts.length; i++) {
        const post = posts[i];
        
        this.logger.debug('Publishing post in batch', {
          jobId: job.id,
          index: i + 1,
          total: posts.length,
          title: post.title?.substring(0, 30),
        });

        try {
          // Apply rate limit - rateLimiter.consume already called in adapter.publish,
          // but we add extra delay here to be extra safe
          if (i > 0) {
            await this.sleep(options.delayMs);
          }

          const result = await this.xiaohongshuAdapter.publish(credentials, post);
          results.push(result);
        } catch (error: any) {
          const errorResult: PublishResult = {
            success: false,
            error: error.message,
            errorCode: 'BATCH_PUBLISH_ERROR',
          };
          results.push(errorResult);

          if (options.stopOnFailure) {
            this.logger.warn('Batch job stopping due to failure', { jobId: job.id, index: i });
            break;
          }
        }

        // Update progress
        job.progress.current = i + 1;
        job.results = results;

        // Update in active jobs map
        this.activeJobs.set(job.id, job);
      }

      // Determine final status
      const allSuccessful = results.every(r => r.success);
      const anyFailed = results.some(r => !r.success);
      
      job.status = allSuccessful ? 'completed' : (anyFailed ? 'failed' : 'completed');
      if (anyFailed) {
        job.error = 'Some posts failed to publish';
      }

      this.logger.log('Batch job completed', {
        jobId: job.id,
        total: posts.length,
        successful: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length,
      });
    } catch (error: any) {
      job.status = 'failed';
      job.error = error.message;
      this.logger.error('Batch job execution error', { jobId: job.id, error: error.message });
    } finally {
      this.isProcessing = false;
      // Optionally keep job in activeJobs for some time then archive/cleanup
      // For now, keep indefinitely or could implement TTL
    }
  }

  /**
   * Background processor for scheduled jobs
   * Runs continuously checking queue for due jobs
   */
  private startBatchProcessor(): void {
    setInterval(async () => {
      if (this.isProcessing || this.jobQueue.length === 0) {
        return;
      }

      const now = new Date();
      const dueJobs: BatchPublishJob[] = [];

      // Find jobs that are scheduled and ready
      for (const job of this.jobQueue) {
        if (job.scheduledAt && job.scheduledAt <= now && job.status === 'pending') {
          dueJobs.push(job);
        }
      }

      for (const job of dueJobs) {
        // Remove from queue
        this.jobQueue = this.jobQueue.filter(j => j.id !== job.id);
        
        // Execute job (don't await)
        this.executeBatchJob(job, {
          delayMs: 5000,
          concurrency: 1,
          stopOnFailure: false,
        }).catch(err => {
          this.logger.error('Scheduled batch job failed', { jobId: job.id, error: err.message });
        });
      }
    }, 10000); // Check every 10 seconds

    this.logger.log('Batch processor started');
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

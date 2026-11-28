/**
 * Resilient, Rate-Limited In-Memory Email Queue for Realty Smartz HRMS
 * 
 * Prevents SMTP connection throttling (e.g. Hostinger / Gmail 421/451/535 rate limits)
 * when multiple leave, target, or attendance events fire simultaneously.
 * 
 * Features:
 * - Sequential serialized processing with rate-limiting delay (1.2s between dispatches)
 * - Exponential backoff retry on transient network/socket glitches (up to 3 attempts)
 * - Non-blocking asynchronous ingestion (calls return immediately)
 * - Permanent failure detection (prevents infinite retry loops on bad credentials)
 * - Diagnostic queue statistics
 */

export interface QueuedMailJob {
  id: string;
  payload: {
    to: string | string[];
    cc?: string | string[];
    bcc?: string | string[];
    subject: string;
    html: string;
    text?: string;
  };
  retries: number;
  maxRetries: number;
  enqueuedAt: Date;
  senderFn?: (payload: any) => Promise<{ success: boolean; error?: string }>;
}

class EmailQueueManager {
  private queue: QueuedMailJob[] = [];
  private isProcessing = false;
  private minIntervalMs = 1200; // 1.2s gap between emails to respect SMTP concurrency limits
  private stats = {
    totalEnqueued: 0,
    totalSent: 0,
    totalFailed: 0,
    lastSentAt: null as Date | null,
    lastError: null as string | null,
  };

  /**
   * Enqueues an email for asynchronous delivery
   */
  public enqueue(
    payload: QueuedMailJob["payload"],
    senderFn: (payload: any) => Promise<{ success: boolean; error?: string }>,
    options?: { maxRetries?: number }
  ): { jobId: string; queuePosition: number } {
    const jobId = `mail_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const job: QueuedMailJob = {
      id: jobId,
      payload,
      retries: 0,
      maxRetries: options?.maxRetries ?? 3,
      enqueuedAt: new Date(),
      senderFn,
    };

    this.queue.push(job);
    this.stats.totalEnqueued++;

    console.info(
      `[email-queue] Enqueued job ${job.id} for "${job.payload.subject}" (Queue length: ${this.queue.length})`
    );

    // Trigger queue processing asynchronously
    void this.processNext();

    return { jobId, queuePosition: this.queue.length };
  }

  /**
   * Processes queue sequentially
   */
  private async processNext(): Promise<void> {
    if (this.isProcessing) return;
    if (this.queue.length === 0) return;

    this.isProcessing = true;

    try {
      while (this.queue.length > 0) {
        const job = this.queue[0];
        if (!job) break;

        let success = false;
        let errorMsg: string | undefined;

        try {
          if (job.senderFn) {
            const result = await job.senderFn(job.payload);
            success = result.success;
            errorMsg = result.error;
          }
        } catch (err: any) {
          success = false;
          errorMsg = err?.message || String(err);
        }

        if (success) {
          this.stats.totalSent++;
          this.stats.lastSentAt = new Date();
          console.info(`[email-queue] Successfully delivered job ${job.id}: "${job.payload.subject}"`);
          this.queue.shift(); // Remove completed job
        } else {
          job.retries++;
          const isAuthError =
            errorMsg?.includes("535") ||
            errorMsg?.includes("EAUTH") ||
            errorMsg?.toLowerCase().includes("authentication failed") ||
            errorMsg?.toLowerCase().includes("not configured");

          if (isAuthError || job.retries >= job.maxRetries) {
            this.stats.totalFailed++;
            this.stats.lastError = errorMsg || "Exceeded max retries";
            console.error(
              `[email-queue] Permanent delivery failure for job ${job.id}: ${errorMsg} (Dropping after ${job.retries} attempts)`
            );
            this.queue.shift(); // Drop failing job to not block the queue
          } else {
            console.warn(
              `[email-queue] Transient error for job ${job.id} (attempt ${job.retries}/${job.maxRetries}): ${errorMsg}. Backing off...`
            );
            // Exponential backoff before retrying
            await new Promise((r) => setTimeout(r, job.retries * 2000));
          }
        }

        // Polite delay between outbound messages
        if (this.queue.length > 0) {
          await new Promise((r) => setTimeout(r, this.minIntervalMs));
        }
      }
    } finally {
      this.isProcessing = false;
    }
  }

  public getStats() {
    return {
      ...this.stats,
      pendingCount: this.queue.length,
      isProcessing: this.isProcessing,
    };
  }
}

export const emailQueue = new EmailQueueManager();

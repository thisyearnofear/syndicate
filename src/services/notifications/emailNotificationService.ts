/**
 * NOTIFICATION SERVICE — Sends email notifications for yield and draw events.
 *
 * Uses the existing /api/virtuals/email endpoint (ACP binary) for delivery.
 * Designed to be called from cron jobs (e.g., after daily draw resolution,
 * or after yield-to-ticket conversion runs).
 *
 * Usage:
 *   import { notificationService } from '@/services/notifications';
 *   await notificationService.notifyYieldEarned({ to: 'user@example.com', ... });
 *   await notificationService.notifyDrawResult({ to: 'user@example.com', ... });
 */

import { logger } from '@/lib/logger';
import {
  yieldEarnedEmail,
  drawResultEmail,
  type YieldEarnedData,
  type DrawResultData,
} from './emailTemplates';

// ─── Configuration ────────────────────────────────────────────────────────────

const EMAIL_API_URL = '/api/virtuals/email';
const AUTOMATION_KEY = process.env.AUTOMATION_API_KEY ?? '';

// ─── Types ────────────────────────────────────────────────────────────────────

interface SendEmailParams {
  to: string;
  subject: string;
  body: string;
}

// ─── Internal ─────────────────────────────────────────────────────────────────

async function sendEmail(params: SendEmailParams): Promise<boolean> {
  try {
    // Resolve the full URL for server-side calls
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : 'http://localhost:3000';

    const url = `${baseUrl}${EMAIL_API_URL}`;

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(AUTOMATION_KEY ? { Authorization: `Bearer ${AUTOMATION_KEY}` } : {}),
      },
      body: JSON.stringify(params),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      logger.warn('[Notifications] Email send failed', { to: params.to, status: res.status, error: err });
      return false;
    }

    logger.info('[Notifications] Email sent', { to: params.to, subject: params.subject.slice(0, 50) });
    return true;
  } catch (err) {
    logger.error('[Notifications] Email send error', { to: params.to, error: err instanceof Error ? err.message : String(err) });
    return false;
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

export const emailNotificationService = {
  /**
   * Notify a user that their vault yield earned them tickets.
   * Call after yield-to-ticket conversion executes.
   */
  async notifyYieldEarned(to: string, data: YieldEarnedData): Promise<boolean> {
    const { subject, body } = yieldEarnedEmail(data);
    return sendEmail({ to, subject, body });
  },

  /**
   * Notify a user of draw results (win or participation summary).
   * Call after draw resolution is confirmed on-chain.
   */
  async notifyDrawResult(to: string, data: DrawResultData): Promise<boolean> {
    const { subject, body } = drawResultEmail(data);
    return sendEmail({ to, subject, body });
  },

  /**
   * Batch-send draw results to multiple recipients.
   * Processes sequentially to avoid overwhelming the email service.
   */
  async notifyDrawResultBatch(
    recipients: { email: string; data: DrawResultData }[]
  ): Promise<{ sent: number; failed: number }> {
    let sent = 0;
    let failed = 0;

    for (const { email, data } of recipients) {
      const success = await this.notifyDrawResult(email, data);
      if (success) sent++;
      else failed++;

      // Small delay between sends to avoid rate limits
      await new Promise((r) => setTimeout(r, 200));
    }

    logger.info('[Notifications] Batch complete', { sent, failed, total: recipients.length });
    return { sent, failed };
  },
};

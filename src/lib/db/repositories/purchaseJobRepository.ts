/**
 * PURCHASE JOB REPOSITORY
 *
 * Durable job queue backed by Vercel Postgres.
 * Protects against lost purchases if the server restarts between
 * chainhook receipt and ticket minting.
 *
 * Job lifecycle: pending → processing → complete | failed (retryable)
 */

import { sql } from '@vercel/postgres';

export type JobStatus = 'pending' | 'processing' | 'complete' | 'failed';
export type JobType = 'process_bridge_event' | 'mint_tickets';

export interface PurchaseJob {
  id?: number;
  jobType: JobType;
  status: JobStatus;
  payload: Record<string, unknown>;
  attempts: number;
  maxAttempts: number;
  lastError?: string | null;
  scheduledAt?: string;
  processedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

// ---------------------------------------------------------------------------
// Schema bootstrap (idempotent — safe to call on every cold start)
// ---------------------------------------------------------------------------

export async function ensurePurchaseJobsTable(): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS purchase_jobs (
      id            SERIAL PRIMARY KEY,
      job_type      TEXT        NOT NULL,
      status        TEXT        NOT NULL DEFAULT 'pending',
      payload       JSONB       NOT NULL DEFAULT '{}',
      attempts      INTEGER     NOT NULL DEFAULT 0,
      max_attempts  INTEGER     NOT NULL DEFAULT 5,
      last_error    TEXT,
      scheduled_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      processed_at  TIMESTAMPTZ,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_purchase_jobs_status_scheduled
      ON purchase_jobs (status, scheduled_at)
      WHERE status IN ('pending', 'failed');
  `;
}

// ---------------------------------------------------------------------------
// Enqueue
// ---------------------------------------------------------------------------

export async function enqueueJob(
  jobType: JobType,
  payload: Record<string, unknown>,
  maxAttempts = 5
): Promise<number> {
  const result = await sql`
    INSERT INTO purchase_jobs (job_type, status, payload, max_attempts)
    VALUES (${jobType}, 'pending', ${JSON.stringify(payload)}, ${maxAttempts})
    RETURNING id;
  `;
  return result.rows[0].id as number;
}

// ---------------------------------------------------------------------------
// Claim next pending job (atomic — prevents double-processing)
// ---------------------------------------------------------------------------

export async function claimNextJob(jobType?: JobType): Promise<PurchaseJob | null> {
  const result = jobType
    ? await sql`
        UPDATE purchase_jobs
        SET status = 'processing', attempts = attempts + 1, updated_at = NOW()
        WHERE id = (
          SELECT id FROM purchase_jobs
          WHERE status IN ('pending', 'failed')
            AND job_type = ${jobType}
            AND attempts < max_attempts
            AND scheduled_at <= NOW()
          ORDER BY scheduled_at ASC
          LIMIT 1
          FOR UPDATE SKIP LOCKED
        )
        RETURNING *;
      `
    : await sql`
        UPDATE purchase_jobs
        SET status = 'processing', attempts = attempts + 1, updated_at = NOW()
        WHERE id = (
          SELECT id FROM purchase_jobs
          WHERE status IN ('pending', 'failed')
            AND attempts < max_attempts
            AND scheduled_at <= NOW()
          ORDER BY scheduled_at ASC
          LIMIT 1
          FOR UPDATE SKIP LOCKED
        )
        RETURNING *;
      `;

  if (!result.rows.length) return null;
  return rowToJob(result.rows[0]);
}

// ---------------------------------------------------------------------------
// Complete / fail a job
// ---------------------------------------------------------------------------

export async function completeJob(id: number): Promise<void> {
  await sql`
    UPDATE purchase_jobs
    SET status = 'complete', processed_at = NOW(), updated_at = NOW()
    WHERE id = ${id};
  `;
}

export async function failJob(id: number, error: string, retryDelaySeconds = 30): Promise<void> {
  await sql`
    UPDATE purchase_jobs
    SET
      status = CASE WHEN attempts >= max_attempts THEN 'failed' ELSE 'pending' END,
      last_error = ${error},
      scheduled_at = NOW() + (${retryDelaySeconds} || ' seconds')::INTERVAL,
      updated_at = NOW()
    WHERE id = ${id};
  `;
}

// ---------------------------------------------------------------------------
// Idempotency: check if a job for a given txId already exists
// ---------------------------------------------------------------------------

export async function jobExistsForTxId(txId: string): Promise<boolean> {
  const result = await sql`
    SELECT 1 FROM purchase_jobs
    WHERE payload->>'txId' = ${txId}
      AND job_type = 'process_bridge_event'
      AND status IN ('pending', 'processing', 'complete')
    LIMIT 1;
  `;
  return result.rows.length > 0;
}

// ---------------------------------------------------------------------------
// Row mapper
// ---------------------------------------------------------------------------

function rowToJob(row: Record<string, unknown>): PurchaseJob {
  return {
    id: row.id as number,
    jobType: row.job_type as JobType,
    status: row.status as JobStatus,
    payload: (row.payload as Record<string, unknown>) || {},
    attempts: row.attempts as number,
    maxAttempts: row.max_attempts as number,
    lastError: row.last_error as string | null,
    scheduledAt: row.scheduled_at as string,
    processedAt: row.processed_at as string | null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

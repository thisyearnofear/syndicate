/**
 * GELATO REPOSITORY INDEX
 * 
 * Single entry point for Gelato repository initialization.
 * Avoids circular dependency by having this as the only file that imports both schema and repository.
 */

import { setGelatoTaskRepository, MockGelatoTaskRepository, type IGelatoTaskRepository } from '../schema/gelatoTasks';
import { logger } from '@/lib/logger';
export { VercelPostgresGelatoRepository } from './gelatoRepository';

export type {
  GelatoTaskRecord,
  GelatoExecutionRecord,
  IGelatoTaskRepository,
} from '../schema/gelatoTasks';

export {
  serializeGelatoTask,
  deserializeGelatoTask,
  MockGelatoTaskRepository,
  getGelatoTaskRepository,
  setGelatoTaskRepository,
} from '../schema/gelatoTasks';

let initialized = false;

export async function initializeProductionRepository(): Promise<void> {
  if (initialized) return;
  
  const hasDbConnection = 
    process.env.POSTGRES_URL || 
    process.env.DATABASE_URL || 
    process.env.POSTGRES_URLCONNECTION_STRING;

  if (hasDbConnection) {
    try {
      const { VercelPostgresGelatoRepository } = await import('./gelatoRepository');
      const repositoryInstance: IGelatoTaskRepository = new VercelPostgresGelatoRepository();
      setGelatoTaskRepository(repositoryInstance);
      const provider = process.env.POSTGRES_URL ? 'Neon' : 'Vercel Postgres';
      logger.info(`[GelatoTaskRepository] Initialized with ${provider}`);
      initialized = true;
    } catch (error) {
      logger.error('[GelatoTaskRepository] Failed to initialize Postgres', { error: String(error) });
      logger.info('[GelatoTaskRepository] Falling back to mock repository');
      setGelatoTaskRepository(new MockGelatoTaskRepository());
      initialized = true;
    }
  }
}
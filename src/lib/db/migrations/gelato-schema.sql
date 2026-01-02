-- Gelato Tasks Table
CREATE TABLE IF NOT EXISTS gelato_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id VARCHAR(255) NOT NULL UNIQUE,
  user_id VARCHAR(255) NOT NULL,
  permission_id VARCHAR(255) NOT NULL,
  user_address VARCHAR(42) NOT NULL,
  frequency VARCHAR(20) NOT NULL CHECK (frequency IN ('daily', 'weekly', 'monthly')),
  amount_per_period NUMERIC(78) NOT NULL,
  status VARCHAR(20) NOT NULL CHECK (status IN ('active', 'paused', 'cancelled')),
  execution_count INTEGER DEFAULT 0,
  last_executed_at BIGINT,
  next_execution_time BIGINT NOT NULL,
  last_error TEXT,
  gelato_status VARCHAR(20),
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL,
  expires_at BIGINT
);

-- Create indexes for gelato_tasks
CREATE INDEX IF NOT EXISTS idx_gelato_tasks_user_id ON gelato_tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_gelato_tasks_task_id ON gelato_tasks(task_id);
CREATE INDEX IF NOT EXISTS idx_gelato_tasks_status ON gelato_tasks(status);
CREATE INDEX IF NOT EXISTS idx_gelato_tasks_next_execution ON gelato_tasks(next_execution_time);

-- Gelato Execution History Table
CREATE TABLE IF NOT EXISTS gelato_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id VARCHAR(255) NOT NULL,
  task_record_id UUID NOT NULL,
  user_id VARCHAR(255) NOT NULL,
  executed_at BIGINT NOT NULL,
  transaction_hash VARCHAR(255),
  success BOOLEAN NOT NULL,
  error TEXT,
  amount_executed NUMERIC(78),
  referrer VARCHAR(42),
  gelato_execution_id VARCHAR(255),
  gas_used NUMERIC(78),
  created_at BIGINT NOT NULL,

  FOREIGN KEY (task_record_id) REFERENCES gelato_tasks(id) ON DELETE CASCADE
);

-- Create indexes for gelato_executions
CREATE INDEX IF NOT EXISTS idx_gelato_executions_task_record_id ON gelato_executions(task_record_id);
CREATE INDEX IF NOT EXISTS idx_gelato_executions_user_id ON gelato_executions(user_id);
CREATE INDEX IF NOT EXISTS idx_gelato_executions_executed_at ON gelato_executions(executed_at);

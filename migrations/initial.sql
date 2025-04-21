-- Create workflow_automation database if it doesn't exist
-- (This needs to be run separately as a superuser)
-- CREATE DATABASE workflow_automation;

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create tables
CREATE TABLE IF NOT EXISTS workflows (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  trigger_type VARCHAR(50) NOT NULL,
  trigger_value TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS workflow_steps (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workflow_id UUID NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
  step_type VARCHAR(50) NOT NULL,
  step_config JSONB NOT NULL,
  step_order INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS workflow_runs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workflow_id UUID NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
  status VARCHAR(20) NOT NULL, -- 'pending', 'running', 'completed', 'failed'
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  retry_of UUID REFERENCES workflow_runs(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS workflow_step_runs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workflow_run_id UUID NOT NULL REFERENCES workflow_runs(id) ON DELETE CASCADE,
  workflow_step_id UUID NOT NULL REFERENCES workflow_steps(id) ON DELETE CASCADE,
  status VARCHAR(20) NOT NULL, -- 'pending', 'running', 'completed', 'failed'
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  input JSONB,
  output JSONB,
  error_message TEXT
);

-- Create indices for better performance
CREATE INDEX idx_workflow_steps_workflow_id ON workflow_steps(workflow_id);
CREATE INDEX idx_workflow_runs_workflow_id ON workflow_runs(workflow_id);
CREATE INDEX idx_workflow_step_runs_workflow_run_id ON workflow_step_runs(workflow_run_id);
CREATE INDEX idx_workflow_step_runs_workflow_step_id ON workflow_step_runs(workflow_step_id);
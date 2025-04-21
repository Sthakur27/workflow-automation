// src/models/run.ts
export interface WorkflowRun {
  id: string; // UUID
  workflow_id: string; // UUID
  status: string; // 'pending', 'running', 'completed', 'failed'
  trigger: {
    type: string;
    value: string;
  };
  started_at: Date;
  completed_at?: Date;
  steps: WorkflowStepRun[];
  error_message?: string;
  retry_of?: string; // UUID
}

export enum RunStatus {
  PENDING = "PENDING",
  RUNNING = "RUNNING",
  COMPLETED = "COMPLETED",
  FAILED = "FAILED",
}

export interface WorkflowStepRun {
  id: string; // UUID
  workflow_run_id: string; // UUID
  workflow_step_id: string; // UUID
  status: string; // 'pending', 'running', 'completed', 'failed'
  started_at: Date;
  completed_at?: Date;
  input?: any;
  output?: any;
  error_message?: string;
}

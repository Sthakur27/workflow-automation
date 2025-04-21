// src/models/run.ts
export interface WorkflowRun {
  id: string;
  workflow_id: number;
  status: string; // 'pending', 'running', 'completed', 'failed'
  trigger: {
    type: string;
    value: string;
  };
  started_at: Date;
  completed_at?: Date;
  steps: WorkflowStepRun[];
  error_message?: string;
  retry_of?: number;
}

export enum RunStatus {
  PENDING = "PENDING",
  RUNNING = "RUNNING",
  COMPLETED = "COMPLETED",
  FAILED = "FAILED",
}

export interface WorkflowStepRun {
  id: number;
  workflow_run_id: number;
  workflow_step_id: number;
  status: string; // 'pending', 'running', 'completed', 'failed'
  started_at: Date;
  completed_at?: Date;
  input?: any;
  output?: any;
  error_message?: string;
}

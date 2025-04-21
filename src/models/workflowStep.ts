export interface WorkflowStep {
  id: number;
  workflow_id: number;
  step_type: string;
  step_config: any;
  step_order: number;
  created_at: Date;
  updated_at: Date;
}

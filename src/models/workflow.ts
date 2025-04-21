import { WorkflowStep } from "./workflowStep";

export interface Workflow {
  id: number;
  name: string;
  description: string;
  trigger_type: string;
  trigger_value: string;
  created_at: Date;
  updated_at: Date;
  steps?: WorkflowStep[];
}

export interface WorkflowInput {
  name: string;
  description: string;
}

export interface CreateWorkflowDto {
  name: string;
  description: string;
  trigger_type: string;
  trigger_value: string;
  steps?: Array<{
    step_type: string;
    step_config: any;
    step_order: number;
  }>;
}

import { WorkflowStep } from "./workflowStep";

export interface Workflow {
  id: string; // UUID
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
  natural_language_description: string;
}

// Response type for workflow creation
export interface WorkflowCreationResponse {
  workflow: Workflow;
  inferred_data?: {
    trigger: {
      type: string;
      value: string;
      description: string;
    };
    steps: Array<{
      id: string; // UUID
      type: string;
      config: any;
      order: number;
    }>;
  };
  metadata: {
    created_at: Date;
    updated_at: Date;
    execution_estimate?: string;
    potential_errors?: string[];
  };
}

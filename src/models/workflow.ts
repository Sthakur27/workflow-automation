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
  description: string;
  // If trigger_type and trigger_value are provided, use them directly
  // Otherwise, they should be inferred from the natural language description
  trigger_type?: string;
  trigger_value?: string;
  natural_language_description?: string;
  steps?: Array<{
    step_type: string;
    step_config: any;
    step_order: number;
    input_mapping?: Record<string, string>;
  }>;
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

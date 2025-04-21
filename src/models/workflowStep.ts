export interface WorkflowStep {
  id: number;
  workflow_id: number;
  step_type: string;
  step_config: any;
  // Input mapping allows referencing outputs from previous steps
  input_mapping?: {
    // Key is the input field name, value is the path to the output from a previous step
    // Format: "step_id:output_path" or a static value
    [key: string]: string;
  };
  step_order: number;
  created_at: Date;
  updated_at: Date;
}

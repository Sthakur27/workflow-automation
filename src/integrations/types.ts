// Base interface for all integration results
export interface IntegrationResult {
  success: boolean;
  [key: string]: any;
}

// Base interface for all integrations
export interface Integration<TConfig, TResult extends IntegrationResult> {
  execute(config: TConfig): Promise<TResult>;
}

import type { PricingConfig } from './pricing-config.types.js';

export interface PricingConfigMutation<R> {
  config: PricingConfig;
  result: R;
}

export interface PricingConfigRepository {
  // A missing file reads as the default configuration.
  read(): Promise<PricingConfig>;
  // Runs read-check-write as one unit; throwing inside `change` aborts without writing.
  mutate<R>(change: (config: PricingConfig) => PricingConfigMutation<R>): Promise<R>;
}

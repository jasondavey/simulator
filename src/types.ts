// types.ts

export interface WorkflowContext {
  isOnboarded: boolean;
  plaidItems: string[];
  resolvedWebhooks: Set<string>;
  errors: string[];
  startTime: number;
  maxTimeMs: number; // e.g., 10 * 60 * 1000
}

export type WorkflowEvent =
  | { type: 'CHECK_ONBOARDING' }
  | { type: 'ONBOARDED' }
  | { type: 'NOT_ONBOARDED' }
  | { type: 'PLAID_ITEMS_UPDATED'; items: string[] }
  | { type: 'WEBHOOK_FOUND'; webhookId: string; itemId: string }
  | { type: 'WEBHOOK_RESOLVED'; webhookId: string }
  | { type: 'TIMEOUT' }
  | { type: 'FAIL'; error: string }
  | { type: 'DONE' };

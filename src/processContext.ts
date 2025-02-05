import { Client } from 'fauna';
import { VeraScoreClient, VsPlaidItem } from './db/models';

export interface ProcessContext {
  isOnboarded: any;
  plaidItemsPollCount: number;
  auth0UserToken: string;
  process_name: any;
  onboardingPollCount: number;
  webhookPollCount: number;
  ownerId: string;
  clientId: string;
  startTime: number | null;
  endTime: number | null;
  auth0FetchTime: number | null;
  processedItems: Set<string>;
  plaidItems: VsPlaidItem[];
  webhookReceivedTimestamps: { [key: string]: number };
  processedSummary: {
    itemId: string;
    status: string;
    error?: string;
    webhookDelay?: string;
  }[];

  parentDbConnection: Client | null;
  childDbConnection: Client | null;
  vsClient: VeraScoreClient | null;
  errors: string[];
}

import { Client } from 'fauna';
import { VeraScoreClient } from './db/models';

export interface ProcessContext {
  ownerId: string;
  clientId: string;
  startTime: number | null;
  endTime: number | null;
  auth0FetchTime: number | null;
  processedItems: Set<string>;
  processedSummary: {
    itemId: string;
    status: string;
    error?: string;
    webhookDelay?: string;
  }[];
  webhookReceivedTimestamps: { [key: string]: number };
  parentDbConnection: Client | null;
  childDbConnection: Client | null;
  vsClient: VeraScoreClient | null;
  errors: string[];
}

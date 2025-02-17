import { Client } from 'fauna';
import { VeraScoreClient, VsPlaidItem } from './db/models';

export interface StateMachineContext {
  onboarded: boolean;
  bankConnectionSuccesses: string[];
  bankConnectionFailures: string[];

  // Webhook search concurrency
  searchQueue: Record<string, number>;
  webhookSearchFailures: string[];

  // Data import concurrency
  pendingImports: Set<string>;
  dataImportFailures: string[];

  // Scoring concurrency
  scoringFailures: string[];
  plaidItemsConnectionsQueue: string[];
  plaidItemsPollCount: number;
  isOnboarded: boolean;
  errors: any;
  processedSummary: any;
  webhookReceivedTimestamps: any;
  processedItems: any;
  auth0UserToken: string;
  process_name: any;
  memberId: string;
  clientId: string;
  startTime: number | null;
  endTime: number | null;
  auth0FetchTime: number | null;
  parentDbConnection: Client | null;
  childDbConnection: Client | null;
  vsClient: VeraScoreClient | null;
}

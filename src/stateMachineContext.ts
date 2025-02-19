import { Client } from 'fauna';
import { Auth0Profile, VeraScoreClient } from './db/models';

export interface StateMachineContext {
  onboarded: boolean;
  auth0UserProfile: Auth0Profile;
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

export const createInitialContext = (): StateMachineContext => {
  return {
    onboarded: false,
    auth0UserProfile: {} as Auth0Profile,
    bankConnectionSuccesses: [],
    bankConnectionFailures: [],

    searchQueue: {},
    webhookSearchFailures: [],

    pendingImports: new Set<string>(),
    dataImportFailures: [],

    scoringFailures: [],
    plaidItemsConnectionsQueue: [],
    plaidItemsPollCount: 0,
    isOnboarded: false,
    errors: null,
    processedSummary: null,
    webhookReceivedTimestamps: null,
    processedItems: null,
    auth0UserToken: '',
    process_name: null,
    memberId: '',
    clientId: '',
    startTime: null,
    endTime: null,
    auth0FetchTime: null,
    parentDbConnection: null,
    childDbConnection: null,
    vsClient: null
  };
};

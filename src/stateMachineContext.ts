import { Client } from 'fauna';
import { WebhookQueueEntry } from './types';

export interface Auth0UserMetadata {
  firstName: string;
  middleName: string;
  lastName: string;
  phoneNumber: string;
  companyName: string;
  licenseNumber: string;
  address: string;
  yearlyGrossIncome?: number;
  ssnOrItin?: string;
}

export interface Auth0UserProfile {
  app_metadata: any;
  user_id: string;
  email: string;
  username: string;
  email_verified: boolean;
  picture: string;
  name: string;
  sub: string;
  user_metadata: Auth0UserMetadata;
  created_at: string;
}

export interface StateMachineContext {
  process_name: string;
  startTime: number;
  endTime: number;
  auth0FetchTime: number;
  vsClient: any;
  parentDbConnection?: Client;
  childDbConnection?: Client;
  clientId: string;
  memberId: string;
  onboarded: boolean;

  bankConnectionSuccesses: string[];
  bankConnectionFailures: string[];
  webhookSearchQueue: Record<string, WebhookQueueEntry>;

  pendingImports: Set<string>;
  dataImportFailures: string[];

  scoringFailures: string[];

  plaidItemsConnectionsQueue: any[];
  plaidItemsPollCount: number;
  isOnboarded: boolean;
  errors: any[];

  processedSummary: any;
  webhookReceivedTimestamps: Record<string, number>;
  processedItems: any[];
  auth0UserToken: string;
  processedWebhookItems: any[];
  webhookProcessingErrors: any[];
  webhookProcessingSuccesses: any[];
  auth0UserProfile: Auth0UserProfile;
}

interface FactoryOptions {
  process_name?: string;
  clientId?: string;
  memberId?: string;
  parentDbConnection?: Client;
  childDbConnection?: Client;
  auth0UserToken?: string;
}

export const createInitialContext = (
  options: FactoryOptions = {}
): StateMachineContext => {
  const defaultAuth0Profile: Auth0UserProfile = {
    app_metadata: {},
    user_id: '',
    email: '',
    username: '',
    email_verified: false,
    picture: '',
    name: '',
    sub: '',
    user_metadata: {
      firstName: '',
      middleName: '',
      lastName: '',
      phoneNumber: '',
      companyName: '',
      licenseNumber: '',
      address: ''
    },
    created_at: new Date().toISOString()
  };

  return {
    // Process metadata
    process_name: options.process_name || 'default_process',
    startTime: 0,
    endTime: 0,
    auth0FetchTime: 0,

    // Database connections and clients
    vsClient: null,
    parentDbConnection: options.parentDbConnection,
    childDbConnection: options.childDbConnection,

    // User identification
    clientId: options.clientId || '',
    memberId: options.memberId || '',
    onboarded: false,
    isOnboarded: false,

    // Bank connection tracking
    bankConnectionSuccesses: [],
    bankConnectionFailures: [],

    // Webhook processing
    webhookSearchQueue: {},

    webhookReceivedTimestamps: {},
    processedWebhookItems: [],
    webhookProcessingErrors: [],
    webhookProcessingSuccesses: [],

    // Data import tracking
    pendingImports: new Set<string>(),
    dataImportFailures: [],

    // Scoring tracking
    scoringFailures: [],

    // Plaid specific tracking
    plaidItemsConnectionsQueue: [],
    plaidItemsPollCount: 0,

    // Error handling
    errors: [],

    // Process tracking
    processedSummary: null,
    processedItems: [],

    // Authentication
    auth0UserToken: options.auth0UserToken || '',
    auth0UserProfile: defaultAuth0Profile
  };
};

// Usage example:
/*
const context = createInitialContext({
  process_name: 'bank_connection',
  clientId: 'client123',
  memberId: 'member456',
  auth0UserToken: 'token789'
});
*/

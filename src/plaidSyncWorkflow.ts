import { assign, fromPromise, setup } from 'xstate';
import { getGreeting } from '.';
import { Client } from 'fauna';
import { ValidateClientIdHandler } from './validateClientIdHandler';
import { ValidateOwnerIdHandler } from './validateOwnerIdHandler';
import { ProcessContext } from './processContext';

const ownerId = process.argv[2];
const clientId = process.argv[3];

export const plaidAccountSyncWorfklow = setup({
  types: {
    context: {
      ownerId,
      clientId,
      startTime: Date.now(),
      endTime: null,
      auth0FetchTime: null,
      processedItems: new Set<string>(),
      processedSummary: [],
      webhookReceivedTimestamps: {},
      errors: [],
      parentDbConnection: null,
      childDbConnection: null,
      vsClient: null,
      onboardingPollCount: 0,
      webhookPollCount: 0,
      plaidItemsPollCount: 0,
      process_name: process.env.PROCESS_NAME!,
      auth0UserToken: '',
      isOnboarded: undefined,
      plaidItems: [],
      data: null
    }
  },
  actors: {
    handleArgValidation: fromPromise(async () => {
      console.log('handleApprovedVisaWorkflowID workflow started');
    })
  }
}).createMachine({
  initial: 'idle',
  id: 'plaid_sync',
  context: {
    ownerId,
    clientId,
    startTime: Date.now(),
    endTime: null,
    auth0FetchTime: null,
    processedItems: new Set<string>(),
    processedSummary: [],
    webhookReceivedTimestamps: {},
    errors: [],
    parentDbConnection: null,
    childDbConnection: null,
    vsClient: null,
    onboardingPollCount: 0,
    webhookPollCount: 0,
    plaidItemsPollCount: 0,
    process_name: process.env.PROCESS_NAME!,
    auth0UserToken: '',
    isOnboarded: undefined,
    plaidItems: [],
    data: null
  },
  states: {
    idle: {
      on: {
        VALIDATE: 'validating'
      }
    },
    validating: {
      invoke: {
        src: 'handleArgValidation',
        input: ({ context }) => ({
          ownerId: context.ownerId,
          clientId: context.clientId
        }),
        onDone: {
          target: 'success',
          actions: assign({})
        },
        onError: 'failure'
      }
    },
    success: {},
    failure: {
      after: {
        1000: 'validating'
      },
      on: {
        RETRY: 'validating'
      }
    }
  }
});

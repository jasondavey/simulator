import { assign, fromPromise, setup } from 'xstate';
import { getGreeting } from '.';
import { Client } from 'fauna';

const ownerId = process.argv[2];
const clientId = process.argv[3];

export const plaidAccountSyncWorfklow = setup({
  types: {
    context: {} as {
      ownerId: string;
      clientId: string;
      data: {
        greeting: string;
      } | null;
      parentDbConnection: Client | null;
    }
  },
  actors: {
    fetchUser: fromPromise(({ input }: { input: { ownerId: string } }) =>
      getGreeting(input.ownerId)
    )
  }
}).createMachine({
  initial: 'idle',
  id: 'plaid_sync',
  context: {
    ownerId,
    clientId,
    data: null,
    parentDbConnection: null
  },
  states: {
    idle: {
      on: {
        VALIDATE: 'validating'
      }
    },
    validating: {
      invoke: {
        src: 'fetchUser',
        input: ({ context }) => ({
          ownerId: context.ownerId,
          clientId: context.clientId
        }),
        onDone: {
          target: 'success',
          actions: assign({
            data: ({ event }) => event.output
          })
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

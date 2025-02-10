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
      name: string;
      data: {
        greeting: string;
      } | null;
      parentDbConnection: Client | null;
    }
  },
  actors: {
    fetchUser: fromPromise(
      ({ input }: { input: { name: string; ownerId: string } }) =>
        getGreeting(input.ownerId)
    )
  }
}).createMachine({
  initial: 'idle',
  id: 'plaid_sync',
  context: {
    ownerId,
    clientId,
    name: 'World',
    data: null,
    parentDbConnection: null
  },
  states: {
    idle: {
      on: {
        FETCH: 'loading'
      }
    },
    loading: {
      invoke: {
        src: 'fetchUser',
        input: ({ context }) => ({
          name: context.name,
          ownerId: context.ownerId
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
        1000: 'loading'
      },
      on: {
        RETRY: 'loading'
      }
    }
  }
});

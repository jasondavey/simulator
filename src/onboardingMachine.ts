import { Client } from 'fauna';
import { setup, assign } from 'xstate';
import { MailGunService } from './services/mailgunService';

interface OnboardingInput {
  clientId: string;
  memberId: string;
  parentDbConnection: Client;
}

interface OnboardingContext {
  parentDbConnection: Client | null;
  onboarded: boolean;
  clientId: string;
  memberId: string;

  // Bank-level successes/failures
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
}

type OnboardingEvent =
  // Bank Connection
  | { type: 'BANK_CONNECTED'; itemId: string }
  | { type: 'BANK_CONNECTION_FAILED'; itemId: string }
  | { type: 'USER_CLICK_FINISH' }
  | { type: 'TIME_EXCEEDED' }
  // Webhook Search
  | { type: 'WEBHOOK_SEARCH_FAILED'; itemId: string }
  | { type: 'CHECK_WEBHOOKS' }
  // Data Import
  | { type: 'HISTORICAL_UPDATE'; payload: { itemId: string } }
  | { type: 'DATA_IMPORT_COMPLETE'; payload: { itemId: string } }
  | { type: 'DATA_IMPORT_FAILED'; payload: { itemId: string } }
  // Scoring
  | { type: 'BEGIN_SCORING' }
  | { type: 'SCORING_COMPLETE' }
  | { type: 'SCORING_FAILED' };

export const onboardingMachine = setup({
  types: {
    context: {} as OnboardingContext,
    input: {} as OnboardingInput,
    events: {} as OnboardingEvent
  },

  actions: {
    // A) Bank Connection
    markOnboarded: async ({ context }) => {
      context.onboarded = true;

      try {
        await MailGunService.sendEmail(
          'Onboarding Complete',
          'Congratulations! You are now onboarded.'
        );
      } catch (error) {
        console.error('Error sending onboarding email:', error);
      }
    },

    logTimeout: () => {
      console.warn('Bank-connection timed out overall.');
    },

    addBankSuccess: assign(({ context, event }) => {
      if (event.type !== 'BANK_CONNECTED') return {};
      return {
        bankConnectionSuccesses: [
          ...context.bankConnectionSuccesses,
          event.itemId
        ],
        // Also add itemId to searchQueue so we can poll for webhooks
        searchQueue: {
          ...context.searchQueue,
          [event.itemId]: 0
        }
      };
    }),

    addBankFailure: assign(({ context, event }) => {
      if (event.type !== 'BANK_CONNECTION_FAILED') return {};
      return {
        bankConnectionFailures: [
          ...context.bankConnectionFailures,
          event.itemId
        ]
      };
    }),

    // B) Webhook Search
    pollForWebhooks: assign(({ context }) => {
      const updatedQueue = { ...context.searchQueue };
      for (const itemId of Object.keys(updatedQueue)) {
        updatedQueue[itemId] += 10;
      }
      return { searchQueue: updatedQueue };
    }),

    markWebhookSearchFailed: assign(({ context, event }) => {
      if (event.type !== 'WEBHOOK_SEARCH_FAILED') return {};
      const { itemId } = event;
      const updatedQueue = { ...context.searchQueue };
      delete updatedQueue[itemId];
      return {
        webhookSearchFailures: [...context.webhookSearchFailures, itemId],
        searchQueue: updatedQueue
      };
    }),

    addPendingImport: assign(({ context, event }) => {
      if (event.type !== 'HISTORICAL_UPDATE') return {};
      const newSet = new Set(context.pendingImports);
      newSet.add(event.payload.itemId);

      const updatedQueue = { ...context.searchQueue };
      delete updatedQueue[event.payload.itemId];

      return {
        pendingImports: newSet,
        searchQueue: updatedQueue
      };
    }),

    // C) Data Import
    removePendingImport: assign(({ context, event }) => {
      if (event.type !== 'DATA_IMPORT_COMPLETE') return {};
      const newSet = new Set(context.pendingImports);
      newSet.delete(event.payload.itemId);
      return { pendingImports: newSet };
    }),

    markImportFailed: assign(({ context, event }) => {
      if (event.type !== 'DATA_IMPORT_FAILED') return {};
      const { itemId } = event.payload;
      const newSet = new Set(context.pendingImports);
      newSet.delete(itemId);
      return {
        pendingImports: newSet,
        dataImportFailures: [...context.dataImportFailures, itemId]
      };
    }),

    // D) Scoring
    markScoringFailed: assign(({ context, event }) => {
      if (event.type !== 'SCORING_FAILED') return {};
      return {
        scoringFailures: [...context.scoringFailures, 'scoringFailed']
      };
    }),

    // E) Final summary
    logSummary: ({ context }) => {
      console.log('=== Final Summary ===');
      console.log('Client ID:', context.clientId);
      console.log('Member ID:', context.memberId);
      console.log('Onboarded:', context.onboarded);
      console.log(
        'Bank Connection Successes:',
        context.bankConnectionSuccesses
      );
      console.log('Bank Connection Failures:', context.bankConnectionFailures);
      console.log('Webhook Search Failures:', context.webhookSearchFailures);
      console.log('Data Import Failures:', context.dataImportFailures);
      console.log('Scoring Failures:', context.scoringFailures);
    }
  },

  guards: {
    noPendingImports: ({ context }) => context.pendingImports.size === 0
  }
}).createMachine({
  id: 'onboardingMachine',
  initial: 'onboarding',
  context: ({ input }) => ({
    parentDbConnection: input.parentDbConnection,
    clientId: input.clientId,
    memberId: input.memberId,
    onboarded: false,

    bankConnectionSuccesses: [],
    bankConnectionFailures: [],

    searchQueue: {},
    webhookSearchFailures: [],

    pendingImports: new Set<string>(),
    dataImportFailures: [],

    scoringFailures: []
  }),

  states: {
    //////////////////////////////////////////
    // 1) The parent "onboarding" state
    //////////////////////////////////////////
    onboarding: {
      type: 'parallel',
      onDone: 'finalSummary',

      states: {
        ////////////////////////////////
        // (A) Bank Connection
        ////////////////////////////////
        bankConnection: {
          initial: 'connecting',
          states: {
            connecting: {
              after: {
                10000: {
                  target: 'timedOut',
                  actions: 'logTimeout'
                }
              },
              on: {
                // Remain in "connecting" so user can connect multiple banks
                BANK_CONNECTED: {
                  actions: 'addBankSuccess'
                  // If you want to finalize after one success:
                  // target: 'doneConnecting'
                },
                BANK_CONNECTION_FAILED: {
                  actions: 'addBankFailure'
                  // Possibly target a different final or stay in "connecting"
                  // target: 'timedOut'
                },
                TIME_EXCEEDED: {
                  target: 'timedOut',
                  actions: 'logTimeout'
                },
                USER_CLICK_FINISH: {
                  target: 'doneConnecting',
                  actions: 'markOnboarded'
                }
              }
            },
            timedOut: { type: 'final' },
            doneConnecting: { type: 'final' }
          }
        },

        ////////////////////////////////
        // (B) Webhook Search
        ////////////////////////////////
        webhookSearch: {
          initial: 'searching',
          states: {
            searching: {
              after: {
                2000: {
                  internal: true,
                  actions: ['pollForWebhooks']
                }
              },
              on: {
                WEBHOOK_SEARCH_FAILED: {
                  actions: 'markWebhookSearchFailed'
                },
                HISTORICAL_UPDATE: {
                  actions: 'addPendingImport'
                }
              }
            }
          }
        },

        ////////////////////////////////
        // (C) Data Import
        ////////////////////////////////
        dataImport: {
          initial: 'idle',
          states: {
            idle: {
              on: {
                HISTORICAL_UPDATE: {
                  target: 'active',
                  actions: 'addPendingImport'
                }
              }
            },
            active: {
              on: {
                HISTORICAL_UPDATE: {
                  actions: 'addPendingImport'
                },
                DATA_IMPORT_COMPLETE: [
                  {
                    guard: 'noPendingImports',
                    target: 'importComplete',
                    actions: 'removePendingImport'
                  },
                  {
                    actions: 'removePendingImport'
                  }
                ],
                DATA_IMPORT_FAILED: {
                  actions: 'markImportFailed'
                }
              }
            },
            importComplete: { type: 'final' }
          }
        },

        ////////////////////////////////
        // (D) Scoring
        ////////////////////////////////
        scoring: {
          initial: 'idle',
          states: {
            idle: {},
            scoring: {
              on: {
                SCORING_COMPLETE: 'doneScoring',
                SCORING_FAILED: { actions: 'markScoringFailed' }
              }
            },
            doneScoring: { type: 'final' }
          }
        }
      },

      // Automatically start scoring once dataImport => importComplete
      // and scoring => 'idle'
      on: {
        'xstate.parallel.state.value': [
          {
            guard: ({ state }: { state: any }) => {
              const dataImportState = state.value.onboarding.dataImport;
              const scoringState = state.value.onboarding.scoring;
              return (
                dataImportState === 'importComplete' && scoringState === 'idle'
              );
            },
            actions: ({
              selfSend
            }: {
              selfSend: (event: OnboardingEvent) => void;
            }) => {
              selfSend({ type: 'BEGIN_SCORING' });
            }
          }
        ],
        'BEGIN_SCORING': {
          target: '.scoring.scoring'
        }
      }
    },

    //////////////////////////////////////////
    // 2) Final summary after "onboarding"
    //////////////////////////////////////////
    finalSummary: {
      type: 'final',
      entry: 'logSummary'
    }
  }
});

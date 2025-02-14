import { setup, assign } from 'xstate';

/**
 * Context interface
 */
interface OnboardingContext {
  onboarded: boolean;

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

/**
 * Event union
 */
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

/**
 * Onboarding machine with a parent "onboarding" parallel state
 * and a top-level "finalSummary" state.
 */
export const onboardingMachine = setup({
  // 1) XState v5 type definitions
  types: {
    context: {} as OnboardingContext,
    events: {} as OnboardingEvent
  },

  // 2) Actions & guards
  actions: {
    // A) Bank Connection
    markOnboarded: assign(({ context }) => ({
      onboarded: true
    })),

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
      // This is a simplified example; you might do real external checks
      const updatedQueue = { ...context.searchQueue };
      for (const itemId of Object.keys(updatedQueue)) {
        updatedQueue[itemId] += 10;
        // If itemId hits 60s or 120s => time out, etc.
        // For demonstration, we just increment. In a real flow,
        // you'd send a WEBHOOK_SEARCH_FAILED event if you want to handle timeouts.
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

      // Remove the item from searchQueue, since we found the webhook
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
  //////////////////////////////////////////////////////////////
  // 3) Default context
  //////////////////////////////////////////////////////////////
  id: 'onboardingMachine',
  initial: 'onboarding',

  context: {
    onboarded: false,

    bankConnectionSuccesses: [],
    bankConnectionFailures: [],

    searchQueue: {},
    webhookSearchFailures: [],

    pendingImports: new Set<string>(),
    dataImportFailures: [],

    scoringFailures: []
  },

  //////////////////////////////////////////////////////////////
  // 4) The parent "onboarding" state (type: 'parallel')
  //    and a sibling "finalSummary" state.
  //////////////////////////////////////////////////////////////
  states: {
    onboarding: {
      // All sub-states (bankConnection, webhookSearch, dataImport, scoring) run in parallel.
      type: 'parallel',

      // When all parallel branches finalize => finalSummary
      onDone: 'finalSummary',

      //////////////////////////////////////////////////////////////////
      // 4A) Parallel States
      //////////////////////////////////////////////////////////////////
      states: {
        /////////////////////////////////////
        // (A) Bank Connection
        /////////////////////////////////////
        bankConnection: {
          initial: 'connecting',
          states: {
            connecting: {
              // e.g. after 120s => timedOut
              after: {
                120000: { target: 'timedOut', actions: 'logTimeout' }
              },
              on: {
                BANK_CONNECTED: { actions: 'addBankSuccess' },
                BANK_CONNECTION_FAILED: { actions: 'addBankFailure' },
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

        /////////////////////////////////////
        // (B) Webhook Search
        /////////////////////////////////////
        webhookSearch: {
          initial: 'searching',
          states: {
            searching: {
              after: {
                10000: {
                  internal: true,
                  actions: [
                    'pollForWebhooks'
                    // Possibly check which items should fail => WEBHOOK_SEARCH_FAILED
                  ]
                }
              },
              on: {
                WEBHOOK_SEARCH_FAILED: { actions: 'markWebhookSearchFailed' },
                HISTORICAL_UPDATE: {
                  actions: 'addPendingImport'
                }
              }
            }
          }
        },

        /////////////////////////////////////
        // (C) Data Import
        /////////////////////////////////////
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
                DATA_IMPORT_FAILED: { actions: 'markImportFailed' }
              }
            },
            importComplete: { type: 'final' }
          }
        },

        /////////////////////////////////////
        // (D) Scoring
        /////////////////////////////////////
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
      }, // end of parallel states

      //////////////////////////////////////////////////////////////////
      // 4B) Auto-start scoring once dataImport => importComplete
      //////////////////////////////////////////////////////////////////
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
          // We target "onboarding.scoring.scoring"
          target: '.scoring.scoring'
        }
      }
    },

    //////////////////////////////////////////////////////////////////
    // 5) Final summary once "onboarding" onDone
    //////////////////////////////////////////////////////////////////
    finalSummary: {
      type: 'final',
      entry: 'logSummary'
    }
  }
});

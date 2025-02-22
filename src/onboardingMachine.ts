import { setup, assign, fromPromise, raise } from 'xstate';
import { MailGunService } from './services/mailgunService';
import {
  createInitialContext,
  StateMachineContext
} from './stateMachineContext';
import { EmailInput } from './types';
import PlaidWebhookDao from './db/plaidWebhookDao';
import { Client } from 'fauna';

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
    context: {} as StateMachineContext,
    events: {} as OnboardingEvent
  },

  actors: {
    importPlaidData: fromPromise(
      async ({
        input
      }: {
        input: { itemId: string; context: StateMachineContext };
      }) => {
        const { itemId, context } = input;
        const apiUrl = `${process.env.IMPORT_API_URL}/item`;

        console.info('[Plaid Import] Starting data import', { itemId });

        try {
          const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              owner: context.auth0UserProfile.user_id,
              itemId: itemId,
              clientId: context.clientId
            })
          });

          if (!response.ok) {
            throw new Error(`Plaid API error: ${response.statusText}`);
          }

          console.info('[Plaid Import] Successfully imported data', {
            itemId,
            status: 'success',
            timestamp: new Date().toISOString()
          });

          return { success: true, itemId };
        } catch (error) {
          console.error('[Plaid Import] Failed to import data', {
            itemId,
            error: error instanceof Error ? error.message : String(error),
            timestamp: new Date().toISOString()
          });
          throw error;
        }
      }
    ),

    sendOnboardingCompleteEmail: fromPromise(
      async ({ input }: { input: EmailInput }) => {
        await MailGunService.sendEmail(input.email, input.subject, input.body);
        return { success: true };
      }
    ),
    searchWebhooksActor: fromPromise(
      async ({
        input
      }: {
        input: {
          itemId: string;
          dbConnection: Client;
          attempts: number;
        };
      }) => {
        const webhookData =
          await PlaidWebhookDao.getWebhookReadyForImportByItemId(
            input.dbConnection,
            input.itemId
          );
        if (!webhookData) {
          return null; // No webhook found, continue searching if not onboarded
        }

        // Mark the webhook as processed to prevent reuse
        const updatedWebhook = {
          ...webhookData,
          resolved_at: new Date().toISOString()
        };
        await PlaidWebhookDao.upsertWebhook(input.dbConnection, updatedWebhook);

        return webhookData;
      }
    )
  },

  actions: {
    handleWebhookSearchResult: assign({
      webhookSearchQueue: ({ context, event }: { context: StateMachineContext; event: any }) => {
        if (!event.output) {
          console.info('[Webhook Search] No webhook found for item, continuing search');
          return context.webhookSearchQueue;
        }

        const foundItemId = event.output.itemId;
        return {
          ...context.webhookSearchQueue,
          [foundItemId]: {
            ...context.webhookSearchQueue[foundItemId],
            status: 'found' as const,
            foundAt: Date.now()
          }
        };
      }
    }),

    raiseHistoricalUpdate: ({ event }: { event: any }) => {
      if (event.output) {
        const historicalUpdate: OnboardingEvent = {
          type: 'HISTORICAL_UPDATE',
          payload: { itemId: event.output.itemId }
        };
        return raise(historicalUpdate);
      }
    },

    raiseDataImportComplete: ({ event }: { event: any }) => {
      const dataImportComplete: OnboardingEvent = {
        type: 'DATA_IMPORT_COMPLETE',
        payload: { itemId: event.output.itemId }
      };
      return raise(dataImportComplete);
    },

    logTimeout: () => {
      console.warn('Bank-connection timed out overall.');
    },

    addBankSuccess: assign({
      bankConnectionSuccesses: ({ context, event }) => {
        console.log('Event type:', event.type);
        console.log(
          'Current bankConnectionSuccesses:',
          context.bankConnectionSuccesses
        );

        if (event.type === 'BANK_CONNECTED') {
          console.log('Event itemId:', event.itemId);
          console.log('Bank connected:', event.itemId);
          const newSuccesses = [
            ...context.bankConnectionSuccesses,
            event.itemId
          ];
          console.log('New bankConnectionSuccesses:', newSuccesses);
          return newSuccesses;
        }

        return context.bankConnectionSuccesses;
      },
      webhookSearchQueue: ({ context, event }) => {
        if (event.type !== 'BANK_CONNECTED') return context.webhookSearchQueue;

        return {
          ...context.webhookSearchQueue,
          [event.itemId]: {
            status: 'pending' as const,
            attempts: 0,
            lastAttempt: Date.now()
          }
        };
      }
    }),

    addBankFailure: assign({
      bankConnectionFailures: ({ context, event }) => {
        if (event.type !== 'BANK_CONNECTION_FAILED')
          return context.bankConnectionFailures;
        return [...context.bankConnectionFailures, event.itemId];
      }
    }),

    // B) Webhook Search
    pollForWebhooks: assign({
      webhookSearchQueue: ({ context }) => {
        const updatedQueue = { ...context.webhookSearchQueue };
        Object.entries(updatedQueue).forEach(([itemId, entry]) => {
          if (entry.status === 'pending') {
            updatedQueue[itemId] = {
              ...entry,
              attempts: entry.attempts + 1,
              lastAttempt: Date.now()
            };
          }
        });
        return updatedQueue;
      }
    }),

    markWebhookFound: assign({
      webhookSearchQueue: ({ context, event }) => {
        if (event.type !== 'HISTORICAL_UPDATE')
          return context.webhookSearchQueue;
        return {
          ...context.webhookSearchQueue,
          [event.payload.itemId]: {
            ...context.webhookSearchQueue[event.payload.itemId],
            status: 'found' as const,
            foundAt: Date.now()
          }
        };
      }
    }),

    markWebhookSearchFailed: assign({
      webhookSearchQueue: ({ context, event }) => {
        if (event.type !== 'WEBHOOK_SEARCH_FAILED')
          return context.webhookSearchQueue;
        return {
          ...context.webhookSearchQueue,
          [event.itemId]: {
            ...context.webhookSearchQueue[event.itemId],
            status: 'failed' as const,
            lastAttempt: Date.now()
          }
        };
      }
    }),

    addPendingImport: assign({
      pendingImports: ({ context, event }) => {
        if (event.type !== 'HISTORICAL_UPDATE') return context.pendingImports;
        const newSet = new Set(context.pendingImports);
        newSet.add(event.payload.itemId);
        return newSet;
      },
      webhookSearchQueue: ({ context, event }) => {
        if (event.type !== 'HISTORICAL_UPDATE')
          return context.webhookSearchQueue;
        const { [event.payload.itemId]: _, ...rest } =
          context.webhookSearchQueue;
        return rest;
      }
    }),
    // C) Data Import
    removePendingImport: assign({
      pendingImports: ({ context, event }) => {
        if (event.type !== 'DATA_IMPORT_COMPLETE')
          return context.pendingImports;
        const newSet = new Set(context.pendingImports);
        newSet.delete(event.payload.itemId);
        return newSet;
      }
    }),
    markImportFailed: assign({
      pendingImports: ({ context, event }) => {
        if (event.type !== 'DATA_IMPORT_FAILED') return context.pendingImports;
        const newSet = new Set(context.pendingImports);
        newSet.delete(event.payload.itemId);
        return newSet;
      },
      dataImportFailures: ({ context, event }) => {
        if (event.type !== 'DATA_IMPORT_FAILED')
          return context.dataImportFailures;
        return [...context.dataImportFailures, event.payload.itemId];
      }
    }),

    // D) Scoring
    markScoringFailed: assign({
      scoringFailures: ({ context, event }) => {
        if (event.type !== 'SCORING_FAILED') return context.scoringFailures;
        return [...context.scoringFailures, 'scoringFailed'];
      }
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
      console.log(
        'Webhook Search Failures:',
        Object.entries(context.webhookSearchQueue)
          .filter(([_, entry]) => entry.status === 'failed')
          .map(([itemId]) => itemId)
      );
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
    ...createInitialContext(),
    ...(input as StateMachineContext) // Merge input context
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
                600000: [
                  {
                    guard: ({ context }) => !context.onboarded,
                    target: 'timedOut',
                    actions: 'logTimeout'
                  }
                ]
              },
              on: {
                BANK_CONNECTED: {
                  actions: 'addBankSuccess'
                },
                BANK_CONNECTION_FAILED: {
                  actions: 'addBankFailure'
                },
                TIME_EXCEEDED: {
                  target: 'timedOut',
                  actions: 'logTimeout'
                },
                USER_CLICK_FINISH: {
                  target: 'sendOnboardingCompleteEmail',
                  actions: assign({ onboarded: true })
                }
              }
            },
            sendOnboardingCompleteEmail: {
              invoke: {
                id: 'sendOnboardingCompleteEmail',
                src: 'sendOnboardingCompleteEmail',
                input: ({ context }) => ({
                  email: context.auth0UserProfile.email,
                  subject: 'Onboarding Complete',
                  body: 'Congratulations! You are now onboarded.'
                }),
                onDone: {
                  target: 'doneConnecting'
                },
                onError: {
                  target: 'failure',
                  actions: assign({
                    errors: ({ context, event }) => [
                      ...(context.errors || []),
                      { type: 'EMAIL_ERROR', message: event.error }
                    ]
                  })
                }
              }
            },
            timedOut: { type: 'final' },
            doneConnecting: { type: 'final' },
            failure: { type: 'final' }
          }
        },

        ////////////////////////////////
        // (B) Webhook Search
        ////////////////////////////////
        webhookSearch: {
          initial: 'checking',
          states: {
            checking: {
              always: [
                {
                  // If there are pending webhooks, go to searching
                  guard: ({ context }) =>
                    Object.values(context.webhookSearchQueue).some(
                      (entry) => entry.status === 'pending'
                    ),
                  target: 'searching'
                },
                {
                  // If no pending webhooks, go to idle
                  target: 'idle'
                }
              ]
            },
            idle: {
              after: {
                2000: 'checking' // Check again after delay
              }
            },
            searching: {
              invoke: {
                src: 'searchWebhooksActor',
                input: ({ context }) => {
                  const pendingItem = Object.entries(
                    context.webhookSearchQueue
                  ).find(([_, entry]) => entry.status === 'pending');

                  if (!pendingItem) {
                    return {
                      itemId: '',
                      dbConnection: context.childDbConnection!,
                      attempts: 0
                    };
                  }

                  const [itemId, entry] = pendingItem;
                  return {
                    itemId,
                    dbConnection: context.childDbConnection!,
                    attempts: entry.attempts
                  };
                },
                onDone: {
                  target: 'checking',
                  actions: ['handleWebhookSearchResult', 'raiseHistoricalUpdate']
                },
                onError: {
                  actions: 'markWebhookSearchFailed',
                  target: 'checking' // Check again even after error
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
                  target: 'importing',
                  actions: assign({
                    pendingImports: ({ context, event }) => {
                      if (event.type !== 'HISTORICAL_UPDATE')
                        return context.pendingImports;
                      console.info('[Data Import] Starting historical import', {
                        itemId: event.payload.itemId
                      });
                      const newSet = new Set(context.pendingImports);
                      newSet.add(event.payload.itemId);
                      return newSet;
                    }
                  })
                }
              }
            },
            importing: {
              invoke: {
                src: 'importPlaidData',
                input: ({ context, event }) => ({
                  itemId: (event as any).payload.itemId,
                  context: context
                }),
                onDone: {
                  target: 'checkPending',
                  actions: [
                    'removePendingImport',
                    'raiseDataImportComplete',
                    ({ event }) => {
                      console.info(
                        '[Data Import] Import completed successfully',
                        {
                          itemId: (event as any).payload.itemId
                        }
                      );
                    }
                  ]
                },
                onError: {
                  target: 'retrying',
                  actions: [
                    ({ event }) => {
                      console.error('[Data Import] Import failed', {
                        error: event.error,
                        itemId: (event as any).payload.itemId
                      });
                    }
                  ]
                }
              },
              on: {
                HISTORICAL_UPDATE: {
                  actions: 'addPendingImport'
                }
              }
            },
            retrying: {
              after: {
                3000: 'importing'
              },
              on: {
                HISTORICAL_UPDATE: {
                  actions: 'addPendingImport'
                }
              }
            },
            checkPending: {
              always: [
                {
                  guard: ({ context }) => context.pendingImports.size > 0,
                  target: 'importing'
                },
                {
                  target: 'importComplete'
                }
              ]
            },
            importComplete: {
              type: 'final',
              entry: () => console.info('[Data Import] All imports completed')
            }
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
        DATA_IMPORT_COMPLETE: [
          {
            guard: 'noPendingImports',
            actions: 'removePendingImport',
            target: '.scoring.scoring'
          }
        ],
        BEGIN_SCORING: {
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

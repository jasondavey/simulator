import { setup, assign, fromPromise, raise } from 'xstate';
import { MailGunService } from './services/mailgunService';
import {
  createInitialContext,
  StateMachineContext
} from './stateMachineContext';
import { EmailInput } from './types';
import PlaidWebhookDao from './db/plaidWebhookDao';
import { Client } from 'fauna';
import { WorkflowLogger } from './utils/workflowLogger';

const TIMEOUTS = {
  BANK_CONNECTION: parseInt(process.env.BANK_CONNECTION_TIMEOUT_MS || '600000', 10),      // 10 minutes
  WEBHOOK_CHECK_INTERVAL: parseInt(process.env.WEBHOOK_CHECK_INTERVAL_MS || '2000', 10),  // 2 seconds
  DATA_IMPORT_RETRY_DELAY: parseInt(process.env.DATA_IMPORT_RETRY_DELAY_MS || '3000', 10) // 3 seconds
} as const;

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

// Create logger instance for the workflow
let workflowLogger: WorkflowLogger;

const logTransition = (state: string, event: any, input?: any, output?: any, error?: any) => {
  workflowLogger.logStateTransition(state, event.type, input, output, error);
};

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

        logTransition('importPlaidData', { type: 'START_IMPORT' }, { itemId, context });

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

          const result = { success: true, itemId };
          logTransition('importPlaidData', { type: 'IMPORT_SUCCESS' }, null, result);
          return result;
        } catch (error) {
          logTransition('importPlaidData', { type: 'IMPORT_ERROR' }, null, null, error);
          throw error;
        }
      }
    ),

    sendOnboardingCompleteEmail: fromPromise(
      async ({ input }: { input: EmailInput }) => {
        logTransition('sendOnboardingCompleteEmail', { type: 'SEND_EMAIL' }, input);
        try {
          await MailGunService.sendEmail(input.email, input.subject, input.body);
          const result = { success: true };
          logTransition('sendOnboardingCompleteEmail', { type: 'EMAIL_SENT' }, null, result);
          return result;
        } catch (error) {
          logTransition('sendOnboardingCompleteEmail', { type: 'EMAIL_ERROR' }, null, null, error);
          throw error;
        }
      }
    ),

    webhookSearchActor: fromPromise(
      async ({
        input
      }: {
        input: {
          itemId: string;
          dbConnection: Client;
          attempts: number;
        };
      }) => {
        logTransition('webhookSearch', { type: 'SEARCH_START' }, input);
        try {
          const webhookData =
            await PlaidWebhookDao.getWebhookReadyForImportByItemId(
              input.dbConnection,
              input.itemId
            );
          
          if (!webhookData) {
            logTransition('webhookSearch', { type: 'NO_WEBHOOK_FOUND' }, null, null);
            return null;
          }

          const updatedWebhook = {
            ...webhookData,
            resolved_at: new Date().toISOString()
          };
          await PlaidWebhookDao.upsertWebhook(input.dbConnection, updatedWebhook);

          logTransition('webhookSearch', { type: 'WEBHOOK_FOUND' }, null, webhookData);
          return webhookData;
        } catch (error) {
          logTransition('webhookSearch', { type: 'SEARCH_ERROR' }, null, null, error);
          throw error;
        }
      }
    )
  },

  actions: {
    handleWebhookSearchResult: assign({
      webhookSearchQueue: ({ context, event }: { context: StateMachineContext; event: any }) => {
        if (!event.output) {
          logTransition('webhookSearch', { type: 'NO_WEBHOOK' }, context.webhookSearchQueue);
          return context.webhookSearchQueue;
        }

        const foundItemId = event.output.itemId;
        const result = {
          ...context.webhookSearchQueue,
          [foundItemId]: {
            ...context.webhookSearchQueue[foundItemId],
            status: 'found' as const,
            foundAt: Date.now()
          }
        };
        logTransition('webhookSearch', { type: 'WEBHOOK_FOUND' }, null, result);
        return result;
      }
    }),

    raiseHistoricalUpdate: ({ event }: { event: any }) => {
      if (!event.output) return [];
      const action = [{
        type: 'HISTORICAL_UPDATE',
        payload: { itemId: event.output.itemId }
      }];
      logTransition('webhookSearch', { type: 'RAISE_HISTORICAL_UPDATE' }, null, action);
      return action;
    },

    raiseDataImportComplete: ({ event }: { event: any }) => {
      const action = [{
        type: 'DATA_IMPORT_COMPLETE',
        payload: { itemId: event.output.itemId }
      }];
      logTransition('dataImport', { type: 'COMPLETE' }, null, action);
      return action;
    },

    logTimeout: () => {
      logTransition('bankConnection', { type: 'TIMEOUT' });
    },

    addBankSuccess: assign({
      bankConnectionSuccesses: ({ context, event }) => {
        if (event.type === 'BANK_CONNECTED') {
          const newSuccesses = [
            ...context.bankConnectionSuccesses,
            event.itemId
          ];
          logTransition('bankConnection', event, null, { successes: newSuccesses });
          return newSuccesses;
        }
        return context.bankConnectionSuccesses;
      },
      webhookSearchQueue: ({ context, event }) => {
        if (event.type !== 'BANK_CONNECTED') return context.webhookSearchQueue;

        const result = {
          ...context.webhookSearchQueue,
          [event.itemId]: {
            status: 'pending' as const,
            attempts: 0,
            lastAttempt: Date.now()
          }
        };
        logTransition('webhookSearch', { type: 'QUEUE_UPDATE' }, null, result);
        return result;
      }
    }),

    addBankFailure: assign({
      bankConnectionFailures: ({ context, event }) => {
        if (event.type !== 'BANK_CONNECTION_FAILED')
          return context.bankConnectionFailures;
        const result = [...context.bankConnectionFailures, event.itemId];
        logTransition('bankConnection', event, null, { failures: result });
        return result;
      }
    }),

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
        logTransition('webhookSearch', { type: 'POLL' }, null, updatedQueue);
        return updatedQueue;
      }
    }),

    markWebhookFound: assign({
      webhookSearchQueue: ({ context, event }) => {
        if (event.type !== 'HISTORICAL_UPDATE')
          return context.webhookSearchQueue;
        const result = {
          ...context.webhookSearchQueue,
          [event.payload.itemId]: {
            ...context.webhookSearchQueue[event.payload.itemId],
            status: 'found' as const,
            foundAt: Date.now()
          }
        };
        logTransition('webhookSearch', { type: 'MARK_FOUND' }, null, result);
        return result;
      }
    }),

    markWebhookSearchFailed: assign({
      webhookSearchQueue: ({ context, event }) => {
        if (event.type !== 'WEBHOOK_SEARCH_FAILED')
          return context.webhookSearchQueue;
        const result = {
          ...context.webhookSearchQueue,
          [event.itemId]: {
            ...context.webhookSearchQueue[event.itemId],
            status: 'failed' as const,
            lastAttempt: Date.now()
          }
        };
        logTransition('webhookSearch', { type: 'MARK_FAILED' }, null, result);
        return result;
      }
    }),

    addPendingImport: assign({
      pendingImports: ({ context, event }) => {
        if (event.type !== 'HISTORICAL_UPDATE') return context.pendingImports;
        const newSet = new Set(context.pendingImports);
        newSet.add(event.payload.itemId);
        logTransition('dataImport', { type: 'ADD_PENDING' }, null, Array.from(newSet));
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

    removePendingImport: assign({
      pendingImports: ({ context, event }) => {
        if (event.type !== 'DATA_IMPORT_COMPLETE')
          return context.pendingImports;
        const newSet = new Set(context.pendingImports);
        newSet.delete(event.payload.itemId);
        logTransition('dataImport', { type: 'REMOVE_PENDING' }, null, Array.from(newSet));
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
        const result = [...context.dataImportFailures, event.payload.itemId];
        logTransition('dataImport', { type: 'MARK_FAILED' }, null, { failures: result });
        return result;
      }
    }),

    markScoringFailed: assign({
      scoringFailures: ({ context, event }) => {
        if (event.type !== 'SCORING_FAILED') return context.scoringFailures;
        const result = [...context.scoringFailures, 'scoringFailed'];
        logTransition('scoring', { type: 'MARK_FAILED' }, null, { failures: result });
        return result;
      }
    }),

    logSummary: ({ context }) => {
      const summary = {
        clientId: context.clientId,
        memberId: context.memberId,
        onboarded: context.onboarded,
        bankConnectionSuccesses: context.bankConnectionSuccesses,
        bankConnectionFailures: context.bankConnectionFailures,
        webhookSearchFailures: Object.entries(context.webhookSearchQueue)
          .filter(([_, entry]) => entry.status === 'failed')
          .map(([itemId]) => itemId),
        dataImportFailures: context.dataImportFailures,
        scoringFailures: context.scoringFailures
      };
      logTransition('finalSummary', { type: 'COMPLETE' }, null, summary);
    }
  },

  guards: {
    noPendingImports: ({ context }) => context.pendingImports.size === 0
  }
}).createMachine({
  id: 'onboardingMachine',
  initial: 'onboarding',
  context: ({ input }) => {
    const context = {
      ...createInitialContext(),
      ...(input as StateMachineContext)
    };
    workflowLogger = new WorkflowLogger(context.clientId);
    return context;
  },
  states: {
    onboarding: {
      type: 'parallel',
      onDone: 'finalSummary',
      states: {
        bankConnection: {
          initial: 'connecting',
          states: {
            connecting: {
              entry: () => logTransition('bankConnection', { type: 'ENTER_CONNECTING' }),
              after: {
                [TIMEOUTS.BANK_CONNECTION]: [
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
              entry: () => logTransition('bankConnection', { type: 'ENTER_SEND_EMAIL' }),
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
            timedOut: { 
              type: 'final',
              entry: () => logTransition('bankConnection', { type: 'TIMED_OUT' })
            },
            doneConnecting: { 
              type: 'final',
              entry: () => logTransition('bankConnection', { type: 'DONE' })
            },
            failure: { 
              type: 'final',
              entry: () => logTransition('bankConnection', { type: 'FAILED' })
            }
          }
        },

        webhookSearch: {
          initial: 'checking',
          states: {
            checking: {
              entry: () => logTransition('webhookSearch', { type: 'ENTER_CHECKING' }),
              always: [
                {
                  guard: ({ context }) =>
                    Object.values(context.webhookSearchQueue).some(
                      (entry) => entry.status === 'pending'
                    ),
                  target: 'searching'
                },
                {
                  target: 'idle'
                }
              ]
            },
            idle: {
              entry: () => logTransition('webhookSearch', { type: 'ENTER_IDLE' }),
              after: {
                [TIMEOUTS.WEBHOOK_CHECK_INTERVAL]: 'checking'
              }
            },
            searching: {
              entry: () => logTransition('webhookSearch', { type: 'ENTER_SEARCHING' }),
              invoke: {
                src: 'webhookSearchActor',
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
                  target: 'checking'
                }
              }
            }
          }
        },

        dataImport: {
          initial: 'idle',
          states: {
            idle: {
              entry: () => logTransition('dataImport', { type: 'ENTER_IDLE' }),
              on: {
                HISTORICAL_UPDATE: {
                  target: 'importing',
                  actions: assign({
                    pendingImports: ({ context, event }) => {
                      if (event.type !== 'HISTORICAL_UPDATE')
                        return context.pendingImports;
                      const newSet = new Set(context.pendingImports);
                      newSet.add(event.payload.itemId);
                      logTransition('dataImport', { type: 'START_IMPORT' }, { itemId: event.payload.itemId });
                      return newSet;
                    }
                  })
                }
              }
            },
            importing: {
              entry: () => logTransition('dataImport', { type: 'ENTER_IMPORTING' }),
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
                      logTransition('dataImport', { type: 'IMPORT_SUCCESS' }, null, { itemId: (event as any).payload.itemId });
                    }
                  ]
                },
                onError: {
                  target: 'retrying',
                  actions: [
                    ({ event }) => {
                      logTransition('dataImport', { type: 'IMPORT_ERROR' }, null, null, event.error);
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
              entry: () => logTransition('dataImport', { type: 'ENTER_RETRYING' }),
              after: {
                [TIMEOUTS.DATA_IMPORT_RETRY_DELAY]: 'importing'
              },
              on: {
                HISTORICAL_UPDATE: {
                  actions: 'addPendingImport'
                }
              }
            },
            checkPending: {
              entry: () => logTransition('dataImport', { type: 'ENTER_CHECK_PENDING' }),
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
              entry: () => logTransition('dataImport', { type: 'COMPLETE' })
            }
          }
        },

        scoring: {
          initial: 'idle',
          states: {
            idle: {
              entry: () => logTransition('scoring', { type: 'ENTER_IDLE' })
            },
            scoring: {
              entry: () => logTransition('scoring', { type: 'ENTER_SCORING' }),
              on: {
                SCORING_COMPLETE: {
                  target: 'doneScoring',
                  actions: () => logTransition('scoring', { type: 'COMPLETE' })
                },
                SCORING_FAILED: { 
                  actions: ['markScoringFailed', () => logTransition('scoring', { type: 'FAILED' })]
                }
              }
            },
            doneScoring: { 
              type: 'final',
              entry: () => logTransition('scoring', { type: 'DONE' })
            }
          }
        }
      },

      on: {
        DATA_IMPORT_COMPLETE: [
          {
            guard: 'noPendingImports',
            actions: ['removePendingImport', () => logTransition('workflow', { type: 'START_SCORING' })],
            target: '.scoring.scoring'
          }
        ],
        BEGIN_SCORING: {
          target: '.scoring.scoring'
        }
      }
    },

    finalSummary: {
      type: 'final',
      entry: 'logSummary'
    }
  }
});

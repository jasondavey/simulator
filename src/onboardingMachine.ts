import { setup, assign } from 'xstate';

interface OnboardingContext {
  onboarded: boolean;
  connectedBanks: number;
  pendingImports: Set<string>;
}

type OnboardingEvent =
  | { type: 'USER_CLICK_FINISH' }
  | { type: 'TIME_EXCEEDED' }
  | { type: 'HISTORICAL_UPDATE'; payload: { itemId: string } }
  | { type: 'DATA_IMPORT_COMPLETE'; payload: { itemId: string } }
  | { type: 'BEGIN_SCORING' }
  | { type: 'SCORING_COMPLETE' };

export const onboardingMachine = setup({
  //////////////////////////////////////////////////////////////////////
  // 1) Declare XState v5 types
  //////////////////////////////////////////////////////////////////////
  types: {
    context: {} as OnboardingContext,
    events: {} as OnboardingEvent
  },

  //////////////////////////////////////////////////////////////////////
  // 2) Define actions & guards
  //////////////////////////////////////////////////////////////////////
  actions: {
    markOnboarded: assign(({ context }) => {
      return { onboarded: true };
    }),

    logTimeout: () => {
      console.warn('Bank-connection timed out after 10 minutes.');
    },

    addPendingImport: assign(({ context, event }) => {
      if (event.type !== 'HISTORICAL_UPDATE') {
        return {};
      }
      const newSet = new Set(context.pendingImports);
      newSet.add(event.payload.itemId);
      return { pendingImports: newSet };
    }),

    removePendingImport: assign(({ context, event }) => {
      if (event.type !== 'DATA_IMPORT_COMPLETE') {
        return {};
      }
      const newSet = new Set(context.pendingImports);
      newSet.delete(event.payload.itemId);
      return { pendingImports: newSet };
    })
  },

  guards: {
    noPendingImports: ({ context }) => context.pendingImports.size === 0
  }

  // NOTE: No `context: { ... }` property here in setup(...),
  // since it's not recognized. We'll define default context below.
}).createMachine({
  //////////////////////////////////////////////////////////////////////
  // 3) Provide your default context in createMachine(...)
  //////////////////////////////////////////////////////////////////////
  context: {
    onboarded: false,
    connectedBanks: 0,
    pendingImports: new Set<string>()
  },

  //////////////////////////////////////////////////////////////////////
  // 4) Define parallel states
  //////////////////////////////////////////////////////////////////////
  id: 'onboardingMachine',
  type: 'parallel',

  states: {
    bankConnection: {
      initial: 'connecting',
      states: {
        connecting: {
          after: {
            5000: { target: 'timedOut', actions: 'logTimeout' }
          },
          on: {
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

    dataImport: {
      initial: 'active',
      states: {
        active: {
          on: {
            HISTORICAL_UPDATE: { actions: 'addPendingImport' },
            DATA_IMPORT_COMPLETE: [
              {
                guard: 'noPendingImports',
                target: 'importComplete',
                actions: 'removePendingImport'
              },
              {
                actions: 'removePendingImport'
              }
            ]
          }
        },
        importComplete: { type: 'final' }
      }
    },

    scoring: {
      initial: 'idle',
      states: {
        idle: {},
        scoring: {
          on: {
            SCORING_COMPLETE: 'doneScoring'
          }
        },
        doneScoring: { type: 'final' }
      }
    }
  },

  //////////////////////////////////////////////////////////////////////
  // 5) Auto-start scoring once dataImport => importComplete
  //////////////////////////////////////////////////////////////////////
  on: {
    'xstate.parallel.state.value': [
      {
        guard: ({ state }: { state: any }) => {
          const dataImportState = state.value.dataImport;
          const scoringState = state.value.scoring;
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
});

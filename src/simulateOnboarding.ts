import { createActor } from 'xstate';
import { onboardingMachine } from './onboardingMachine'; // Adjust the path if needed

function simulateOnboarding() {
  // 1) Create and start the actor
  const actor = createActor(onboardingMachine).start();

  // Helper function to print current state + context
  function logState(label: string) {
    const snapshot = actor.getSnapshot();
    console.log(`\n[${label}]`);
    console.log('State:', snapshot.value);
    console.log('Context:', snapshot.context);
  }

  // 2) Check initial
  logState('Initial');

  // 3) Connect the first bank successfully
  actor.send({ type: 'BANK_CONNECTED', itemId: 'bank1' });
  logState('After bank1 connected');

  // 4) Another bank fails to connect
  actor.send({ type: 'BANK_CONNECTION_FAILED', itemId: 'bank2' });
  logState('After bank2 connection failed');

  // 5) User finishes connecting banks => onboarded
  actor.send({ type: 'USER_CLICK_FINISH' });
  logState('User clicked finish -> bankConnection done');

  // 6) We find a webhook for bank1
  //    This triggers dataImport => active
  actor.send({
    type: 'HISTORICAL_UPDATE',
    payload: { itemId: 'bank1' }
  });
  logState('After HISTORICAL_UPDATE for bank1');

  // 7) Suppose data import fails for bank1
  actor.send({
    type: 'DATA_IMPORT_FAILED',
    payload: { itemId: 'bank1' }
  });
  logState('After bank1 import fails');

  // 8) Now that no more pending imports remain (we removed bank1 from pending),
  //    dataImport branch should finalize => triggers scoring

  // 9) Finally, scoring completes (or fails).
  //    We'll choose success here. If you want to see a scoring failure, use SCORING_FAILED.
  actor.send({ type: 'SCORING_COMPLETE' });
  logState('After scoring completes');

  // At this point, once all parallel branches finalize,
  // the machine transitions to "finalSummary" and logs its summary via the "logSummary" action.
  // That will appear in the console automatically.
}

// Run the simulation
simulateOnboarding();

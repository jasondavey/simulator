import { createActor } from 'xstate';
import { onboardingMachine } from './onboardingMachine'; // Adjust import path if needed

function simulateOnboarding() {
  // 1) Create and start the actor
  const actor = createActor(onboardingMachine).start();

  // Helper to log the current state + context
  function logState(step: string) {
    const snapshot = actor.getSnapshot();
    console.log(`\n[${step}]`);
    console.log('State value:', snapshot.value);
    console.log('Context:', snapshot.context);
  }

  // Initial state
  logState('Initial');

  // 2) After 2s, one bank connects successfully
  setTimeout(() => {
    actor.send({ type: 'BANK_CONNECTED', itemId: 'bank1' });
    logState('After bank1 connected');
  }, 2000);

  // 3) After 3s, another bank fails to connect
  setTimeout(() => {
    actor.send({ type: 'BANK_CONNECTION_FAILED', itemId: 'bank2' });
    logState('After bank2 connection failed');
  }, 3000);

  // 4) After 5s, user finishes connecting banks => bankConnection done
  setTimeout(() => {
    actor.send({ type: 'USER_CLICK_FINISH' });
    logState('User clicked finish => bankConnection done');
  }, 5000);

  // 5) After 7s, a Plaid webhook arrives for bank1 => triggers data import
  setTimeout(() => {
    actor.send({ type: 'HISTORICAL_UPDATE', payload: { itemId: 'bank1' } });
    logState('After HISTORICAL_UPDATE for bank1 => dataImport.active');
  }, 7000);

  // 6) After 9s, data import fails for bank1
  setTimeout(() => {
    actor.send({
      type: 'DATA_IMPORT_FAILED',
      payload: { itemId: 'bank1' }
    });
    logState('After bank1 import fails');
    // With no other pending imports, dataImport => importComplete => triggers scoring
  }, 9000);

  // 7) After 12s, scoring completes => onDone => finalSummary
  setTimeout(() => {
    actor.send({ type: 'SCORING_COMPLETE' });
    logState('After SCORING_COMPLETE');
    // The machine transitions to finalSummary automatically once all parallel states finalize.
    // "logSummary" will print the summary to the console.
  }, 12000);
}

// Run the simulation
simulateOnboarding();

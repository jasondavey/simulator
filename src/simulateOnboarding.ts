import { createActor } from 'xstate';
import { onboardingMachine } from './onboardingMachine'; // Adjust path if needed

function simulateOnboarding() {
  // 1) Create and start the actor
  const actor = createActor(onboardingMachine).start();

  // Helper to log current state + context
  function logState(step: string) {
    const snapshot = actor.getSnapshot();
    console.log(`\n[${step}]`);
    console.log('State value:', snapshot.value);
    console.log('Context:', snapshot.context);
  }

  // Initial state
  logState('Initial');

  // ─────────────────────────────────────────────────────────────
  // 2) Connect Bank #1 successfully after 2s
  setTimeout(() => {
    actor.send({ type: 'BANK_CONNECTED', itemId: 'bank1' });
    logState('Bank #1 connected');
  }, 2000);

  // 3) Connect Bank #2 successfully after 3s
  setTimeout(() => {
    actor.send({ type: 'BANK_CONNECTED', itemId: 'bank2' });
    logState('Bank #2 connected');
  }, 3000);

  // 4) Bank #3 fails to connect after 4s
  setTimeout(() => {
    actor.send({ type: 'BANK_CONNECTION_FAILED', itemId: 'bank3' });
    logState('Bank #3 failed to connect');
  }, 4000);

  // 5) Connect Bank #4 successfully after 5s
  setTimeout(() => {
    actor.send({ type: 'BANK_CONNECTED', itemId: 'bank4' });
    logState('Bank #4 connected');
  }, 5000);

  // 6) Connect Bank #5 successfully after 6s
  setTimeout(() => {
    actor.send({ type: 'BANK_CONNECTED', itemId: 'bank5' });
    logState('Bank #5 connected');
  }, 6000);

  // 7) User finishes connecting banks after 7s
  setTimeout(() => {
    actor.send({ type: 'USER_CLICK_FINISH' });
    logState('User clicked finish => no more bank connections');
  }, 7000);

  // ─────────────────────────────────────────────────────────────
  // 8) Webhook discovered for Bank #1 after 8s => triggers data import
  setTimeout(() => {
    actor.send({ type: 'HISTORICAL_UPDATE', payload: { itemId: 'bank1' } });
    logState('Webhook for Bank #1 => pendingImports');
  }, 8000);

  // 9) Data import completes for Bank #1 after 9s
  setTimeout(() => {
    actor.send({
      type: 'DATA_IMPORT_COMPLETE',
      payload: { itemId: 'bank1' }
    });
    logState('Bank #1 data import complete');
  }, 9000);

  // 10) Webhook discovered for Bank #2 after 10s
  setTimeout(() => {
    actor.send({ type: 'HISTORICAL_UPDATE', payload: { itemId: 'bank2' } });
    logState('Webhook for Bank #2 => pendingImports');
  }, 10000);

  // 11) Data import **fails** for Bank #2 after 11s
  setTimeout(() => {
    actor.send({
      type: 'DATA_IMPORT_FAILED',
      payload: { itemId: 'bank2' }
    });
    logState('Bank #2 data import failed');
  }, 11000);

  // 12) Webhook discovered for Bank #4 after 12s
  setTimeout(() => {
    actor.send({ type: 'HISTORICAL_UPDATE', payload: { itemId: 'bank4' } });
    logState('Webhook for Bank #4 => pendingImports');
  }, 12000);

  // 13) Data import complete for Bank #4 after 13s
  setTimeout(() => {
    actor.send({
      type: 'DATA_IMPORT_COMPLETE',
      payload: { itemId: 'bank4' }
    });
    logState('Bank #4 data import complete');
  }, 13000);

  // 14) Webhook discovered for Bank #5 after 14s
  setTimeout(() => {
    actor.send({ type: 'HISTORICAL_UPDATE', payload: { itemId: 'bank5' } });
    logState('Webhook for Bank #5 => pendingImports');
  }, 14000);

  // 15) Data import completes for Bank #5 after 16s
  setTimeout(() => {
    actor.send({
      type: 'DATA_IMPORT_COMPLETE',
      payload: { itemId: 'bank5' }
    });
    logState('Bank #5 data import complete');
    // At this point, if there are no other pending imports,
    // dataImport => importComplete => triggers scoring
  }, 16000);

  // 16) Scoring completes after 18s => final summary
  setTimeout(() => {
    actor.send({ type: 'SCORING_COMPLETE' });
    logState('Scoring complete => machine final summary');
    // The machine transitions to finalSummary, logs results via logSummary.
  }, 18000);
}

// Execute the simulation
simulateOnboarding();

import { createActor } from 'xstate';
import { onboardingMachine } from './onboardingMachine'; // Adjust import path if needed

/**
 * Demonstrates parallel concurrency with multiple banks connecting,
 * receiving webhooks, importing data, and final scoring - all overlapping.
 */
function simulateParallelOnboarding() {
  // Create and start the actor
  const actor = createActor(onboardingMachine).start();

  // Helper: log current state + context
  function logState(label: string) {
    const snapshot = actor.getSnapshot();
    console.log(`\n[${label}]`);
    console.log('State value:', snapshot.value);
    console.log('Context:', snapshot.context);
  }

  // Initial
  logState('Initial');

  // ─────────────────────────────────────────────────────
  // TIMELINE OF EVENTS (in ms) to show concurrency:
  //
  //  2s: bank1 connects
  //  3s: bank2 connects
  //  4s: HISTORICAL_UPDATE for bank1 => triggers data import
  //  5s: bank3 connects
  //  6s: data import fails for bank1
  //  6.5s: bank4 connects
  //  7s: user finishes connecting => no more connections
  //  8s: HISTORICAL_UPDATE for bank2 => data import
  //  9s: data import completes for bank2
  //  9.5s: HISTORICAL_UPDATE for bank3 => data import
  //  10s: data import completes for bank3
  //  10.5s: HISTORICAL_UPDATE for bank4 => data import
  //  11s: data import completes for bank4 => triggers scoring
  //  12s: SCORING_COMPLETE => final summary
  //
  // This schedule ensures that while one bank is still connecting,
  // another has already started data import, etc.

  // 2s: bank1 connects
  setTimeout(() => {
    actor.send({ type: 'BANK_CONNECTED', itemId: 'bank1' });
    logState('bank1 connected');
  }, 2000);

  // 3s: bank2 connects
  setTimeout(() => {
    actor.send({ type: 'BANK_CONNECTED', itemId: 'bank2' });
    logState('bank2 connected');
  }, 3000);

  // 4s: HISTORICAL_UPDATE for bank1 => triggers data import
  setTimeout(() => {
    actor.send({ type: 'HISTORICAL_UPDATE', payload: { itemId: 'bank1' } });
    logState('Webhook for bank1 => data import started');
  }, 4000);

  // 5s: bank3 connects
  setTimeout(() => {
    actor.send({ type: 'BANK_CONNECTED', itemId: 'bank3' });
    logState('bank3 connected');
  }, 5000);

  // 6s: data import fails for bank1
  setTimeout(() => {
    actor.send({
      type: 'DATA_IMPORT_FAILED',
      payload: { itemId: 'bank1' }
    });
    logState('bank1 import FAILS');
  }, 6000);

  // 6.5s: bank4 connects
  setTimeout(() => {
    actor.send({ type: 'BANK_CONNECTED', itemId: 'bank4' });
    logState('bank4 connected');
  }, 6500);

  // 7s: user finishes connecting => no more new banks
  setTimeout(() => {
    actor.send({ type: 'USER_CLICK_FINISH' });
    logState('User clicked finish => bankConnection done');
  }, 7000);

  // 8s: HISTORICAL_UPDATE for bank2 => triggers data import
  setTimeout(() => {
    actor.send({ type: 'HISTORICAL_UPDATE', payload: { itemId: 'bank2' } });
    logState('Webhook for bank2 => data import started');
  }, 8000);

  // 9s: data import completes for bank2
  setTimeout(() => {
    actor.send({
      type: 'DATA_IMPORT_COMPLETE',
      payload: { itemId: 'bank2' }
    });
    logState('bank2 import COMPLETE');
  }, 9000);

  // 9.5s: HISTORICAL_UPDATE for bank3 => triggers data import
  setTimeout(() => {
    actor.send({ type: 'HISTORICAL_UPDATE', payload: { itemId: 'bank3' } });
    logState('Webhook for bank3 => data import started');
  }, 9500);

  // 10s: data import completes for bank3
  setTimeout(() => {
    actor.send({
      type: 'DATA_IMPORT_COMPLETE',
      payload: { itemId: 'bank3' }
    });
    logState('bank3 import COMPLETE');
  }, 10000);

  // 10.5s: HISTORICAL_UPDATE for bank4 => triggers data import
  setTimeout(() => {
    actor.send({ type: 'HISTORICAL_UPDATE', payload: { itemId: 'bank4' } });
    logState('Webhook for bank4 => data import started');
  }, 10500);

  // 11s: data import completes for bank4 => triggers scoring automatically
  setTimeout(() => {
    actor.send({
      type: 'DATA_IMPORT_COMPLETE',
      payload: { itemId: 'bank4' }
    });
    logState('bank4 import COMPLETE => dataImport final => begin scoring');
  }, 11000);

  // 12s: scoring completes => final summary
  setTimeout(() => {
    actor.send({ type: 'SCORING_COMPLETE' });
    logState('SCORING_COMPLETE => finalSummary');
    // The machine transitions to finalSummary and logs results via logSummary
  }, 12000);
}

// Run the asynchronous parallel simulation
simulateParallelOnboarding();

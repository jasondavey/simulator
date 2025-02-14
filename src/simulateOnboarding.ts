import { createActor } from 'xstate';
import { onboardingMachine } from './onboardingMachine'; // Adjust path if needed

/**
 * This simulation has five banks:
 *  - Bank1 fully completes all states (connection -> import -> scoring)
 *    before the user finishes onboarding (USER_CLICK_FINISH).
 *  - Banks 2, 3, 4, 5 connect later, but user doesn't click Finish until
 *    after they've connected. They can do data import / scoring after finishing.
 */
function simulateFiveBanksParallel() {
  // 1) Create & start the actor
  const actor = createActor(onboardingMachine).start();

  // Helper to log state + context
  function logState(label: string) {
    const snapshot = actor.getSnapshot();
    console.log(`\n[${label}]`);
    console.log('State:', snapshot.value);
    console.log('Context:', snapshot.context);
  }

  logState('Initial');

  // ─────────────────────────────────────────────────────────────
  // Timeline of events:
  //
  // 2s: bank1 connects
  // 3s: bank2 connects
  // 4s: bank1 => HISTORICAL_UPDATE => triggers data import
  // 5s: bank1 => DATA_IMPORT_COMPLETE => triggers scoring
  // 6s: SCORING_COMPLETE => bank1 fully done
  // 7s: bank3 connects
  // 8s: bank4 connects
  // 8.5s: bank5 connects
  // 9s: USER_CLICK_FINISH => user is onboarded, no more connections
  // 10s: bank2 => HISTORICAL_UPDATE => data import
  // 11s: bank2 => DATA_IMPORT_COMPLETE => triggers scoring
  // 12s: SCORING_COMPLETE => banks 2 done scoring
  // 12.5s: bank3 => HISTORICAL_UPDATE => data import
  // 13s: bank3 => DATA_IMPORT_COMPLETE => triggers scoring => done
  // 13.5s: bank4 => HISTORICAL_UPDATE => data import
  // 14s: bank4 => DATA_IMPORT_COMPLETE => triggers scoring => done
  // 14.5s: bank5 => HISTORICAL_UPDATE => data import
  // 15s: bank5 => DATA_IMPORT_COMPLETE => triggers scoring => final summary
  //
  // If you want fewer steps, remove some connections or merges. The key:
  // bank1 fully finishes before user is onboarded at 9s, while others come after.

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

  // 4s: bank1 => HISTORICAL_UPDATE => triggers data import
  setTimeout(() => {
    actor.send({ type: 'HISTORICAL_UPDATE', payload: { itemId: 'bank1' } });
    logState('bank1 webhook => data import');
  }, 4000);

  // 5s: bank1 => data import complete => triggers scoring
  setTimeout(() => {
    actor.send({
      type: 'DATA_IMPORT_COMPLETE',
      payload: { itemId: 'bank1' }
    });
    logState('bank1 import complete => scoring');
  }, 5000);

  // 6s: scoring completes for bank1 => bank1 fully done
  setTimeout(() => {
    actor.send({ type: 'SCORING_COMPLETE' });
    logState('bank1 scoring complete => bank1 done');
  }, 6000);

  // 7s: bank3 connects
  setTimeout(() => {
    actor.send({ type: 'BANK_CONNECTED', itemId: 'bank3' });
    logState('bank3 connected');
  }, 7000);

  // 8s: bank4 connects
  setTimeout(() => {
    actor.send({ type: 'BANK_CONNECTED', itemId: 'bank4' });
    logState('bank4 connected');
  }, 8000);

  // 8.5s: bank5 connects
  setTimeout(() => {
    actor.send({ type: 'BANK_CONNECTED', itemId: 'bank5' });
    logState('bank5 connected');
  }, 8500);

  // 9s: user finishes => onboarded = true, no more connections
  setTimeout(() => {
    actor.send({ type: 'USER_CLICK_FINISH' });
    logState('User clicked finish => bankConnection done');
  }, 9000);

  // 10s: bank2 => HISTORICAL_UPDATE => triggers data import
  setTimeout(() => {
    actor.send({
      type: 'HISTORICAL_UPDATE',
      payload: { itemId: 'bank2' }
    });
    logState('bank2 webhook => data import');
  }, 10000);

  // 11s: bank2 => data import complete => triggers scoring
  setTimeout(() => {
    actor.send({
      type: 'DATA_IMPORT_COMPLETE',
      payload: { itemId: 'bank2' }
    });
    logState('bank2 import complete => scoring');
  }, 11000);

  // 12s: scoring completes (bank2 done)
  setTimeout(() => {
    actor.send({ type: 'SCORING_COMPLETE' });
    logState('bank2 scoring complete');
  }, 12000);

  // 12.5s: bank3 => HISTORICAL_UPDATE => triggers data import
  setTimeout(() => {
    actor.send({
      type: 'HISTORICAL_UPDATE',
      payload: { itemId: 'bank3' }
    });
    logState('bank3 webhook => data import');
  }, 12500);

  // 13s: bank3 => data import complete => triggers scoring
  setTimeout(() => {
    actor.send({
      type: 'DATA_IMPORT_COMPLETE',
      payload: { itemId: 'bank3' }
    });
    logState('bank3 import complete => scoring');
  }, 13000);

  // 13.5s: bank4 => HISTORICAL_UPDATE => data import
  setTimeout(() => {
    actor.send({
      type: 'HISTORICAL_UPDATE',
      payload: { itemId: 'bank4' }
    });
    logState('bank4 webhook => data import');
  }, 13500);

  // 14s: bank4 => data import complete => triggers scoring
  setTimeout(() => {
    actor.send({
      type: 'DATA_IMPORT_COMPLETE',
      payload: { itemId: 'bank4' }
    });
    logState('bank4 import complete => scoring');
  }, 14000);

  // 14.5s: bank5 => HISTORICAL_UPDATE => data import
  setTimeout(() => {
    actor.send({
      type: 'HISTORICAL_UPDATE',
      payload: { itemId: 'bank5' }
    });
    logState('bank5 webhook => data import');
  }, 14500);

  // 15s: bank5 => data import complete => triggers scoring => done
  setTimeout(() => {
    actor.send({
      type: 'DATA_IMPORT_COMPLETE',
      payload: { itemId: 'bank5' }
    });
    logState('bank5 import complete => scoring');
  }, 15000);

  // 16s: final scoring complete => finalSummary
  setTimeout(() => {
    actor.send({ type: 'SCORING_COMPLETE' });
    logState('final scoring complete => finalSummary');
  }, 16000);
}

// Run the simulation
simulateFiveBanksParallel();

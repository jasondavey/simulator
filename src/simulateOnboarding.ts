import { createActor } from 'xstate';
import { onboardingMachine } from './onboardingMachine'; // Adjust path as needed

function simulateOnboarding() {
  // 1) Create and start the actor
  const actor = createActor(onboardingMachine).start();

  // Helper to print current state + context
  function logState(message: string) {
    const snapshot = actor.getSnapshot();
    console.log(
      `\n${message}`,
      '\nState value:',
      snapshot.value,
      '\nContext:',
      snapshot.context
    );
  }

  // Initial state
  logState('Initial:');

  // 2) Simulate first Plaid HISTORICAL_UPDATE
  setTimeout(() => {
    actor.send({ type: 'HISTORICAL_UPDATE', payload: { itemId: 'Bank1' } });
    logState('Received HISTORICAL_UPDATE for Bank1');
  }, 500);

  // 3) Another Plaid webhook arrives
  setTimeout(() => {
    actor.send({ type: 'HISTORICAL_UPDATE', payload: { itemId: 'Bank2' } });
    logState('Received HISTORICAL_UPDATE for Bank2');
  }, 1000);

  // 4) Data import completes for Bank1
  setTimeout(() => {
    actor.send({ type: 'DATA_IMPORT_COMPLETE', payload: { itemId: 'Bank1' } });
    logState('DATA_IMPORT_COMPLETE for Bank1');
  }, 2000);

  // 5) The user finishes connecting banks
  setTimeout(() => {
    actor.send({ type: 'USER_CLICK_FINISH' });
    logState('User clicked FINISH');
  }, 2500);

  // 6) Data import completes for Bank2
  setTimeout(() => {
    actor.send({ type: 'DATA_IMPORT_COMPLETE', payload: { itemId: 'Bank2' } });
    logState('DATA_IMPORT_COMPLETE for Bank2 (should trigger scoring)');
  }, 3000);

  // 7) Scoring completes
  setTimeout(() => {
    actor.send({ type: 'SCORING_COMPLETE' });
    logState('SCORING_COMPLETE => Onboarding fully done');
  }, 4000);

  // Optional: If you want to see the bankConnection timing out at 5 seconds,
  // you'd comment out the USER_CLICK_FINISH event or push it beyond 5000 ms
  // so that connecting => timedOut. For instance:
  // setTimeout(() => {
  //   console.log('\n5 seconds passed. No finish => timedOut');
  // }, 5500);
}

// Run the simulation
simulateOnboarding();

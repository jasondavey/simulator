import { createActor } from 'xstate';
import { onboardingMachine } from './onboardingMachine';

function simulate() {
  // 1) Create and start the actor
  const actor = createActor(onboardingMachine).start();

  // 2) Check initial state
  console.log('Initial state:', actor.getSnapshot().value);
  console.log('Context:', actor.getSnapshot().context);

  // 3) Simulate events
  actor.send({ type: 'HISTORICAL_UPDATE', payload: { itemId: 'Bank1' } });
  console.log(
    'After first update:',
    actor.getSnapshot().value,
    actor.getSnapshot().context
  );

  actor.send({ type: 'USER_CLICK_FINISH' });
  console.log(
    'After user clicks finish:',
    actor.getSnapshot().value,
    actor.getSnapshot().context
  );

  actor.send({ type: 'DATA_IMPORT_COMPLETE', payload: { itemId: 'Bank1' } });
  console.log(
    'After import complete:',
    actor.getSnapshot().value,
    actor.getSnapshot().context
  );

  // You can continue sending SCORING_COMPLETE, etc.
}

// Run the simulation
simulate();

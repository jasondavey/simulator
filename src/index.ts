import dotenv from 'dotenv';
import { ProcessContext } from './processContext';
import { createActor } from 'xstate';
import { plaidAccountSyncWorfklow } from './plaidSyncWorkflow';

export async function getGreeting(
  ownerId: string
): Promise<{ greeting: string }> {
  return new Promise((res, rej) => {
    setTimeout(() => {
      if (Math.random() < 0.5) {
        rej();
        return;
      }
      res({
        greeting: `Hello, ${ownerId}!`
      });
    }, 1000);
  });
}

const fetchActor = createActor(plaidAccountSyncWorfklow);
fetchActor.subscribe((state) => {
  console.log('Value:', state.value);
  console.log('Context:', state.context);
});
fetchActor.start();

fetchActor.send({ type: 'FETCH' });

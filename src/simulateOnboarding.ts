import { createActor } from 'xstate';
import { onboardingMachine } from './onboardingMachine';
import dotenv from 'dotenv';
import { FetchAuth0UserProfileHandler } from './fetchAuth0ProfileHandler';
import { FetchVsClientHandler } from './fetchVsClientHandler';
import { InitializeChildDbConnectionHandler } from './initializeChildDbConnectionHandler';
import { InitializeParentDbConnectionHandler } from './initializeParentDbConnectionHandler';
import { Pipeline } from './pipeline';
import { ValidateClientIdHandler } from './validateClientIdHandler';
import { ValidateOwnerIdHandler } from './validateOwnerIdHandler';
import {
  createInitialContext,
  StateMachineContext
} from './stateMachineContext';

dotenv.config();

const simulateFiveBanksParallel = async () => {
  const pipelineContext = createInitialContext({
    process_name: 'Onboarding Plaid Sync',
    clientId: process.argv[3],
    memberId: process.argv[2]
  });

  const preTasks = new Pipeline()
    .use(new ValidateOwnerIdHandler())
    .use(new ValidateClientIdHandler())
    .use(new InitializeParentDbConnectionHandler())
    .use(new FetchVsClientHandler())
    .use(new InitializeChildDbConnectionHandler())
    .use(new FetchAuth0UserProfileHandler());

  // Execute pipeline
  await preTasks.execute(pipelineContext);

  // console.log('Pipeline context after execution:', pipelineContext);
  if (!pipelineContext.auth0UserProfile.email_verified) {
    throw new Error(`Email not verified for user ${pipelineContext.memberId}`);
  }

  const onboardingActor = createActor(onboardingMachine, {
    input: pipelineContext
  }).start();

  console.log('Initial actor context:', onboardingActor.getSnapshot().context);

  onboardingActor.subscribe((state) => {
    console.log('Transition:', state.value);
  });

  const logState = (label: string) => {
    const snapshot = onboardingActor.getSnapshot();
    console.log(`\n[${label}]`);
    console.log('State:', snapshot.value);
    console.log('Context:', snapshot.context);
  };

  logState('Initial');

  setTimeout(() => {
    onboardingActor.send({ type: 'BANK_CONNECTED', itemId: 'bank1' });
    logState('bank1 connected');
  }, 2000);

  setTimeout(() => {
    onboardingActor.send({ type: 'USER_CLICK_FINISH' });
    logState('User clicked finish => bankConnection done');
  }, 2000);
};

simulateFiveBanksParallel();

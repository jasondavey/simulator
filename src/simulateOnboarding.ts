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
import { createInitialContext } from './stateMachineContext';

dotenv.config();

const simulateFiveBanksParallel = async () => {
  const pipelineContext = createInitialContext({
    process_name: 'Onboarding Plaid Sync',
    memberId: process.argv[2],
    clientId: process.argv[3],
    bankConnectionId: process.argv[4]
  });

  const preTasks = new Pipeline()
    .use(new ValidateOwnerIdHandler())
    .use(new ValidateClientIdHandler())
    .use(new InitializeParentDbConnectionHandler())
    .use(new FetchVsClientHandler())
    .use(new InitializeChildDbConnectionHandler())
    .use(new FetchAuth0UserProfileHandler());

  console.log('\nExecuting pipeline...');
  await preTasks.execute(pipelineContext);
  console.log('Pipeline context ready:', {
    clientId: pipelineContext.clientId,
    memberId: pipelineContext.memberId
  });

  if (!pipelineContext.auth0UserProfile.email_verified) {
    throw new Error(`Email not verified for user ${pipelineContext.memberId}`);
  }

  console.log('\nCreating actor...');
  const onboardingActor = createActor(onboardingMachine, {
    input: pipelineContext
  }).start();

  // Detailed state subscription
  onboardingActor.subscribe((state) => {
    console.log('\nState Update:');
    console.log('Current State:', state.value);
    console.log('Bank Successes:', state.context.bankConnectionSuccesses);
    console.log('Webhook Queue:', state.context.webhookSearchQueue);
  });

  const logState = (label: string) => {
    const snapshot = onboardingActor.getSnapshot();
    console.log(`\n[${label}]`);
    console.log('State:', snapshot.value);
    console.log('Bank Successes:', snapshot.context.bankConnectionSuccesses);
    console.log('Webhook Queue:', snapshot.context.webhookSearchQueue);
  };

  logState('Initial State');

  // First timeout - Connect Bank
  setTimeout(() => {
    console.log('\n=== Connecting Bank ===');
    console.log(
      'Before BANK_CONNECTED - Current State:',
      onboardingActor.getSnapshot().value
    );

    onboardingActor.send({ type: 'BANK_CONNECTED', itemId: 'bank1' });

    // Check immediate state after event
    const immediateSnapshot = onboardingActor.getSnapshot();
    console.log('\nImmediate State After BANK_CONNECTED:');
    console.log('State:', immediateSnapshot.value);
    console.log(
      'Bank Successes:',
      immediateSnapshot.context.bankConnectionSuccesses
    );
    console.log('Webhook Queue:', immediateSnapshot.context.webhookSearchQueue);
  }, 2000);

  // Second timeout - Verify State
  setTimeout(() => {
    console.log('\n=== Verifying Final State ===');
    logState('Final State Check');
  }, 3000);

  // Third timeout - User Finish
  setTimeout(() => {
    console.log('\n=== User Finishing ===');
    onboardingActor.send({ type: 'USER_CLICK_FINISH' });
    logState('After User Finish');
  }, 4000);
};

simulateFiveBanksParallel();

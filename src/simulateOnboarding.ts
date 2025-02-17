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
import { StateMachineContext } from './stateMachineContext';

dotenv.config();
/**
 * This simulation has five banks:
 *  - Bank1 fully completes all states (connection -> import -> scoring)
 *    before the user finishes onboarding (USER_CLICK_FINISH).
 *  - Banks 2, 3, 4, 5 connect later, but user doesn't click Finish until
 *    after they've connected. They can do data import / scoring after finishing.
 */
const simulateFiveBanksParallel = async () => {
  let context: StateMachineContext = {
    memberId: process.argv[2],
    clientId: process.argv[3],
    vsClient: null,
    parentDbConnection: null,
    childDbConnection: null,
    auth0UserToken: '',
    process_name: undefined,
    startTime: null,
    endTime: null,
    auth0FetchTime: null,
    errors: undefined,
    processedSummary: undefined,
    webhookReceivedTimestamps: undefined,
    processedItems: undefined,
    isOnboarded: false,
    plaidItemsPollCount: 0,
    plaidItemsConnectionsQueue: [],
    bankConnectionSuccesses: [],
    bankConnectionFailures: [],
    searchQueue: {},
    webhookSearchFailures: [],
    pendingImports: new Set<string>(),
    dataImportFailures: [],
    scoringFailures: [],
    onboarded: false
  };

  const preAmble = new Pipeline()
    .use(new ValidateOwnerIdHandler())
    .use(new ValidateClientIdHandler())
    .use(new InitializeParentDbConnectionHandler())
    .use(new FetchVsClientHandler())
    .use(new InitializeChildDbConnectionHandler())
    .use(new FetchAuth0UserProfileHandler());

  // Execute pipeline
  await preAmble.execute(context);

  // 1) Create & start the agent
  const onboardingActor = createActor(onboardingMachine, {
    input: {
      clientId: process.argv[3],
      memberId: process.argv[2],
      parentDbConnection: context.parentDbConnection!,
      childDbConnection: context.childDbConnection!
    }
  }).start();

  onboardingActor.subscribe((state) => {
    console.log('🚥 Transition:', state.value);
  });
  // Helper to log state + context
  function logState(label: string) {
    const snapshot = onboardingActor.getSnapshot();
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
  // 12s: SCORING_COMPLETE => bank2 done
  // 12.5s: bank3 => HISTORICAL_UPDATE => data import
  // 13s: bank3 => DATA_IMPORT_COMPLETE => triggers scoring => done
  // 13.5s: bank4 => HISTORICAL_UPDATE => data import
  // 14s: bank4 => DATA_IMPORT_COMPLETE => triggers scoring => done
  // 14.5s: bank5 => HISTORICAL_UPDATE => data import
  // 15s: bank5 => DATA_IMPORT_COMPLETE => triggers scoring => final
  // 16s: final scoring complete => finalSummary

  // 2s: bank1 connects
  setTimeout(() => {
    onboardingActor.send({ type: 'BANK_CONNECTED', itemId: 'bank1' });
    logState('bank1 connected');
  }, 2000);

  // 3s: bank2 connects
  //   setTimeout(() => {
  //     onboardingActor.send({ type: 'BANK_CONNECTED', itemId: 'bank2' });
  //     logState('bank2 connected');
  //   }, 3000);

  //   // 4s: bank1 => HISTORICAL_UPDATE => triggers data import
  //   setTimeout(() => {
  //     onboardingActor.send({ type: 'HISTORICAL_UPDATE', payload: { itemId: 'bank1' } });
  //     logState('bank1 webhook => data import');
  //   }, 4000);

  //   // 5s: bank1 => data import complete => triggers scoring
  //   setTimeout(() => {
  //     onboardingActor.send({
  //       type: 'DATA_IMPORT_COMPLETE',
  //       payload: { itemId: 'bank1' }
  //     });
  //     logState('bank1 import complete => scoring');
  //   }, 5000);

  //   // 6s: scoring completes for bank1 => bank1 fully done
  //   setTimeout(() => {
  //     onboardingActor.send({ type: 'SCORING_COMPLETE' });
  //     logState('bank1 scoring complete => bank1 done');
  //   }, 6000);

  //   // 7s: bank3 connects
  //   setTimeout(() => {
  //     onboardingActor.send({ type: 'BANK_CONNECTED', itemId: 'bank3' });
  //     logState('bank3 connected');
  //   }, 7000);

  //   // 8s: bank4 connects
  //   setTimeout(() => {
  //     onboardingActor.send({ type: 'BANK_CONNECTED', itemId: 'bank4' });
  //     logState('bank4 connected');
  //   }, 8000);

  //   // 8.5s: bank5 connects
  //   setTimeout(() => {
  //     onboardingActor.send({ type: 'BANK_CONNECTED', itemId: 'bank5' });
  //     logState('bank5 connected');
  //   }, 8500);

  // 9s: user finishes => onboarded = true, no more connections
  setTimeout(() => {
    onboardingActor.send({ type: 'USER_CLICK_FINISH' });
    logState('User clicked finish => bankConnection done');
  }, 3000);

  //   // 10s: bank2 => HISTORICAL_UPDATE => triggers data import
  //   setTimeout(() => {
  //     onboardingActor.send({
  //       type: 'HISTORICAL_UPDATE',
  //       payload: { itemId: 'bank2' }
  //     });
  //     logState('bank2 webhook => data import');
  //   }, 10000);

  //   // 11s: bank2 => data import complete => triggers scoring
  //   setTimeout(() => {
  //     onboardingActor.send({
  //       type: 'DATA_IMPORT_COMPLETE',
  //       payload: { itemId: 'bank2' }
  //     });
  //     logState('bank2 import complete => scoring');
  //   }, 11000);

  //   // 12s: scoring completes (bank2 done)
  //   setTimeout(() => {
  //     onboardingActor.send({ type: 'SCORING_COMPLETE' });
  //     logState('bank2 scoring complete');
  //   }, 12000);

  //   // 12.5s: bank3 => HISTORICAL_UPDATE => triggers data import
  //   setTimeout(() => {
  //     onboardingActor.send({
  //       type: 'HISTORICAL_UPDATE',
  //       payload: { itemId: 'bank3' }
  //     });
  //     logState('bank3 webhook => data import');
  //   }, 12500);

  //   // 13s: bank3 => data import complete => triggers scoring
  //   setTimeout(() => {
  //     onboardingActor.send({
  //       type: 'DATA_IMPORT_COMPLETE',
  //       payload: { itemId: 'bank3' }
  //     });
  //     logState('bank3 import complete => scoring');
  //   }, 13000);

  //   // 13.5s: bank4 => HISTORICAL_UPDATE => data import
  //   setTimeout(() => {
  //     onboardingActor.send({
  //       type: 'HISTORICAL_UPDATE',
  //       payload: { itemId: 'bank4' }
  //     });
  //     logState('bank4 webhook => data import');
  //   }, 13500);

  //   // 14s: bank4 => data import complete => triggers scoring
  //   setTimeout(() => {
  //     onboardingActor.send({
  //       type: 'DATA_IMPORT_COMPLETE',
  //       payload: { itemId: 'bank4' }
  //     });
  //     logState('bank4 import complete => scoring');
  //   }, 14000);

  //   // 14.5s: bank5 => HISTORICAL_UPDATE => data import
  //   setTimeout(() => {
  //     onboardingActor.send({
  //       type: 'HISTORICAL_UPDATE',
  //       payload: { itemId: 'bank5' }
  //     });
  //     logState('bank5 webhook => data import');
  //   }, 14500);

  //   // 15s: bank5 => data import complete => triggers scoring => done
  //   setTimeout(() => {
  //     onboardingActor.send({
  //       type: 'DATA_IMPORT_COMPLETE',
  //       payload: { itemId: 'bank5' }
  //     });
  //     logState('bank5 import complete => scoring');
  //   }, 15000);

  //   // 16s: final scoring complete => finalSummary
  //   setTimeout(() => {
  //     onboardingActor.send({ type: 'SCORING_COMPLETE' });
  //     logState('final scoring complete => finalSummary');
  //   }, 16000);
};

// Run the simulation
simulateFiveBanksParallel();

import { PlaidItemDao } from './db/plaidItemDao';
import { wait } from './utils/wait';
import { StateMachineContext } from './stateMachineContext';

export const fetchPlaidItem = async (context: StateMachineContext) => {
  const maxPollTimeMs: number = 10 * 60 * 1000; // 10 minutes
  const pollIntervalMs: number = 5000; // 5 seconds

  console.log('🔹 FetchPlaidItemsHandler');

  const startTime = Date.now();
  context.plaidItemsPollCount = 0;

  while (Date.now() - startTime < maxPollTimeMs) {
    context.plaidItemsPollCount++;
    console.log(
      `🔍 Polling Plaid items... attempt #${context.plaidItemsPollCount}`
    );

    // 🔄 Fetch Plaid items from the database
    const items = await PlaidItemDao.getPlaidItemsByOwner(
      context.childDbConnection!,
      context.memberId
    );

    if (items.length > 0) {
      console.log(`✅ Found ${items.length} Plaid items.`);
      //context.plaidItems = items;
    } else {
      console.warn(`⚠️ No Plaid items found yet.`);
    }

    // If onboarding is complete, assume Plaid item list is final
    if (context.isOnboarded) {
      console.log(`✅ User is onboarded. Assuming Plaid item list is final.`);
      break; // Stop polling
    }

    await wait(pollIntervalMs);
  }

  // Capture fetch duration for final successful attempt
  const fetchDuration = (Date.now() - startTime) / 1000;
  context.processedSummary.push({
    itemId: 'PLAID_ITEMS_FETCH',
    status: 'success',
    webhookDelay: `${fetchDuration.toFixed(2)} sec`
  });

  console.log(
    `✅ Finished fetching Plaid items after ${context.plaidItemsPollCount} attempts.`
  );
};

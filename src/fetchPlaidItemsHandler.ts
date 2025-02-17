import { Handler } from './handler';
import { PlaidItemDao } from './db/plaidItemDao';
import { Auth0Service } from './services/auth0Service';
import { wait } from './utils/wait';
import { StateMachineContext } from './stateMachineContext';

export class FetchPlaidItemsHandler implements Handler {
  private readonly maxPollTimeMs = 10 * 60 * 1000; // 10 minutes
  private readonly pollIntervalMs = 5000; // 5 seconds

  async handle(context: StateMachineContext): Promise<void> {
    console.log('🔹 FetchPlaidItemsHandler');

    const startTime = Date.now();
    context.plaidItemsPollCount = 0;

    while (Date.now() - startTime < this.maxPollTimeMs) {
      context.plaidItemsPollCount++;
      console.log(
        `🔍 Polling Plaid items... attempt #${context.plaidItemsPollCount}`
      );

      // 🔄 Fetch the latest Auth0 profile ONCE and update context
      const userProfile = await Auth0Service.fetchUserProfile(context);
      context.isOnboarded =
        userProfile.app_metadata?.onboarding?.is_onboarded === true;

      console.log(
        `🛂 User onboarding status: ${context.isOnboarded ? '✅ Onboarded' : '❌ Still onboarding'}`
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

      await wait(this.pollIntervalMs);
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
  }
}

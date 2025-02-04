import { Handler } from './handler';
import { ProcessContext } from './processContext';
import { PlaidItemDao } from './db/vsPlaidItemDao';

export class FetchPlaidItemsHandler implements Handler {
  async handle(context: ProcessContext): Promise<void> {
    console.log('🔹 FetchPlaidItemsHandler');
    const startFetchTime = Date.now();

    const items = await PlaidItemDao.getPlaidItemsByOwner(
      context.childDbConnection!,
      context.ownerId
    );

    if (items.length === 0) {
      throw new Error(`No Plaid items found for ownerId: ${context.ownerId}`);
    }

    console.log(
      `✅ Found ${items.length} Plaid items for owner ${context.ownerId}`
    );

    // Record success in summary
    const fetchDuration = (Date.now() - startFetchTime) / 1000;
    context.processedSummary.push({
      itemId: 'PLAID_ITEMS_FETCH',
      status: 'success',
      webhookDelay: `${fetchDuration.toFixed(2)} sec`
    });

    // Store items for subsequent steps
    (context as any).plaidItems = items;
  }
}

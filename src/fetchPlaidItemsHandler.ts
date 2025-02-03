import { Handler } from './handler';
import { ProcessContext } from './processContext';

export class FetchPlaidItemsHandler implements Handler {
  async handle(context: ProcessContext): Promise<void> {
    console.log('🔹 FetchPlaidItemsHandler');
    const startFetchTime = Date.now();

    const MOCK_VALID_AUTH0_IDS = new Set([
      'auth0|6723a660523e8e7b009381f4',
      'auth0|abcdef1234567890'
    ]);

    const items = MOCK_VALID_AUTH0_IDS.has(context.ownerId)
      ? ['item-001', 'item-002']
      : [];

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

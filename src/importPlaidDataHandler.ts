import { Handler } from './handler';
import { StateMachineContext } from './stateMachineContext';

export class ImportPlaidDataHandler implements Handler {
  async handle(context: StateMachineContext): Promise<void> {
    console.log('🔹 ImportPlaidDataHandler');

    const webhooks: string[] = (context as any).plaidWebhooks || [];
    for (const itemId of webhooks) {
      await this.importOneItem(context, itemId);
    }
  }

  private async importOneItem(
    context: StateMachineContext,
    itemId: string
  ): Promise<void> {
    try {
      console.log(`Importing Plaid item data (itemId = ${itemId})`);

      context.processedItems.add(itemId);
      const receivedTime = context.webhookReceivedTimestamps[itemId] || null;
      const webhookDelay = receivedTime
        ? `${((Date.now() - receivedTime) / 1000).toFixed(2)} sec`
        : 'Unknown';

      context.processedSummary.push({
        itemId,
        status: 'success',
        webhookDelay
      });
      console.log(`✅ Successfully imported data for itemId = ${itemId}`);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      context.errors.push(
        `Error importing Plaid data for itemId ${itemId}: ${errorMessage}`
      );
      context.processedSummary.push({
        itemId,
        status: 'failure',
        error: errorMessage
      });
      console.error(`❌ ${errorMessage}`);
    }
  }
}

import { Handler } from './handler';
import { ProcessContext } from './processContext';
import { PlaidWebhookDao } from './db/plaidWebhookDao';
export class FetchHistoricalWebhooksHandler implements Handler {
  async handle(context: ProcessContext): Promise<void> {
    console.log('🔹 FetchHistoricalWebhooksHandler');

    const itemIds = (context as any).plaidItems || [];

    const now = Date.now();
    for (const itemId of itemIds) {
      const webhook = await PlaidWebhookDao.getWebhookReadyForImportByItemId(
        context.childDbConnection!,
        itemId
      );

      if (!webhook) {
        console.log(`No webhooks found for item_id ${itemId}`);
        continue;
      }
      context.webhookReceivedTimestamps[itemId] = now;
      //call import process
    }
  }
}

import { Handler } from './handler';
import { ProcessContext } from './processContext';

export class FetchHistoricalWebhooksHandler implements Handler {
  async handle(context: ProcessContext): Promise<void> {
    console.log('🔹 FetchHistoricalWebhooksHandler');

    const items = (context as any).plaidItems || [];

    const webhooks = items.length > 0 ? ['wh-101', 'wh-102'] : [];
    const now = Date.now();
    for (const item of webhooks) {
      context.webhookReceivedTimestamps[item] = now;
    }

    (context as any).plaidWebhooks = webhooks;
    console.log(`✅ Historical webhooks: ${webhooks.join(', ')}`);
  }
}

import { Handler } from './handler';
import { ProcessContext } from './processContext';
import { PlaidWebhookDao } from './db/plaidWebhookDao';
import { PlaidItemDao } from './db/plaidItemDao';
import { wait } from './utils/wait';
import { MailGunService } from './services/mailgunService';

export class WaitForAllWebhooksHandler implements Handler {
  private readonly maxPollTimeMs = 10 * 60 * 1000; // 10 minutes
  private readonly pollIntervalMs = 5000; // 5 seconds

  async handle(context: ProcessContext): Promise<void> {
    console.log('🔹 WaitForAllWebhooksHandler');

    const start = Date.now();
    context.webhookPollCount = 0;
    const processedWebhooks = new Set<string>();

    while (Date.now() - start < this.maxPollTimeMs) {
      context.webhookPollCount++;
      console.log(
        `🔄 Polling for Plaid webhooks... attempt #${context.webhookPollCount}`
      );

      // 🔄 If onboarding is NOT complete, re-fetch Plaid items
      if (!context.isOnboarded) {
        console.log(
          '🛂 User is still onboarding. Checking for new Plaid items...'
        );
        const newPlaidItems = await PlaidItemDao.getPlaidItemsByOwner(
          context.childDbConnection!,
          context.ownerId
        );

        if (newPlaidItems.length > context.plaidItems.length) {
          console.log(
            `🆕 Found new Plaid items. Updating from ${context.plaidItems.length} to ${newPlaidItems.length}`
          );
          context.plaidItems = newPlaidItems;
        }
      }

      for (const item of context.plaidItems) {
        const webHook = await PlaidWebhookDao.getWebhookReadyForImportByItemId(
          context.childDbConnection!,
          item.item_id
        );
        console.log(
          `📥 Transactions ready for import for plaid item ${webHook.sourceWebhook.item_id}.`
        );

        // Import Plaid data immediately
        //const importHandler = new ImportPlaidDataHandler();
        //await importHandler.handleWebhook(context, webhook);
        // webHook.resolved_at = new Date().toISOString();
        // await PlaidWebhookDao.upsertWebhook(
        //   context.childDbConnection!,
        //   webHook.id
        // );

        processedWebhooks.add(webHook.sourceWebhook.item_id);
      }

      // If all expected webhooks are processed, exit loop
      if (processedWebhooks.size >= context.plaidItems.length) {
        console.log(
          `✅ All required webhooks processed (${processedWebhooks.size}/${context.plaidItems.length}).`
        );
        return;
      }

      await wait(this.pollIntervalMs);
    }

    // Timeout reached before processing all webhooks
    const errorMsg = `❌ Timed out waiting for ${context.plaidItems.length} webhooks to be processed. Only found ${processedWebhooks.size}.`;
    context.errors.push(errorMsg);
    console.error(errorMsg);
    await MailGunService.sendReportAndExit(context);
  }
}

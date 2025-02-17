import PlaidWebhookDao from './db/plaidWebhookDao';
import { StateMachineContext } from './stateMachineContext';

export const startPollingPlaidWebhooks = async (
  context: StateMachineContext
) => {
  const pollingInterval = 5000; // 5 seconds
  const timeoutDuration = 10 * 60 * 1000; // 10 minutes

  // Resolve immediately if queue is empty
  if (context.plaidItemsConnectionsQueue.length === 0) {
    console.log('No Plaid items to poll. Exiting.');
    return;
  }

  let timeoutId: NodeJS.Timeout;
  let intervalId: NodeJS.Timeout;

  const poll = async () => {
    try {
      const results = await Promise.all(
        context.plaidItemsConnectionsQueue.map(async (plaidItemId) => {
          const webhook =
            await PlaidWebhookDao.getWebhookReadyForImportByItemId(
              context.childDbConnection!,
              plaidItemId
            );

          if (!webhook) {
            console.log(`No webhooks found for item_id ${plaidItemId}`);
            return null;
          }

          console.log(`Found webhook for item_id ${plaidItemId}:`, webhook);
          return webhook;
        })
      );

      // Stop polling if any webhook data is received
      if (results.some((webhook) => webhook !== null)) {
        console.log('Webhook data received. Stopping polling.');
        clearInterval(intervalId);
        clearTimeout(timeoutId);
      }
    } catch (error) {
      console.error('Error polling Plaid webhooks:', error);
    }
  };

  // Start polling every 5 seconds
  intervalId = setInterval(poll, pollingInterval);

  // Set timeout to stop polling after 10 minutes
  timeoutId = setTimeout(() => {
    console.log('Polling timed out after 10 minutes. Stopping.');
    clearInterval(intervalId);
  }, timeoutDuration);
};

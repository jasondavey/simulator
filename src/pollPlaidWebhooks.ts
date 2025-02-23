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
      // Create a new array to store items that still need polling
      const remainingItems: string[] = [];

      // Check each item individually to handle them separately
      for (const plaidItemId of context.plaidItemsConnectionsQueue) {
        const webhook = await PlaidWebhookDao.getWebhookReadyForImportByItemId(
          context.childDbConnection!,
          plaidItemId
        );

        if (!webhook) {
          console.log(`No webhooks found for item_id ${plaidItemId}`);
          remainingItems.push(plaidItemId);
        } else {
          console.log(`Found webhook for item_id ${plaidItemId}:`, webhook);
        }
      }

      // Update the queue with only the items that still need polling
      context.plaidItemsConnectionsQueue = remainingItems;

      // Stop polling if all webhooks have been found
      if (remainingItems.length === 0) {
        console.log('All webhooks received. Stopping polling.');
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

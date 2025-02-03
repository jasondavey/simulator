import { Handler } from './handler';
import { ProcessContext } from './processContext';
import { MailGunService } from './services/mailgunService';

export class CompletionHandler implements Handler {
  async handle(context: ProcessContext): Promise<void> {
    console.log('🔹 CompletionHandler');
    context.endTime = Date.now();
    console.log('✅ All Plaid items processed.');
    await sendCompletionEmail(context);
  }
}

async function sendCompletionEmail(context: ProcessContext) {
  const subject = `✅ Verascore Calculation Complete for ${context.ownerId}`;

  const processedReport = context.processedSummary
    .map(
      (item) =>
        `- ${item.itemId}: ${item.status.toUpperCase()} (Webhook Delay: ${item.webhookDelay})${
          item.error ? ` (Error: ${item.error})` : ''
        }`
    )
    .join('\n');

  const body = `
      ✅ The Plaid processing for ownerId: ${context.ownerId} has been successfully completed.
  
      Request Details:
      - Start Time: ${context.startTime ? new Date(context.startTime).toISOString() : 'Unknown'}
      - End Time: ${context.endTime ? new Date(context.endTime).toISOString() : 'Not completed'}
      - Total Processing Time: ${
        context.startTime && context.endTime
          ? ((context.endTime - context.startTime) / 1000).toFixed(2)
          : 'Unknown'
      } seconds
      - Auth0 Profile Fetch Time: ${context.auth0FetchTime ? context.auth0FetchTime.toFixed(2) : 'Unknown'} seconds
  
      📋 **Processing Summary**
      ${processedReport || 'No items processed.'}
  
      🚨 **Errors Encountered**
      ${context.errors.length > 0 ? context.errors.join('\n') : 'No errors occurred.'}
    `;

  await MailGunService.sendEmail(subject, body);
}

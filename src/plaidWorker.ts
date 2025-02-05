import dotenv from 'dotenv';
import { ProcessContext } from './processContext';
import { CompletionHandler } from './completionHandler';
import { FetchAuth0UserProfileHandler } from './fetchAuth0ProfileHandler';
import { FetchPlaidItemsHandler } from './fetchPlaidItemsHandler';
import { FetchVsClientHandler } from './fetchVsClientHandler';
import { ImportPlaidDataHandler } from './importPlaidDataHandler';
import { Pipeline } from './pipeline';
import { ValidateClientIdHandler } from './validateClientIdHandler';
import { ValidateOwnerIdHandler } from './validateOwnerIdHandler';
import { InitializeParentDbConnectionHandler } from './initializeParentDbConnectionHandler';
import { InitializeChildDbConnectionHandler } from './initializeChildDbConnectionHandler';
import { MailGunService } from './services/mailgunService';
import { WaitForAllWebhooksHandler } from './waitForAllWebhooksHandler';

dotenv.config();

const TIMEOUT_MS = parseInt(process.env.TIMEOUT_MS || '600000', 10);
const FAUNA_DATABASE_VS_PARENT_ROOT_KEY =
  process.env.FAUNA_DATABASE_VS_PARENT_ROOT_KEY!;
if (!FAUNA_DATABASE_VS_PARENT_ROOT_KEY) {
  throw new Error('FAUNA_DATABASE_VS_PARENT_ROOT_KEY is not defined');
}

let timeoutHandle: NodeJS.Timeout | null = null;
let errors: string[] = [];

async function main() {
  try {
    const ownerId = process.argv[2];
    const clientId = process.argv[3];

    if (!ownerId) {
      throw new Error(
        'Missing ownerId argument. Please provide a valid Auth0 ID.'
      );
    }

    if (!clientId) {
      throw new Error(
        'Missing clientId argument. Please provide a valid VeraScore client ID.'
      );
    }

    console.log(`🚀 Starting Plaid worker for ownerId=${ownerId}`);

    const context: ProcessContext = {
      ownerId,
      clientId,
      startTime: Date.now(),
      endTime: null,
      auth0FetchTime: null,
      processedItems: new Set<string>(),
      processedSummary: [],
      webhookReceivedTimestamps: {},
      errors: [],
      parentDbConnection: null,
      childDbConnection: null,
      vsClient: null,
      onboardingPollCount: 0,
      webhookPollCount: 0,
      plaidItemsPollCount: 0,
      process_name: process.env.PROCESS_NAME!,
      auth0UserToken: '',
      isOnboarded: undefined,
      plaidItems: []
    };

    // Timeout handler
    timeoutHandle = setTimeout(async () => {
      context.errors.push('⏳ Process timed out!');
      await MailGunService.sendReportAndExit(context);
    }, TIMEOUT_MS);

    const pipeline = new Pipeline()
      .use(new ValidateOwnerIdHandler())
      .use(new ValidateClientIdHandler())
      .use(new InitializeParentDbConnectionHandler())
      .use(new FetchVsClientHandler())
      .use(new InitializeChildDbConnectionHandler())
      .use(new FetchAuth0UserProfileHandler())
      .use(new FetchPlaidItemsHandler())
      // .use(new FetchHistoricalWebhooksHandler())
      .use(new WaitForAllWebhooksHandler())
      .use(new ImportPlaidDataHandler())
      .use(new CompletionHandler());

    // Execute pipeline
    await pipeline.execute(context);

    if (timeoutHandle) clearTimeout(timeoutHandle);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    errors.push(`Fatal error in main: ${errorMessage}`);
    console.error(`❌ Fatal error in main: ${errorMessage}`);
    await MailGunService.sendReportAndExit({
      ownerId: 'unknown',
      clientId: 'unknown',
      startTime: null,
      endTime: null,
      auth0FetchTime: null,
      processedItems: new Set<string>(),
      processedSummary: [],
      webhookReceivedTimestamps: {},
      errors,
      parentDbConnection: null,
      childDbConnection: null,
      vsClient: null,
      onboardingPollCount: 0,
      webhookPollCount: 0,
      plaidItemsPollCount: 0,
      process_name: process.env.PROCESS_NAME!,
      auth0UserToken: '',
      isOnboarded: false,
      plaidItems: []
    });
  }
}

void main();

import mailgun from 'mailgun-js';
import dotenv from 'dotenv';
import { createVsParentDbConnection } from './services/faunaService';
import { ClientRegistryDao } from './db/vsClientRegistryDao';
import { VeraScoreClient, Auth0Profile } from './db/models';
import { Auth0Service } from './services/auth0Service';
import { ProcessContext } from './processContext';
import { CompletionHandler } from './completionHandler';
import { FetchAuth0UserProfileHandler } from './fetchAuth0ProfileHandler';
import { FetchHistoricalWebhooksHandler } from './fetchHistoricalWebhooksHandler';
import { FetchPlaidItemsHandler } from './fetchPlaidItemsHandler';
import { FetchVsClientHandler } from './fetchVsClientHandler';
import { ImportPlaidDataHandler } from './importPlaidDataHandler';
import { Pipeline } from './pipeline';
import { ValidateClientIdHandler } from './validateClientIdHandler';
import { ValidateOwnerIdHandler } from './validateOwnerIdHandler';
import { InitializeParentDbConnectionHandler } from './initializeParentDbConnectionHandler';
dotenv.config();

const MAILGUN_API_KEY = process.env.MAILGUN_API_KEY!;
const MAILGUN_DOMAIN = process.env.MAILGUN_DOMAIN!;
const RECIPIENT_EMAIL =
  process.env.RECIPIENT_EMAIL || 'platform@myverascore.com';
const PLATFORM_EMAIL_SENDER =
  process.env.PLATFORM_EMAIL_SENDER || `no-reply@${MAILGUN_DOMAIN}`;
const TIMEOUT_MS = parseInt(process.env.TIMEOUT_MS || '600000', 10);
const INTERVAL_MS = parseInt(process.env.INTERVAL_MS || '10000', 10);
const PROCESS_NAME = process.env.PROCESS_NAME;
const FAUNA_DATABASE_VS_PARENT_ROOT_KEY =
  process.env.FAUNA_DATABASE_VS_PARENT_ROOT_KEY!;
if (!FAUNA_DATABASE_VS_PARENT_ROOT_KEY) {
  throw new Error('FAUNA_DATABASE_VS_PARENT_ROOT_KEY is not defined');
}

const mg = mailgun({ apiKey: MAILGUN_API_KEY, domain: MAILGUN_DOMAIN });

let webhookReceivedTimestamps: { [key: string]: number } = {}; // Tracks when webhooks were received
let isProcessingComplete = false;
let timeoutHandle: NodeJS.Timeout | null = null;
let errors: string[] = [];

const MOCK_VALID_AUTH0_IDS = new Set([
  'auth0|6723a660523e8e7b009381f4',
  'auth0|abcdef1234567890'
]);

function validateOwnerIdFormatting(ownerId: string): void {
  const auth0Pattern = /^auth0\|[a-zA-Z0-9]+$/;

  if (!auth0Pattern.test(ownerId)) {
    throw new Error(
      `Invalid Auth0 ID format: ${ownerId}. Must follow 'auth0|xxxxxxxx' format.`
    );
  }

  if (!MOCK_VALID_AUTH0_IDS.has(ownerId)) {
    throw new Error(`Auth0 ID ${ownerId} does not exist.`);
  }

  console.log(`✅ Valid owner format: ${ownerId}`);
}

function validateClientIdFormatting(clientId: string): void {
  const guidPattern =
    /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/;

  if (!guidPattern.test(clientId)) {
    throw new Error(
      `Invalid VeraScore Client ID format: ${clientId}. Must be guid.`
    );
  }

  console.log(`✅ Valid client format: ${clientId}`);
}

async function fetchVsClientFromRegistry(
  clientId: string
): Promise<VeraScoreClient> {
  try {
    console.log(`Fetching client by id: ${clientId}`);

    const parentDbConnection = await createVsParentDbConnection(
      FAUNA_DATABASE_VS_PARENT_ROOT_KEY
    );

    const client = await ClientRegistryDao.getClientByIdActiveOnly(
      parentDbConnection,
      clientId
    );
    console.info(`✅ VeraScore Client Fetched: ${client.partner_name}`);
    return client;
  } catch (error) {
    throw new Error(
      `Failed to connect to client registry. ${(error as Error).message}`
    );
  }
}

async function fetchPlaidItemsByOwner(
  context: ProcessContext
): Promise<string[]> {
  try {
    console.log(`Fetching Plaid items by owner: ${context.ownerId}`);
    const startFetchTime = Date.now();

    await wait(300); // Simulating API call delay

    const items = MOCK_VALID_AUTH0_IDS.has(context.ownerId)
      ? ['item-001', 'item-002']
      : [];

    if (items.length === 0) {
      throw new Error(`No Plaid items found for ownerId: ${context.ownerId}`);
    }

    console.log(
      `✅ Found ${items.length} Plaid items for owner ${context.ownerId}`
    );

    // Store success info in context
    const fetchDuration = (Date.now() - startFetchTime) / 1000;
    context.processedSummary.push({
      itemId: 'PLAID_ITEMS_FETCH',
      status: 'success',
      webhookDelay: `${fetchDuration.toFixed(2)} sec`
    });

    return items;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    context.errors.push(`Error fetching Plaid items: ${errorMessage}`);
    console.error(`❌ ${errorMessage}`);

    await sendReportAndExit(context); // Exit process if fetching Plaid items fails
    return [];
  }
}

async function fetchHistoricalUpdateWebhooks(
  items: string[]
): Promise<string[]> {
  try {
    console.log(`Fetching historical update webhooks for items: ${items}`);
    await wait(300);

    const webhooks = items.length > 0 ? ['wh-101', 'wh-102'] : [];

    const now = Date.now();
    for (const item of webhooks) {
      webhookReceivedTimestamps[item] = now;
    }

    return webhooks;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    errors.push(`Error fetching webhooks: ${errorMessage}`);
    console.error(`❌ ${errorMessage}`);
    return [];
  }
}

async function importPlaidData(
  context: ProcessContext,
  itemId: string
): Promise<void> {
  try {
    console.log(`Importing Plaid item data (itemId = ${itemId})`);
    await wait(200);
    context.processedItems.add(itemId);

    const receivedTime = context.webhookReceivedTimestamps[itemId] || null;
    const webhookDelay = receivedTime
      ? `${((Date.now() - receivedTime) / 1000).toFixed(2)} sec`
      : 'Unknown';

    context.processedSummary.push({ itemId, status: 'success', webhookDelay });
    console.log(`✅ Successfully imported data for itemId = ${itemId}`);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
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

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchAuth0UserProfile(
  context: ProcessContext,
  vsClient: VeraScoreClient
): Promise<Auth0Profile> {
  try {
    console.log(`Fetching Auth0 user profile for ownerId: ${context.ownerId}`);
    const startFetchTime = Date.now();

    const auth0UserToken = await Auth0Service.getAuth0UserApiToken(vsClient);

    const userProfile = await Auth0Service.getUserByAuth0Id(
      auth0UserToken,
      context.ownerId,
      vsClient.app_tenant_domain
    );

    if (!userProfile) {
      throw new Error(`User profile not found for ownerId: ${context.ownerId}`);
    }

    // Store duration in context
    context.auth0FetchTime = (Date.now() - startFetchTime) / 1000;

    console.log(
      `✅ Auth0 user profile fetched in ${context.auth0FetchTime.toFixed(2)} seconds`
    );
    return userProfile;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    context.errors.push(`Error fetching Auth0 user profile: ${errorMessage}`);
    console.error(`❌ ${errorMessage}`);

    await sendReportAndExit(context); // Exit process if Auth0 profile fetch fails
    throw error;
  }
}

async function processOwner(context: ProcessContext): Promise<void> {
  if (isProcessingComplete) return;

  try {
    let vsClient: VeraScoreClient;
    let userProfile: Auth0Profile;

    try {
      vsClient = await fetchVsClientFromRegistry(context.clientId);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      context.errors.push(`Error fetching VeraScore client: ${errorMessage}`);
      console.error(`❌ ${errorMessage}`);
      await sendReportAndExit(context);
      return;
    }

    userProfile = await fetchAuth0UserProfile(context, vsClient);

    console.log(`✅ User profile fetched: ${userProfile.name}`);

    const items = await fetchPlaidItemsByOwner(context);
    if (!items) return;

    const webhooks = await fetchHistoricalUpdateWebhooks(items);

    for (const itemId of webhooks) {
      await importPlaidData(context, itemId);
    }

    console.log('✅ All Plaid items processed.');
    isProcessingComplete = true;
    context.endTime = Date.now();

    if (timeoutHandle) clearTimeout(timeoutHandle);

    await sendCompletionEmail(context);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    context.errors.push(`Process Owner Error: ${errorMessage}`);
    console.error(`❌ ${errorMessage}`);
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

  await sendEmail(subject, body);
}

async function sendReportAndExit(context: ProcessContext) {
  const subject = `❌ ${PROCESS_NAME} Failed for ${context.ownerId}`;
  const body = `
    ❌ The process encountered a critical error and was unable to complete.

    🚨 Errors Encountered:
    ${context.errors.join('\n') || 'No detailed errors recorded.'}

    ❗ Stopping execution.
  `;

  await sendEmail(subject, body);
  console.error(
    `❌ Critical failure: ${PROCESS_NAME} stopping for ownerId=${context.ownerId}`
  );
  process.exit(1);
}

async function sendEmail(subject: string, body: string) {
  try {
    console.log(`📧 Sending email: ${subject}`);

    const emailData = {
      from: `Verascore Platform <${PLATFORM_EMAIL_SENDER}>`,
      to: RECIPIENT_EMAIL,
      subject,
      text: body
    };

    await mg.messages().send(emailData);
    console.log('✅ Email sent successfully.');
  } catch (error) {
    console.error('❌ Failed to send email:', error);
  }
}
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

    // Initialize context
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
      vsClient: null
    };

    // Timeout handler
    timeoutHandle = setTimeout(async () => {
      context.errors.push('⏳ Process timed out!');
      await sendReportAndExit(context);
    }, TIMEOUT_MS);

    const pipeline = new Pipeline()
      .use(new ValidateOwnerIdHandler())
      .use(new ValidateClientIdHandler())
      .use(new InitializeParentDbConnectionHandler())
      .use(new FetchVsClientHandler())
      .use(new FetchAuth0UserProfileHandler())
      .use(new FetchPlaidItemsHandler())
      .use(new FetchHistoricalWebhooksHandler())
      .use(new ImportPlaidDataHandler())
      .use(new CompletionHandler());

    // Execute pipeline
    await pipeline.execute(context);

    isProcessingComplete = true;
    if (timeoutHandle) clearTimeout(timeoutHandle);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    errors.push(`Fatal error in main: ${errorMessage}`);
    console.error(`❌ Fatal error in main: ${errorMessage}`);
    await sendReportAndExit({
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
      vsClient: null
    });
  }
}

void main();

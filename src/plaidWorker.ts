#!/usr/bin/env ts-node
import mailgun from "mailgun-js";
import dotenv from "dotenv";

dotenv.config(); // Load environment variables

// Load Configurations
const MAILGUN_API_KEY = process.env.MAILGUN_API_KEY!;
const MAILGUN_DOMAIN = process.env.MAILGUN_DOMAIN!;
const RECIPIENT_EMAIL =
  process.env.RECIPIENT_EMAIL || "platform@myverascore.com";
const PLATFORM_EMAIL_SENDER =
  process.env.PLATFORM_EMAIL_SENDER || `no-reply@${MAILGUN_DOMAIN}`;
const TIMEOUT_MS = parseInt(process.env.TIMEOUT_MS || "600000", 10); // Default: 10 min
const INTERVAL_MS = parseInt(process.env.INTERVAL_MS || "10000", 10); // Default: 10 sec

// Initialize Mailgun
const mg = mailgun({ apiKey: MAILGUN_API_KEY, domain: MAILGUN_DOMAIN });

// Track processed items & errors
let processedItems = new Set<string>();
let processedSummary: { itemId: string; status: string; error?: string }[] = [];
let isProcessingComplete = false;
let startTime: number | null = null;
let endTime: number | null = null;
let timeoutHandle: NodeJS.Timeout | null = null;
let errors: string[] = [];

// Mock Database of Valid Owner IDs
const MOCK_VALID_AUTH0_IDS = new Set([
  "auth0|6723a660523e8e7b009381f4",
  "auth0|abcdef1234567890",
]);

// Validate Owner ID
function validateOwnerId(ownerId: string): void {
  const auth0Pattern = /^auth0\|[a-zA-Z0-9]+$/;

  if (!auth0Pattern.test(ownerId)) {
    throw new Error(
      `Invalid Auth0 ID format: ${ownerId}. Must follow 'auth0|xxxxxxxx' format.`
    );
  }

  if (!MOCK_VALID_AUTH0_IDS.has(ownerId)) {
    throw new Error(`Auth0 ID ${ownerId} does not exist.`);
  }
}

// Fetch Plaid Items
async function fetchPlaidItemsByOwner(ownerId: string): Promise<string[]> {
  try {
    console.log(`Fetching Plaid items by owner: ${ownerId}`);
    await wait(300);

    const items = MOCK_VALID_AUTH0_IDS.has(ownerId)
      ? ["item-001", "item-002"]
      : [];

    if (items.length === 0) {
      throw new Error(`No Plaid items found for ownerId: ${ownerId}`);
    }

    return items;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    errors.push(`Error fetching Plaid items: ${errorMessage}`);
    console.error(`❌ ${errorMessage}`);
    await sendReportAndExit(ownerId);
    return [];
  }
}

// Fetch Webhooks
async function fetchHistoricalUpdateWebhooks(
  items: string[]
): Promise<string[]> {
  try {
    console.log(`Fetching historical update webhooks for items: ${items}`);
    await wait(300);
    return items.length > 0 ? ["wh-101", "wh-102"] : [];
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    errors.push(`Error fetching webhooks: ${errorMessage}`);
    console.error(`❌ ${errorMessage}`);
    return [];
  }
}

// Import Plaid Data with Status Tracking
async function importPlaidData(itemId: string): Promise<void> {
  try {
    console.log(`Importing Plaid item data (itemId = ${itemId})`);
    await wait(500);
    processedItems.add(itemId);
    processedSummary.push({ itemId, status: "success" });
    console.log(`✅ Successfully imported data for itemId = ${itemId}`);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    errors.push(
      `Error importing Plaid data for itemId ${itemId}: ${errorMessage}`
    );
    processedSummary.push({ itemId, status: "failure", error: errorMessage });
    console.error(`❌ ${errorMessage}`);
  }
}

// Wait Function
function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Process Owner Data
async function processOwner(ownerId: string): Promise<void> {
  if (isProcessingComplete) return;

  try {
    if (!startTime) startTime = Date.now();

    const items = await fetchPlaidItemsByOwner(ownerId);
    if (!items) return; // If fetching items failed completely, exit.

    const webhooks = await fetchHistoricalUpdateWebhooks(items);

    for (const itemId of webhooks) {
      await importPlaidData(itemId);
    }

    console.log("✅ All Plaid items processed.");
    isProcessingComplete = true;
    endTime = Date.now();

    if (timeoutHandle) clearTimeout(timeoutHandle);

    await sendCompletionEmail(ownerId);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    errors.push(`Process Owner Error: ${errorMessage}`);
    console.error(`❌ ${errorMessage}`);
  }
}

// Send Completion Email with Summary
async function sendCompletionEmail(ownerId: string) {
  const subject = `✅ Verascore Calculation Complete for ${ownerId}`;

  const processedReport = processedSummary
    .map(
      (item) =>
        `- ${item.itemId}: ${item.status.toUpperCase()}${
          item.error ? ` (Error: ${item.error})` : ""
        }`
    )
    .join("\n");

  const body = `
    ✅ The Plaid processing for ownerId: ${ownerId} has been successfully completed.

    Request Details:
    - Start Time: ${startTime ? new Date(startTime).toISOString() : "Unknown"}
    - End Time: ${endTime ? new Date(endTime).toISOString() : "Not completed"}
    - Total Processing Time: ${
      startTime && endTime
        ? ((endTime - startTime) / 1000).toFixed(2)
        : "Unknown"
    } seconds

    📋 **Processing Summary**
    ${processedReport || "No items processed."}

    🚨 **Errors Encountered**
    ${errors.length > 0 ? errors.join("\n") : "No errors occurred."}
  `;

  await sendEmail(subject, body);
}

// Send Report & Exit on Critical Error
async function sendReportAndExit(ownerId: string) {
  const subject = `❌ Verascore Processing Failed for ${ownerId}`;
  const body = `
    ❌ The process encountered a critical error and was unable to complete.

    🚨 Errors Encountered:
    ${errors.join("\n")}

    Stopping execution.
  `;

  await sendEmail(subject, body);
  process.exit(1);
}

// Send Email
async function sendEmail(subject: string, body: string) {
  try {
    console.log(`📧 Sending email: ${subject}`);

    const emailData = {
      from: `Verascore Platform <${PLATFORM_EMAIL_SENDER}>`,
      to: RECIPIENT_EMAIL,
      subject,
      text: body,
    };

    await mg.messages().send(emailData);
    console.log("✅ Email sent successfully.");
  } catch (error) {
    console.error("❌ Failed to send email:", error);
  }
}

// Main Execution
async function main() {
  try {
    const ownerId = process.argv[2];

    if (!ownerId) {
      throw new Error(
        "Missing ownerId argument. Please provide a valid Auth0 ID."
      );
    }

    validateOwnerId(ownerId);
    console.log(`🚀 Starting Plaid worker for ownerId=${ownerId}`);

    timeoutHandle = setTimeout(async () => {
      errors.push("⏳ Process timed out!");
      await sendReportAndExit(ownerId);
    }, TIMEOUT_MS);

    await processOwner(ownerId);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    errors.push(`Fatal error: ${errorMessage}`);
    console.error(`❌ Fatal error: ${errorMessage}`);
    await sendReportAndExit("unknown");
  }
}

void main();

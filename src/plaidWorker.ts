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

interface PlaidItem {
  id: string;
  ownerId: string;
}

interface PlaidWebhook {
  id: string;
  itemId: string;
  webhookType: string;
}

// Mock Data
const MOCK_PLAID_ITEMS: PlaidItem[] = [
  { id: "item-001", ownerId: "owner123" },
  { id: "item-002", ownerId: "owner123" },
  { id: "item-003", ownerId: "owner456" },
];

const MOCK_WEBHOOKS: PlaidWebhook[] = [
  { id: "wh-101", itemId: "item-001", webhookType: "historical update" },
  { id: "wh-102", itemId: "item-002", webhookType: "historical update" },
  { id: "wh-103", itemId: "item-003", webhookType: "historical update" },
];

// Track processed items
let processedItems = new Set<string>();
let isProcessingComplete = false;
let startTime: number | null = null;
let endTime: number | null = null;
let timeoutHandle: NodeJS.Timeout | null = null;

async function fetchPlaidItemsByOwner(ownerId: string): Promise<PlaidItem[]> {
  try {
    console.log(`fetch plaid items by owner: ${ownerId}`);
    await wait(300);

    const items = MOCK_PLAID_ITEMS.filter((item) => item.ownerId === ownerId);

    if (items.length === 0) {
      throw new Error(`❌ No Plaid items found for ownerId: ${ownerId}`);
    }

    return items;
  } catch (error) {
    console.error("Error fetching Plaid items:", error);
    await sendErrorEmail("Error Fetching Plaid Items", error, { ownerId });
    process.exit(1);
  }
}

async function fetchHistoricalUpdateWebhooks(
  items: PlaidItem[]
): Promise<PlaidWebhook[]> {
  try {
    console.log(
      'fetch all webhooks that are type "historical updates" by those items'
    );
    const itemIds = items.map((i) => i.id);
    await wait(300);
    return MOCK_WEBHOOKS.filter(
      (wh) =>
        itemIds.includes(wh.itemId) && wh.webhookType === "historical update"
    );
  } catch (error) {
    console.error("Error fetching webhooks:", error);
    await sendErrorEmail("Error Fetching Webhooks", error, {});
    return [];
  }
}

async function importPlaidData(itemId: string): Promise<void> {
  try {
    console.log(
      `if webhook available, import plaid item data (itemId = ${itemId}) into our database`
    );
    await wait(500);
    console.log(`Imported data for itemId = ${itemId} successfully.`);
    processedItems.add(itemId);
  } catch (error) {
    console.error(`Error importing Plaid data for itemId ${itemId}:`, error);
    await sendErrorEmail("Error Importing Plaid Data", error, { itemId });
  }
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function processOwner(ownerId: string): Promise<void> {
  if (isProcessingComplete) return;

  try {
    if (!startTime) startTime = Date.now();

    const items = await fetchPlaidItemsByOwner(ownerId);
    const webhooks = await fetchHistoricalUpdateWebhooks(items);

    const pendingItems = webhooks
      .filter((wh) => !processedItems.has(wh.itemId))
      .map((wh) => wh.itemId);

    if (pendingItems.length === 0) {
      console.log("All Plaid items have been processed.");
      isProcessingComplete = true;
      endTime = Date.now();

      if (timeoutHandle) clearTimeout(timeoutHandle);

      if (startTime && endTime) {
        console.log(
          `Total processing time: ${(endTime - startTime) / 1000} seconds`
        );
      }

      await sendCompletionEmail(ownerId);
      startVeraScorerProcess();
      return;
    }

    for (const itemId of pendingItems) {
      await importPlaidData(itemId);
    }

    console.log(
      "keep going until all items with webhooks have been completed\n"
    );
  } catch (error) {
    console.error("Error in processOwner:", error);
    await sendErrorEmail("Process Owner Error", error, { ownerId });
  }
}

function startVeraScorerProcess(): void {
  console.log("=== Start VeraScorer Process ===");
  console.log("Running VeraScorer process...");
  console.log("VeraScorer process completed.");
}

async function sendEmail(subject: string, body: string) {
  try {
    console.log(`Sending email: ${subject}`);

    const emailData = {
      from: `Verascore Platform <${PLATFORM_EMAIL_SENDER}>`,
      to: RECIPIENT_EMAIL,
      subject,
      text: body,
    };

    await mg.messages().send(emailData);
    console.log("Email sent successfully.");
  } catch (error) {
    console.error("Failed to send email:", error);
  }
}

async function sendCompletionEmail(ownerId: string) {
  const subject = `✅ Verascore Calculation Complete for ${ownerId}`;
  const body = `
    The Plaid processing for ownerId: ${ownerId} has been successfully completed.
    
    Request Details:
    - Start Time: ${startTime ? new Date(startTime).toISOString() : "Unknown"}
    - End Time: ${endTime ? new Date(endTime).toISOString() : "Not completed"}
    - Total Processing Time: ${
      startTime && endTime
        ? ((endTime - startTime) / 1000).toFixed(2)
        : "Unknown"
    } seconds
    - Processed Items: ${Array.from(processedItems).join(", ") || "None"}
  `;

  await sendEmail(subject, body);
}

async function sendErrorEmail(context: string, error: any, details: any) {
  const subject = `❌ Error: ${context}`;
  const body = `
    An error occurred in the process: ${context}
    
    Error Message:
    ${error.message || error.toString()}

    Stack Trace:
    ${error.stack || "No stack trace available"}

    Additional Details:
    ${JSON.stringify(details, null, 2)}
  `;

  await sendEmail(subject, body);
}

async function main() {
  try {
    const ownerId = process.argv[2] || "owner123";
    console.log(`Starting Plaid worker for ownerId=${ownerId}`);

    timeoutHandle = setTimeout(async () => {
      console.log("⏳ Process timed out! Sending alert email...");
      await sendErrorEmail(
        "Process Timeout",
        new Error("Process exceeded timeout limit"),
        { ownerId }
      );
      process.exit(1);
    }, TIMEOUT_MS);

    const interval = setInterval(() => {
      if (!isProcessingComplete) {
        void processOwner(ownerId);
      } else {
        clearInterval(interval);
      }
    }, INTERVAL_MS);
  } catch (error) {
    console.error("Fatal error in main process:", error);
    await sendErrorEmail("Fatal Error", error, {});
    process.exit(1);
  }
}

void main();

#!/usr/bin/env ts-node
import nodemailer from "nodemailer";

interface PlaidItem {
  id: string;
  ownerId: string;
}

interface PlaidWebhook {
  id: string;
  itemId: string;
  webhookType: string;
}

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
const TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes in milliseconds
let timeoutHandle: NodeJS.Timeout | null = null;

async function fetchPlaidItemsByOwner(ownerId: string): Promise<PlaidItem[]> {
  console.log(`fetch plaid items by owner: ${ownerId}`);
  await wait(300);
  return MOCK_PLAID_ITEMS.filter((item) => item.ownerId === ownerId);
}

async function fetchHistoricalUpdateWebhooks(
  items: PlaidItem[]
): Promise<PlaidWebhook[]> {
  console.log(
    'fetch all webhooks that are type "historical updates" by those items'
  );
  const itemIds = items.map((i) => i.id);
  await wait(300);
  return MOCK_WEBHOOKS.filter(
    (wh) =>
      itemIds.includes(wh.itemId) && wh.webhookType === "historical update"
  );
}

async function importPlaidData(itemId: string): Promise<void> {
  console.log(
    `if webhook available, import plaid item data (itemId = ${itemId}) into our database`
  );
  await wait(500);
  console.log(`Imported data for itemId = ${itemId} successfully.`);
  processedItems.add(itemId);
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function processOwner(ownerId: string): Promise<void> {
  if (isProcessingComplete) {
    return;
  }

  try {
    if (!startTime) {
      startTime = Date.now(); // Start timer when processing begins
    }

    const items = await fetchPlaidItemsByOwner(ownerId);
    const webhooks = await fetchHistoricalUpdateWebhooks(items);

    const pendingItems = webhooks
      .filter((wh) => !processedItems.has(wh.itemId))
      .map((wh) => wh.itemId);

    if (pendingItems.length === 0) {
      console.log("All Plaid items have been processed.");
      isProcessingComplete = true;
      endTime = Date.now(); // Capture end time

      if (timeoutHandle) {
        clearTimeout(timeoutHandle); // Cancel timeout since process is complete
      }

      // Calculate and log total time taken
      if (startTime && endTime) {
        const timeTaken = (endTime - startTime) / 1000; // Convert ms to seconds
        console.log(`Total processing time: ${timeTaken.toFixed(2)} seconds`);
      }

      await sendCompletionEmail(ownerId); // Send completion email
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
  }
}

function startVeraScorerProcess(): void {
  console.log("=== Start VeraScorer Process ===");
  console.log("Running VeraScorer process...");
  console.log("VeraScorer process completed.");
}

async function sendTimeoutEmail(ownerId: string) {
  console.log("Sending timeout notification email...");

  const transporter = nodemailer.createTransport({
    service: "gmail", // Use your actual email provider
    auth: {
      user: "your-email@gmail.com", // Replace with actual sender email
      pass: "your-email-password", // Replace with an environment variable in production
    },
  });

  const subject = `⚠️ Plaid Processing Timeout for ${ownerId}`;
  const body = `
    The Plaid processing for ownerId: ${ownerId} has exceeded the 10-minute timeout limit.
    
    Request Details:
    - Start Time: ${startTime ? new Date(startTime).toISOString() : "Unknown"}
    - End Time: ${endTime ? new Date(endTime).toISOString() : "Not completed"}
    - Processed Items: ${Array.from(processedItems).join(", ") || "None"}
    
    Manual intervention may be required.
  `;

  const mailOptions = {
    from: "platform@myverascore.com",
    to: "platform@myverascore.com",
    subject: subject,
    text: body,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log("Timeout email sent successfully.");
  } catch (error) {
    console.error("Failed to send timeout email:", error);
  }
}

async function sendCompletionEmail(ownerId: string) {
  console.log("Sending completion notification email...");

  const transporter = nodemailer.createTransport({
    service: "gmail", // Use your actual email provider
    auth: {
      user: "your-email@gmail.com", // Replace with actual sender email
      pass: "your-email-password", // Replace with an environment variable in production
    },
  });

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

  const mailOptions = {
    from: "platform@myverascore.com",
    to: "platform@myverascore.com",
    subject: subject,
    text: body,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log("Completion email sent successfully.");
  } catch (error) {
    console.error("Failed to send completion email:", error);
  }
}

async function main() {
  const ownerId = process.argv[2] || "owner123";
  console.log(`Starting Plaid worker for ownerId=${ownerId}`);

  // Set a timeout to stop processing after 10 minutes
  timeoutHandle = setTimeout(async () => {
    console.log("⏳ Process timed out after 10 minutes! Stopping execution.");
    await sendTimeoutEmail(ownerId);
    process.exit(1);
  }, TIMEOUT_MS);

  const interval = setInterval(() => {
    if (!isProcessingComplete) {
      void processOwner(ownerId);
    } else {
      clearInterval(interval); // Stop the loop when everything is processed
    }
  }, 10_000);
}

void main();

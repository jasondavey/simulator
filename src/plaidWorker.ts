#!/usr/bin/env ts-node

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

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const ownerId = process.argv[2] || "owner123";
  console.log(`Starting Plaid worker for ownerId=${ownerId}`);

  // Set a timeout to stop processing after 10 minutes
  timeoutHandle = setTimeout(() => {
    console.log("⏳ Process timed out after 10 minutes! Stopping execution.");
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

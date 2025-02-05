import { Client, fql, QueryRuntimeError } from 'fauna';
import { VsPlaidWebhook } from './models';

export class PlaidWebhookDao {
  /**
   * Fetches supported webhooks from the database based on specific criteria.
   *
   * @param dbConnection - The FaunaDB client connection.
   * @returns A promise resolving to an array of supported webhooks.
   */
  public static getWebhookReadyForImportByItemId = async (
    dbConnection: Client,
    itemId: string
  ): Promise<VsPlaidWebhook> => {
    try {
      const query = fql`PlaidWebhookQueueItems.byItemId(${itemId}).where(wh => {
      wh.is_processed == false && (wh.sourceWebhook.webhook_type == 'TRANSACTIONS' ||  wh.sourceWebhook.webhook_type == "INVESTMENTS_TRANSACTIONS")
      && wh.sourceWebhook.webhook_code == 'HISTORICAL_UPDATE' 
        }).first()`;

      const response: any = await dbConnection.query(query);
      return response.data;
    } catch (error: any) {
      console.error(`Error getting webhook queue items:`, error);
      throw error;
    }
  };

  static upsertWebhook = async (
    dbConnection: Client,
    webhook: VsPlaidWebhook
  ): Promise<VsPlaidWebhook> => {
    try {
      //property "is_processed" is a computed field, remove before upsert
      const { id, coll, is_processed, ts, ttl, ...webhookDto } = webhook;
      const queryResult = await dbConnection.query<VsPlaidWebhook>(
        fql`plaidWebhookUpsert(${webhookDto})`
      );
      return queryResult.data;
    } catch (error: any) {
      console.error('Error creating a VsPlaidWebhook:', error);
      throw error;
    }
  };

  static getPlaidWebhookByItemId = async (
    dbConnection: Client,
    itemId: string
  ): Promise<VsPlaidWebhook | undefined> => {
    try {
      const response = await dbConnection.query<VsPlaidWebhook>(fql`
      PlaidWebhookQueueItems.byItemId(${itemId}).first()
    `);
      return response.data;
    } catch (error) {
      const runtimeError = error as QueryRuntimeError;
      if (runtimeError.code !== 'document not found') {
        throw runtimeError;
      }
    }
  };
}

export default PlaidWebhookDao;

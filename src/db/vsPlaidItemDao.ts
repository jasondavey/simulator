import { Client, fql } from 'fauna';
import { VsPlaidItem } from './models'; // Assuming PlaidErrorDTO is defined in another file

export class PlaidItemDao {
  public static async getPlaidItemsByOwner(
    dbConnection: Client,
    ownerId: string
  ): Promise<VsPlaidItem[]> {
    let items: VsPlaidItem[];
    try {
      console.log(`Fetching Plaid items for owner ${ownerId}`);
      const queryResult = await dbConnection!.query<any>(
        fql`PlaidItems.byOwner(${ownerId})`
      );

      items = queryResult.data.data;

      return items;
    } catch (error) {
      console.error('Error fetching Plaid items:', error);
      throw error;
    }
  }
}

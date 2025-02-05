import { Client, fql } from 'fauna';
import { VeraScoreClient } from './models';

export class ClientRegistryDao {
  public static async getClientByIdActiveOnly(
    dbConnection: Client,
    clientId: string
  ): Promise<VeraScoreClient> {
    console.log(
      `Fetching Active Client from FaunaDB for client_id ${clientId}`
    );

    const query = fql`
      ClientRegistry.firstWhere(x => x.client_id == ${clientId} && x.status == "active")
        `;

    const result = await dbConnection.query(query);
    if (result.data == null) {
      throw new Error(`Client not found for client_id: ${clientId}`);
    }
    return result.data;
  }

  public static async fetchClient(
    dbConnection: Client,
    clientId: string
  ): Promise<VeraScoreClient> {
    let vsClient: VeraScoreClient;
    try {
      const queryResult = await dbConnection!.query<any>(
        fql`ClientRegistry.byClientId(${clientId})`
      );

      vsClient = queryResult.data.data[0];
      console.info('VeraScore Client:', vsClient);

      return vsClient;
    } catch (error) {
      console.error('Error fetching clients:', error);
      throw error;
    }
  }
}

import { ClientRegistryDao } from './db/vsClientRegistryDao';
import { Handler } from './handler';
import { ProcessContext } from './processContext';

export class FetchVsClientHandler implements Handler {
  async handle(context: ProcessContext): Promise<void> {
    console.log('🔹 FetchVsClientHandler');
    try {
      const client = await ClientRegistryDao.getClientByIdActiveOnly(
        context.parentDbConnection!,
        context.clientId
      );
      console.info(`✅ VeraScore Client Fetched: ${client.partner_name}`);

      context.vsClient = client;
    } catch (error) {
      throw new Error(`Failed to connect to client registry. ${String(error)}`);
    }
  }
}

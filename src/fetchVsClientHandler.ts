import { ClientRegistryDao } from './db/clientRegistryDao';
import { Handler } from './handler';
import { StateMachineContext } from './stateMachineContext';

export class FetchVsClientHandler implements Handler {
  async handle(context: StateMachineContext): Promise<void> {
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

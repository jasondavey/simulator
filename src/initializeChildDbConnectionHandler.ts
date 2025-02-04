import { Handler } from './handler';
import { ProcessContext } from './processContext';
import { createVsChildDbConnection } from './services/faunaService';

export class InitializeChildDbConnectionHandler implements Handler {
  async handle(context: ProcessContext): Promise<void> {
    console.log('🔹 Initialize Parent Db Connection');
    try {
      if (!process.env.FAUNA_DATABASE_VS_PARENT_ROOT_KEY) {
        throw new Error('FAUNA_DATABASE_VS_PARENT_ROOT_KEY is undefined');
      }

      if (!context.vsClient?.db_name) {
        throw new Error('VS Client db_name is undefined');
      }
      context.childDbConnection = await createVsChildDbConnection(
        process.env.FAUNA_DATABASE_VS_PARENT_ROOT_KEY,
        context.vsClient?.db_name
      );
    } catch (error) {
      throw new Error(
        `Failed to initialize parent db connection. ${String(error)}`
      );
    }
  }
}

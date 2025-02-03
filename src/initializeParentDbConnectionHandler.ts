import { Handler } from './handler';
import { ProcessContext } from './processContext';
import { createVsParentDbConnection } from './services/faunaService';

export class InitializeParentDbConnectionHandler implements Handler {
  async handle(context: ProcessContext): Promise<void> {
    console.log('🔹 Initialize Parent Db Connection');
    try {
      if (!process.env.FAUNA_DATABASE_VS_PARENT_ROOT_KEY) {
        throw new Error('FAUNA_DATABASE_VS_PARENT_ROOT_KEY is undefined');
      }
      context.parentDbConnection = await createVsParentDbConnection(
        process.env.FAUNA_DATABASE_VS_PARENT_ROOT_KEY!
      );
    } catch (error) {
      throw new Error(
        `Failed to initialize parent db connection. ${String(error)}`
      );
    }
  }
}

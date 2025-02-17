import { Handler } from './handler';
import { createVsChildDbConnection } from './services/faunaService';
import { StateMachineContext } from './stateMachineContext';

export class InitializeChildDbConnectionHandler implements Handler {
  async handle(context: StateMachineContext): Promise<void> {
    console.log('🔹 Initialize Child Db Connection');
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
      console.log('🔹 SUCCESS: Initialize Child Db Connection');
    } catch (error) {
      throw new Error(
        `Failed to initialize parent db connection. ${String(error)}`
      );
    }
  }
}

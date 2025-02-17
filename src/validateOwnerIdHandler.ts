import { Handler } from './handler';
import { StateMachineContext } from './stateMachineContext';

export class ValidateOwnerIdHandler implements Handler {
  async handle(context: StateMachineContext): Promise<void> {
    console.log('🔹 ValidateOwnerIdHandler');

    const auth0Pattern = /^auth0\|[a-zA-Z0-9]+$/;
    if (!auth0Pattern.test(context.memberId)) {
      throw new Error(
        `Invalid Auth0 ID format: ${context.memberId}. Must follow 'auth0|xxxxxxxx' format.`
      );
    }

    console.log(`✅ Valid owner format: ${context.memberId}`);
  }
}

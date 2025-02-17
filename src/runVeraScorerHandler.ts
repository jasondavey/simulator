import { Handler } from './handler';
import { StateMachineContext } from './stateMachineContext';

export class RunVeraScorerHandler implements Handler {
  async handle(context: StateMachineContext): Promise<void> {
    console.log('🔹 RunVeraScoreHandler');
    // Insert logic that triggers VeraScore calculation
    // e.g., call a microservice, run an internal function, etc.

    console.log('✅ VeraScore process completed successfully.');
  }
}

import { StateMachineContext } from './stateMachineContext';

export interface Handler {
  handle(context: StateMachineContext): Promise<void>;
}

import { Handler } from './handler';
import { StateMachineContext } from './stateMachineContext';

export class Pipeline<T> {
  private handlers: Handler[] = [];

  use(handler: Handler): Pipeline<T> {
    this.handlers.push(handler);
    return this;
  }

  async execute(context: StateMachineContext): Promise<void> {
    for (const handler of this.handlers) {
      await handler.handle(context);
    }
  }
}

import { Handler } from './handler';
import { ProcessContext } from './processContext';

export class Pipeline {
  private handlers: Handler[] = [];

  use(handler: Handler): Pipeline {
    this.handlers.push(handler);
    return this;
  }

  async execute(context: ProcessContext): Promise<void> {
    for (const handler of this.handlers) {
      await handler.handle(context);
    }
  }
}

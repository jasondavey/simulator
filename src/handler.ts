import { ProcessContext } from "./processContext";

export interface Handler {
  handle(context: ProcessContext): Promise<void>;
}

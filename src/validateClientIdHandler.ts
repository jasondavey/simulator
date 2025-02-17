import { Handler } from "./handler";
import { StateMachineContext } from "./stateMachineContext";

export class ValidateClientIdHandler implements Handler {
  async handle(context: StateMachineContext): Promise<void> {
    console.log("🔹 ValidateClientIdHandler");

    const guidPattern =
      /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/;
    if (!guidPattern.test(context.clientId)) {
      throw new Error(
        `Invalid VeraScore Client ID format: ${context.clientId}. Must be guid.`
      );
    }

    console.log(`✅ Valid client format: ${context.clientId}`);
  }
}

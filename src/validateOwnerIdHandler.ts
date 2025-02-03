import { Handler } from "./handler";
import { ProcessContext } from "./processContext";

export class ValidateOwnerIdHandler implements Handler {
  async handle(context: ProcessContext): Promise<void> {
    console.log("🔹 ValidateOwnerIdHandler");

    const auth0Pattern = /^auth0\|[a-zA-Z0-9]+$/;
    if (!auth0Pattern.test(context.ownerId)) {
      throw new Error(
        `Invalid Auth0 ID format: ${context.ownerId}. Must follow 'auth0|xxxxxxxx' format.`
      );
    }

    console.log(`✅ Valid owner format: ${context.ownerId}`);
  }
}

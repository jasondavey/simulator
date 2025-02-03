import { VeraScoreClient } from './db/models';
import { Handler } from './handler';
import { ProcessContext } from './processContext';
import { Auth0Service } from './services/auth0Service';

export class FetchAuth0UserProfileHandler implements Handler {
  async handle(context: ProcessContext): Promise<void> {
    console.log('🔹 FetchAuth0UserProfileHandler');

    const vsClient: VeraScoreClient = (context as any).vsClient;
    const startFetchTime = Date.now();

    const auth0UserToken = await Auth0Service.getAuth0UserApiToken(vsClient);
    const userProfile = await Auth0Service.getUserByAuth0Id(
      auth0UserToken,
      context.ownerId,
      vsClient.app_tenant_domain
    );

    if (!userProfile) {
      throw new Error(`User profile not found for ownerId: ${context.ownerId}`);
    }

    context.auth0FetchTime = (Date.now() - startFetchTime) / 1000;
    console.log(
      `✅ Auth0 user profile fetched in ${context.auth0FetchTime.toFixed(2)} seconds`
    );

    // Store userProfile on context if needed by subsequent steps
    (context as any).userProfile = userProfile;
  }
}

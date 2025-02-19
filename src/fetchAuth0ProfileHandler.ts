import { Handler } from './handler';
import { Auth0Service } from './services/auth0Service';
import { StateMachineContext } from './stateMachineContext';

export class FetchAuth0UserProfileHandler implements Handler {
  async handle(context: StateMachineContext): Promise<void> {
    console.log('🔹 Fetching Auth0 User Profile for ', context.memberId);

    const startFetchTime = Date.now();

    context.auth0UserToken = await Auth0Service.getAuth0UserApiToken(
      context.vsClient
    );
    const userProfile = await Auth0Service.getUserByAuth0Id(
      context.auth0UserToken,
      context.memberId,
      context.vsClient.app_tenant_domain
    );

    if (!userProfile) {
      throw new Error(
        `User profile not found for ownerId: ${context.memberId}`
      );
    }

    context.auth0FetchTime = (Date.now() - startFetchTime) / 1000;
    console.log(
      `✅ Auth0 user profile fetched in ${context.auth0FetchTime.toFixed(2)} seconds`
    );

    // Store userProfile on context if needed by subsequent steps
    context.auth0UserProfile = userProfile;
  }
}

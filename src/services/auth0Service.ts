import { VeraScoreClient } from '../db/models';
import { HttpError, HttpStatus } from '../httpHandler';
import { Auth0Profile } from '../db/models';
import { ProcessContext } from '../processContext';

export class Auth0Service {
  static getAuth0ManagementApiToken = async (
    app_tenant_domain: string
  ): Promise<string> => {
    const url = `https://${encodeURIComponent(app_tenant_domain)}/oauth/token`;
    const managementTokenResponse = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        client_id: process.env.AUTH0_API_MANAGEMENT_CLIENT_ID,
        client_secret: process.env.AUTH0_API_MANAGEMENT_CLIENT_SECRET,
        audience: `https://${encodeURIComponent(app_tenant_domain)}/api/v2/`,
        grant_type: 'client_credentials'
      })
    });

    if (!managementTokenResponse.ok) {
      console.error(managementTokenResponse.statusText);
      throw new Error('Failed to obtain management API token');
    }

    const data = await managementTokenResponse.json();
    return data.access_token;
  };

  static getAuth0UserApiToken = async (
    vsClient: VeraScoreClient
  ): Promise<string> => {
    const url = `https://${encodeURIComponent(vsClient.app_tenant_domain)}/oauth/token`;
    const userTokenResponse = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        client_id: vsClient.auth0.apps.users.client_id,
        client_secret: vsClient.auth0.apps.users.client_secret,
        audience: `https://${vsClient.app_tenant_domain}/api/v2/`,
        grant_type: 'client_credentials'
      })
    });

    if (!userTokenResponse.ok) {
      console.error(userTokenResponse.statusText);
      throw new Error('Failed to obtain management API token');
    }

    const data = await userTokenResponse.json();
    return data.access_token;
  };

  static getUserByAuth0Id = async (
    managementApiToken: string,
    userId: string,
    auth0Domain: string
  ): Promise<Auth0Profile> => {
    const url = `https://${encodeURIComponent(
      auth0Domain
    )}/api/v2/users/${encodeURIComponent(userId)}`;

    console.log('Fetching user by Auth0 ID at auth0 endpoint:', userId, url);
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${managementApiToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      let errorMessage = `Error ${response.status}: ${response.statusText}.`;

      if (response.status === 401) {
        errorMessage += ' Invalid token.';
      } else if (response.status === 403) {
        errorMessage += 'Forbidden. Insufficient permissions.';
      } else if (response.status === 404) {
        errorMessage += ' User not found.';
      }

      console.log('Error fetching user by auth0Id:', errorMessage);
      throw new HttpError(response.status, errorMessage);
    }

    const data: Auth0Profile = await response.json();

    if (!data) {
      console.log(`No user found with auth0 id: ${userId}`);
      throw new HttpError(HttpStatus.NOT_FOUND, `Invalid user id: ${userId}`);
    }

    console.log('User data filtered by Auth0ID:', data);
    return data;
  };

  //only use this as a helper once a user has been retrieved via a auth0 token
  static fetchUserProfile = async (
    context: ProcessContext
  ): Promise<Auth0Profile> => {
    const userProfile = await Auth0Service.getUserByAuth0Id(
      context.auth0UserToken,
      context.ownerId,
      context.vsClient!.app_tenant_domain
    );
    if (!userProfile) {
      throw new Error(`User profile not found for ownerId=${context.ownerId}`);
    }
    return userProfile;
  };

  static updateProfile = async (
    authToken: string,
    app_tenant_domain: string,
    userId: string,
    userMetadata: any
  ): Promise<any> => {
    const url = `https://${encodeURIComponent(
      app_tenant_domain
    )}/api/v2/users/${encodeURIComponent(userId)}`;

    const response = await fetch(url, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(userMetadata)
    });

    if (!response.ok) {
      throw new HttpError(
        HttpStatus.INTERNAL_SERVER_ERROR,
        `Failed to update user: ${response.statusText}`
      );
    }

    const updatedUser = await response.json();
    return updatedUser;
  };
}

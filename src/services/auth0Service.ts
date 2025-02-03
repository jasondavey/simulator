import { VeraScoreClient } from "../db/models";
import { HttpError, HttpStatus } from "../httpHandler";
import { Auth0Profile } from "../db/models";

interface PasswordChangeLinkResponse {
  ticket: string;
}
export class Auth0Service {
  static getAuth0ManagementApiToken = async (
    app_tenant_domain: string
  ): Promise<string> => {
    const url = `https://${encodeURIComponent(app_tenant_domain)}/oauth/token`;
    const managementTokenResponse = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        client_id: process.env.AUTH0_API_MANAGEMENT_CLIENT_ID,
        client_secret: process.env.AUTH0_API_MANAGEMENT_CLIENT_SECRET,
        audience: `https://${encodeURIComponent(app_tenant_domain)}/api/v2/`,
        grant_type: "client_credentials",
      }),
    });

    if (!managementTokenResponse.ok) {
      console.error(managementTokenResponse.statusText);
      throw new Error("Failed to obtain management API token");
    }

    const data = await managementTokenResponse.json();
    return data.access_token;
  };

  static getAuth0UserApiToken = async (
    vsClient: VeraScoreClient
  ): Promise<string> => {
    const url = `https://${encodeURIComponent(vsClient.app_tenant_domain)}/oauth/token`;
    const userTokenResponse = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        client_id: vsClient.auth0.apps.users.client_id,
        client_secret: vsClient.auth0.apps.users.client_secret,
        audience: `https://${vsClient.app_tenant_domain}/api/v2/`,
        grant_type: "client_credentials",
      }),
    });

    if (!userTokenResponse.ok) {
      console.error(userTokenResponse.statusText);
      throw new Error("Failed to obtain management API token");
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

    console.log("Fetching user by Auth0 ID at auth0 endpoint:", userId, url);
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${managementApiToken}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      let errorMessage = `Error ${response.status}: ${response.statusText}.`;

      if (response.status === 401) {
        errorMessage += " Invalid token.";
      } else if (response.status === 403) {
        errorMessage += "Forbidden. Insufficient permissions.";
      } else if (response.status === 404) {
        errorMessage += " User not found.";
      }

      console.log("Error fetching user by auth0Id:", errorMessage);
      throw new HttpError(response.status, errorMessage);
    }

    const data: Auth0Profile = await response.json();

    if (!data) {
      console.log(`No user found with auth0 id: ${userId}`);
      throw new HttpError(HttpStatus.NOT_FOUND, `Invalid user id: ${userId}`);
    }

    console.log("User data filtered by Auth0ID:", data);
    return data;
  };

  static getUserByEmail = async (
    managementApiToken: string,
    email: string,
    auth0Domain: string
  ): Promise<Auth0Profile> => {
    const url = `https://${encodeURIComponent(
      auth0Domain
    )}/api/v2/users-by-email?email=${encodeURIComponent(email)}`;

    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${managementApiToken}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      let errorMessage = `Error ${response.status}: ${response.statusText}.`;

      if (response.status === 401) {
        errorMessage += " Invalid token.";
      } else if (response.status === 403) {
        errorMessage += "Forbidden. Insufficient permissions.";
      } else if (response.status === 404) {
        errorMessage += " User not found.";
      }

      console.log("Error fetching user by email:", errorMessage);
      throw new Error(errorMessage);
    }

    const profiles: Auth0Profile[] = await response.json();

    if (!profiles || profiles.length === 0) {
      console.log(`No user found with email: ${email}`);
      throw new HttpError(HttpStatus.NOT_FOUND, `Invalid user email: ${email}`);
    }

    if (profiles.length > 1) {
      const message = `Multiple users found with email: ${email}`;
      console.error(message);
      throw new HttpError(HttpStatus.INTERNAL_SERVER_ERROR, message);
    }

    return profiles[0];
  };

  static getUserProfile = async (
    authToken: string,
    app_tenant_domain: string
  ): Promise<Auth0Profile> => {
    const url = `https://${encodeURIComponent(app_tenant_domain)}/userinfo`;
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${authToken}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      let errorMessage = `Error ${response.status}: ${response.statusText}. `;

      if (response.status === 401) {
        errorMessage += " Invalid token.";
      } else if (response.status === HttpStatus.FORBIDDEN) {
        errorMessage += "Forbidden. Insufficient permissions.";
      } else {
        errorMessage += `Failed to fetch user profile at Auth0 domain: ${app_tenant_domain}`;
      }

      console.log("Error fetching user profile:", errorMessage);
      throw new Error(errorMessage);
    }

    const data: Auth0Profile = await response.json();

    // Check if user metadata is available
    const userMetadata = data.user_metadata ? data.user_metadata : {};

    console.log("User profile fetched:", data);
    console.log("User metadata:", userMetadata);

    return data;
  };

  static generatePasswordChangeLink = async (
    app_tenant_domain: string,
    userId: string,
    resultUrl: string,
    expiresInSeconds: number = 600
  ): Promise<string> => {
    const token =
      await Auth0Service.getAuth0ManagementApiToken(app_tenant_domain);

    const response = await fetch(
      `https://${app_tenant_domain}/api/v2/tickets/password-change`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          user_id: userId,
          result_url: resultUrl,
          ttl_sec: expiresInSeconds,
        }),
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(
        `Error generating password change link: ${errorData.message}`
      );
    }

    const data: PasswordChangeLinkResponse = await response.json();
    return data.ticket;
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
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${authToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(userMetadata),
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

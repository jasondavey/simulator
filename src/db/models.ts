export interface VeraScoreClient {
  id?: string;
  client_id: string;
  partner_name: string;
  partner_brand: string;
  app_tenant_domain: string;
  app_tenant_token_audience: string;
  app_name: string;
  description: string;
  version: string;
  status: string;
  allowed_origins: string[];
  logo_url: string;
  db_name: string;
  auth0: {
    apps: {
      users: {
        client_id: string;
        client_secret: string;
      };
      veraScorer: {
        client_id: string;
        client_secret: string;
      };
    };
  };
}

export interface Auth0Profile {
  user_id: string;
  email: string;
  username: string;
  name: string;
  sub: string;
  user_metadata: {
    firstName: string;
    middleName: string;
    lastName: string;
    phoneNumber: string;
    companyName: string;
    licenseNumber: string;
    address: string;
    yearlyGrossIncome?: number;
    ssnOrItin?: string;
  };
  created_at: string;
}

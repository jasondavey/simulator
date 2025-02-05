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
  app_metadata: any;
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

export interface VsPlaidItem {
  id?: string;
  item_id: string;
  owner?: string;
  access_token: string;
  available_products: string[];
  products: string[];
  billed_products: string[];
  webhook?: string;
  error?: VsPlaidItemError | null;
  transactions_sync_next_cursor?: string;
  institution_id: string;
  [key: string]: any;
}

export interface VsPlaidItemError extends Record<string, any> {
  error_type: string;
  error_code: string;
  error_message: string;
  display_message: string | null;
  status_code: number;
  request_id: string;
  causes?: any[];
  documentation_url?: string;
  suggested_action?: string;
}

export interface VsPlaidWebhook {
  client_id: string;
  is_processed?: boolean; //fauna computed field
  resolved_at: string;
  [key: string]: any; // Add index signature
  sourceWebhook: {
    environment: string;
    error?:
      | {
          error_type: string;
          error_code: string;
          error_message: string;
          display_message?: string;
          status_code: number;
          request_id: string;
          causes?: any[];
          documentation_url?: string;
          suggested_action: string;
        }
      | undefined;
    item_id: string;
    webhook_type: string;
    webhook_code: string;
  };
}

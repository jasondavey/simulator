import { Client } from "fauna";

export const createVsParentDbConnection = async (
  parentDbKey: string
): Promise<Client> => {
  const clientDbKeyRole = "admin";
  const scopedKey = `${parentDbKey}:${clientDbKeyRole}`;
  return faunaClient(scopedKey);
};

export const createVsChildDbConnection = async (
  parentDbKey: string,
  dbName: string
): Promise<Client> => {
  const clientDbKeyRole = "admin";
  const scopedKey = `${parentDbKey}:${dbName}:${clientDbKeyRole}`;
  return faunaClient(scopedKey);
};

export const faunaClient = (accessToken?: string): Client => {
  if (!accessToken) {
    throw new Error("Access token is required.");
  }

  return createFaunaClient(accessToken);
};

export const createFaunaClient = (accessToken: string): Client => {
  const options = {
    secret: accessToken,
    domain: "db.us.fauna.com",
    scheme: "https" as "https",
    port: 443,
    keepAlive: true,
  };

  try {
    const client = new Client(options);
    return client;
  } catch (error) {
    console.error("Could not initialize Fauna client.", error);
    throw error;
  }
};

export default {
  createFaunaClient,
  createVsParentDbConnection,
  createVsChildDbConnection,
};

export interface HttpEvent {
  httpMethod: HttpMethod;
  path: string;
  body?: string;
  headers: { [key: string]: string };
}

export enum HttpMethod {
  GET = 'GET',
  POST = 'POST',
  PUT = 'PUT',
  DELETE = 'DELETE',
  PATCH = 'PATCH',
  OPTIONS = 'OPTIONS'
}

export const HttpStatus = {
  UNDETERMINED: 0,
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500
};

export class HttpError extends Error {
  statusCode: number;
  headers?: { [key: string]: string };

  constructor(
    statusCode: number,
    message: string,
    headers?: { [key: string]: string }
  ) {
    super(message);
    this.statusCode = statusCode;
    this.headers = headers;
  }
}

export const isHttpError = (err: any): err is HttpError => {
  return err instanceof HttpError;
};

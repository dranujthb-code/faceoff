export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public fields?: Record<string, string>,
  ) {
    super(message);
  }
}

export const badRequest = (message: string, fields?: Record<string, string>) => new ApiError(400, "bad_request", message, fields);
export const unauthorized = (message = "Sign in to continue") => new ApiError(401, "unauthorized", message);
export const forbidden = (message = "You don't have permission to do that") => new ApiError(403, "forbidden", message);
export const notFound = (message = "Not found") => new ApiError(404, "not_found", message);
export const conflict = (message: string) => new ApiError(409, "conflict", message);
export const tooMany = (message = "You're doing that too often. Please wait a moment.") => new ApiError(429, "rate_limited", message);

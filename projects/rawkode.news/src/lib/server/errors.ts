export class RequestError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "RequestError";
    this.status = status;
  }
}

export const asRequestError = (error: unknown) => {
  if (error instanceof RequestError) {
    return error;
  }
  if (error instanceof Error) {
    return new RequestError(error.message, 500);
  }
  return new RequestError("Internal server error", 500);
};

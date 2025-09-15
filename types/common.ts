// Common type definitions for the project

export interface AxiosError extends Error {
  response?: {
    status?: number;
    data?: unknown;
  };
}

export function isAxiosError(error: unknown): error is AxiosError {
  return error instanceof Error && 'response' in error;
}

export function formatError(error: unknown) {
  if (isAxiosError(error)) {
    return {
      error: error.message,
      statusCode: error.response?.status,
      details: error.response?.data
    };
  }
  
  if (error instanceof Error) {
    return {
      error: error.message,
      statusCode: undefined,
      details: undefined
    };
  }
  
  return {
    error: String(error),
    statusCode: undefined,
    details: undefined
  };
}
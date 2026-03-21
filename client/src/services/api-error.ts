import type { AxiosError } from 'axios';

interface ApiErrorResponse {
  message?: string;
  statusCode?: number;
}

export class ApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number = 0) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }

  static fromAxios(err: AxiosError<ApiErrorResponse>): ApiError {
    const message =
      err.response?.data?.message ?? err.message ?? 'Error inesperado';
    const status = err.response?.status ?? 0;
    return new ApiError(message, status);
  }
}

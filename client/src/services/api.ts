import axios from 'axios';
import type { AxiosError, InternalAxiosRequestConfig } from 'axios';
import type {
  Chapter,
  Submission,
  ReviewResult,
} from '../types';
import { ApiError } from './api-error';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
});

// Track whether a refresh is in progress to avoid cascading retries
let isRefreshing = false;
let pendingRequests: Array<{
  resolve: (config: InternalAxiosRequestConfig) => void;
  reject: (error: unknown) => void;
}> = [];

function drainPending(error: unknown, config?: InternalAxiosRequestConfig) {
  pendingRequests.forEach((p) => {
    if (error) {
      p.reject(error);
    } else {
      p.resolve(config!);
    }
  });
  pendingRequests = [];
}

// Normalize every Axios error into a typed ApiError
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<{ message?: string }>) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & {
      _retried?: boolean;
    };

    // Only intercept 401 responses that haven't been retried yet
    // Skip the refresh endpoint itself to avoid infinite loops
    const isRefreshEndpoint = originalRequest?.url?.includes('/auth/refresh');
    const isAuthEndpoint =
      originalRequest?.url?.includes('/auth/login') ||
      originalRequest?.url?.includes('/auth/register');

    if (
      error.response?.status === 401 &&
      !originalRequest._retried &&
      !isRefreshEndpoint &&
      !isAuthEndpoint
    ) {
      if (isRefreshing) {
        // Queue request until refresh completes
        return new Promise((resolve, reject) => {
          pendingRequests.push({
            resolve: (config) => resolve(api(config)),
            reject,
          });
        });
      }

      originalRequest._retried = true;
      isRefreshing = true;

      try {
        // Attempt token refresh
        await api.post('/auth/refresh');
        drainPending(null, originalRequest);
        return api(originalRequest);
      } catch (refreshError) {
        drainPending(refreshError);
        // Refresh failed — redirect to login
        window.location.href = '/login';
        return Promise.reject(ApiError.fromAxios(error));
      } finally {
        isRefreshing = false;
      }
    }

    throw ApiError.fromAxios(error);
  },
);

// --- Typed API functions ---

interface ChapterDetailData extends Chapter {
  submissions?: Submission[];
}

export const chaptersApi = {
  list: () => api.get<Chapter[]>('/chapters'),
  getById: (id: string) => api.get<ChapterDetailData>(`/chapters/${id}`),
  approve: (id: string) => api.patch(`/chapters/${id}/approve`),
  reject: (id: string) => api.patch(`/chapters/${id}/reject`),
};

export const submissionsApi = {
  upload: (chapterId: string, file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('chapterId', chapterId);
    return api.post<Submission>('/submissions', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
};

export const reviewsApi = {
  getByJobId: (jobId: string) => api.get<ReviewResult>(`/reviews/${jobId}`),
};

export interface KnowledgeDoc {
  sourceDocument: string;
  layer: 'TUTOR' | 'INSTITUTIONAL';
  chunkCount: number;
  lastUpdated: string;
}

export const knowledgeApi = {
  list: () => api.get<KnowledgeDoc[]>('/knowledge'),
  upload: (file: File, layer: string = 'TUTOR') => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post(`/knowledge/upload?layer=${layer}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 120000,
    });
  },
  delete: (sourceDocument: string) =>
    api.delete(`/knowledge/${encodeURIComponent(sourceDocument)}`),
};

export default api;

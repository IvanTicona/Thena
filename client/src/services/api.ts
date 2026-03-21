import axios from 'axios';
import type { AxiosError } from 'axios';
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
});

// Normalize every Axios error into a typed ApiError
api.interceptors.response.use(
  (response) => response,
  (error: AxiosError<{ message?: string }>) => {
    throw ApiError.fromAxios(error);
  },
);

// Inject mock user ID on every request
export function setCurrentUserId(userId: string) {
  api.defaults.headers.common['X-User-Id'] = userId;
}

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

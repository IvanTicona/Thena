import axios from 'axios';
import type { AxiosError, InternalAxiosRequestConfig } from 'axios';
import type {
  Chapter,
  Submission,
  ReviewResult,
  ThesisDocument,
  TutorSummary,
  KnowledgeDoc,
  UserRole,
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
    // Skip hydration endpoint — a 401 on /users/me just means "not logged in"
    const isHydrationEndpoint = originalRequest?.url?.includes('/users/me');

    if (
      error.response?.status === 401 &&
      !originalRequest._retried &&
      !isRefreshEndpoint &&
      !isAuthEndpoint &&
      !isHydrationEndpoint
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
        // Refresh failed — redirect to login only if not already there
        const isOnPublicPage =
          window.location.pathname === '/login' ||
          window.location.pathname === '/register';
        if (!isOnPublicPage) {
          window.location.href = '/login';
        }
        return Promise.reject(ApiError.fromAxios(error));
      } finally {
        isRefreshing = false;
      }
    }

    throw ApiError.fromAxios(error);
  },
);

// --- Typed API functions ---

export interface ChapterDetailData extends Chapter {
  submissions?: Submission[];
}

export const chaptersApi = {
  list: () => api.get<Chapter[]>('/chapters'),
  getById: (id: string) => api.get<ChapterDetailData>(`/chapters/${id}`),
  requestTutorReview: (id: string) => api.patch(`/chapters/${id}/request-review`),
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
  downloadFile: (submissionId: string) =>
    api.get(`/submissions/${submissionId}/file`, { responseType: 'arraybuffer' }),
};

export const reviewsApi = {
  getByJobId: (jobId: string) => api.get<ReviewResult>(`/reviews/${jobId}`),
  exportPdf: (jobId: string) =>
    api.get(`/reviews/${jobId}/export`, { responseType: 'blob' }),
};

export const reviewerApi = {
  listTheses: () => api.get<ThesisDocument[]>('/theses'),
};

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

export interface CreateThesisDto {
  title: string;
  tutorId: string;
}

export const thesisApi = {
  create: (data: CreateThesisDto) => api.post<ThesisDocument>('/theses', data),
  list: () => api.get<ThesisDocument[]>('/theses'),
  getById: (id: string) => api.get<ThesisDocument>(`/theses/${id}`),

  /**
   * For students: GET /theses returns a single object or null (not an array).
   * NestJS serializes null as an empty response body, which Axios may parse
   * as "" instead of null. This helper normalizes the result.
   */
  findMine: async (): Promise<ThesisDocument | null> => {
    const res = await api.get<ThesisDocument | null>('/theses');
    const data = res.data;
    if (data && typeof data === 'object' && 'id' in data) {
      return data;
    }
    return null;
  },
};

export const usersApi = {
  getTutors: () => api.get<TutorSummary[]>('/users/tutors'),
};

// --- Admin API types ---

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  createdAt: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface CreateUserDto {
  name: string;
  email: string;
  password: string;
  role: UserRole;
}

export interface UpdateUserDto {
  name?: string;
  email?: string;
  role?: UserRole;
}

export interface Assignment {
  id: string;
  studentId: string;
  tutorId: string;
  reviewerId?: string | null;
  student?: AdminUser;
  tutor?: AdminUser;
  reviewer?: AdminUser | null;
  createdAt: string;
}

export interface CreateAssignmentDto {
  studentId: string;
  tutorId: string;
  reviewerId?: string;
}

export interface AdminKnowledgeChunk {
  id: string;
  sourceDocument: string;
  layer: 'INSTITUTIONAL' | 'TUTOR' | 'BIBLIOGRAPHY';
  content: string;
  createdAt: string;
}

export interface GetUsersParams {
  page?: number;
  limit?: number;
  role?: UserRole;
}

export interface GetAssignmentsParams {
  page?: number;
  limit?: number;
}

// --- Admin API functions ---

export const adminUsersApi = {
  list: (params?: GetUsersParams) =>
    api.get<PaginatedResponse<AdminUser>>('/users', { params }),
  create: (data: CreateUserDto) =>
    api.post<AdminUser>('/users', data),
  update: (id: string, data: UpdateUserDto) =>
    api.patch<AdminUser>(`/users/${id}`, data),
  delete: (id: string) =>
    api.delete(`/users/${id}`),
};

export const adminAssignmentsApi = {
  list: (params?: GetAssignmentsParams) =>
    api.get<PaginatedResponse<Assignment>>('/assignments', { params }),
  create: (data: CreateAssignmentDto) =>
    api.post<Assignment>('/assignments', data),
  delete: (id: string) =>
    api.delete(`/assignments/${id}`),
};

export const adminKnowledgeApi = {
  listAll: () =>
    api.get<AdminKnowledgeChunk[]>('/knowledge/admin'),
  uploadBibliography: (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/knowledge/upload?layer=BIBLIOGRAPHY', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 120000,
    });
  },
  deleteChunk: (id: string) =>
    api.delete(`/knowledge/chunk/${id}`),
};

// ── Notifications ─────────────────────────────────────────────────────────────

export type NotificationType =
  | 'NEW_SUBMISSION'
  | 'REVIEW_COMPLETE'
  | 'CHAPTER_APPROVED'
  | 'CHAPTER_REJECTED'
  | 'INACTIVITY_ALERT'
  | 'ESCALATION_ALERT';

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  read: boolean;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export interface PaginatedNotifications {
  data: Notification[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  unreadCount: number;
}

export const notificationsApi = {
  getAll: (page = 1, limit = 20) =>
    api.get<PaginatedNotifications>('/notifications', { params: { page, limit } }),
  markAsRead: (id: string) =>
    api.patch<{ id: string; read: boolean }>(`/notifications/${id}/read`),
  markAllAsRead: () =>
    api.patch<{ count: number }>('/notifications/read-all'),
};

// Re-export KnowledgeDoc type for consumers that import it from here
export type { KnowledgeDoc } from '../types';

// ── Audit Logs (Super Admin) ──────────────────────────────────────────────────

export type AuditActionType =
  | 'SUBMIT_CHAPTER'
  | 'GENERATE_REVIEW'
  | 'APPROVE_CHAPTER'
  | 'REJECT_CHAPTER'
  | 'CREATE_USER'
  | 'ASSIGN_TUTOR'
  | 'ADD_OBSERVATION'
  | 'DELETE_OBSERVATION'
  | 'UPLOAD_KNOWLEDGE'
  | 'DELETE_KNOWLEDGE'
  | 'LOGIN';

export interface AuditLogEntry {
  id: string;
  action: AuditActionType;
  actorId: string;
  entityType: string;
  entityId: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  actor: {
    id: string;
    name: string;
    email: string;
    role: string;
  };
}

export interface PaginatedAuditLogs {
  data: AuditLogEntry[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface GetAuditLogsParams {
  page?: number;
  limit?: number;
  action?: AuditActionType;
  actorId?: string;
  entityType?: string;
  dateFrom?: string;
  dateTo?: string;
}

export const auditApi = {
  getLogs: (params?: GetAuditLogsParams) =>
    api.get<PaginatedAuditLogs>('/audit-logs', { params }),
  exportCsv: (params?: Omit<GetAuditLogsParams, 'page' | 'limit'>) =>
    api.get('/audit-logs/export', { params, responseType: 'blob' }),
};

// ── Metrics (Admin) ───────────────────────────────────────────────────────────

export interface MetricsSummary {
  totalTheses: number;
  totalReviews: number;
  avgReviewTimeSeconds: number;
  activeStudentsThisMonth: number;
}

export interface ObservationsBySeverity {
  severity: string;
  count: number;
}

export interface ObservationsByAgent {
  agent: string;
  count: number;
}

export interface ReviewsOverTime {
  date: string;
  count: number;
}

export const metricsApi = {
  getSummary: () => api.get<MetricsSummary>('/metrics/summary'),
  getObservationsBySeverity: () =>
    api.get<ObservationsBySeverity[]>('/metrics/observations/severity'),
  getObservationsByAgent: () =>
    api.get<ObservationsByAgent[]>('/metrics/observations/agent'),
  getReviewsOverTime: () => api.get<ReviewsOverTime[]>('/metrics/reviews'),
};

export default api;

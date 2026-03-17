import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Inject mock user ID on every request
export function setCurrentUserId(userId: string) {
  api.defaults.headers.common['X-User-Id'] = userId;
}

export default api;

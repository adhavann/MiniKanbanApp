import axios from 'axios';
import { Project, Task, User, ProjectSummary, AuthResponse, TaskFilters, TasksResponse } from '../types';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor to handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth API
export const authAPI = {
  login: (data: { email: string; password: string }) => api.post<AuthResponse>('/auth/login', data),
  register: (data: { name: string; email: string; password: string }) => api.post<AuthResponse>('/auth/register', data),
};

export const usersAPI = {
  getAll: () => api.get<User[]>('/users'),
  getProfile: () => api.get<User>('/users/me'),
};

// Projects API
export const projectsAPI = {
  getAll: () => api.get<Project[]>('/projects'),
  
  getById: (id: string) => api.get<Project>(`/projects/${id}`),
  
  create: (data: { name: string; key: string; members?: string[] }) =>
    api.post<Project>('/projects', data),
  
  update: (id: string, data: { name?: string; key?: string; members?: string[] }) =>
    api.patch<Project>(`/projects/${id}`, data),
  
  delete: (id: string) => api.delete(`/projects/${id}`),
  
  addMembers: (id: string, userIds: string[]) =>
    api.post<Project>(`/projects/${id}/members`, { userIds }),
};

// Tasks API
export const tasksAPI = {
  getAll: (projectId: string, filters?: TaskFilters) => {
    const params = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== '') {
          params.append(key, value.toString());
        }
      });
    }
    return api.get<TasksResponse>(`/projects/${projectId}/tasks?${params}`);
  },
  
  getById: (id: string) => api.get<Task>(`/tasks/${id}`),
  
  create: (projectId: string, data: {
    title: string;
    description?: string;
    status?: string;
    priority?: string;
    assignee?: string;
    dueDate?: string;
  }) => api.post<Task>(`/projects/${projectId}/tasks`, data),
  
  update: (id: string, data: {
    title?: string;
    description?: string;
    status?: string;
    priority?: string;
    assignee?: string;
    dueDate?: string;
  }) => api.patch<Task>(`/tasks/${id}`, data),
  
  delete: (id: string) => api.delete(`/tasks/${id}`),
  
  getSummary: (projectId: string) => api.get<ProjectSummary>(`/projects/${projectId}/summary`),
  
  exportCsv: (projectId: string) => {
    return api.get(`/projects/${projectId}/tasks/export.csv`, {
      responseType: 'blob',
    });
  },
};

export default api;

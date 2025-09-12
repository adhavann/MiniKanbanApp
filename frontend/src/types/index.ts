export interface User {
  id?: string;  // From auth response
  _id?: string; // From populated fields
  name: string;
  email: string;
  role: 'admin' | 'member';
  createdAt?: string;
}

export interface Project {
  _id: string;
  name: string;
  key: string;
  members: User[];
  createdBy: User;
  createdAt: string;
  updatedAt: string;
}

export interface Task {
  _id: string;
  projectId: string;
  title: string;
  description?: string;
  status: 'todo' | 'in_progress' | 'done';
  priority: 'low' | 'med' | 'high';
  assignee?: User;
  dueDate?: string;
  createdBy: User;
  createdAt: string;
  updatedAt: string;
}

export interface TasksResponse {
  tasks: Task[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export interface ProjectSummary {
  total: number;
  todo: number;
  inProgress: number;
  done: number;
  overdue: number;
  completionRate: number;
}

export interface AuthResponse {
  access_token: string;
  user: User;
}

export interface TaskFilters {
  status?: string;
  assignee?: string;
  priority?: string;
  dueFrom?: string;
  dueTo?: string;
  q?: string;
  page?: number;
  limit?: number;
}

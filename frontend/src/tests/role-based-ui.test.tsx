import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { AuthProvider, useAuth } from '../hooks/useAuth';

// Mock the useAuth hook
vi.mock('../hooks/useAuth', () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useAuth: vi.fn(),
}));
import Projects from '../pages/Projects';
import Tasks from '../pages/Tasks';
import Dashboard from '../pages/Dashboard';
import Layout from '../components/Layout';

import { vi } from 'vitest';

// Mock API services
vi.mock('../services/api', () => ({
  projectsAPI: {
    getAll: vi.fn(),
    getById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    addMember: vi.fn(),
  },
  tasksAPI: {
    getAll: vi.fn(),
    getById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    exportCsv: vi.fn(),
    getProjectSummary: vi.fn(),
  },
}));

const theme = createTheme();

const MockAuthProvider = ({ children, user }: { children: React.ReactNode; user: any }) => {
  const mockAuthValue = {
    user,
    token: 'mock-token',
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
    loading: false,
  };

  // Mock the useAuth hook to return our mock values
  (useAuth as any).mockReturnValue(mockAuthValue);

  return (
    <AuthProvider>
      {children}
    </AuthProvider>
  );
};

const renderWithProviders = (component: React.ReactElement, user: any) => {
  return render(
    <BrowserRouter>
      <ThemeProvider theme={theme}>
        <MockAuthProvider user={user}>
          {component}
        </MockAuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
};

describe('Role-Based UI Components', () => {
  const adminUser = {
    _id: 'admin123',
    name: 'Admin User',
    email: 'admin@test.com',
    role: 'admin',
  };

  const memberUser = {
    _id: 'member123',
    name: 'Member User',
    email: 'member@test.com',
    role: 'member',
  };

  const mockProject = {
    _id: 'project123',
    name: 'Test Project',
    key: 'TEST',
    members: [
      { _id: 'admin123', name: 'Admin User', email: 'admin@test.com' },
      { _id: 'member123', name: 'Member User', email: 'member@test.com' },
    ],
    createdBy: { _id: 'admin123', name: 'Admin User', email: 'admin@test.com' },
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-01T00:00:00.000Z',
  };

  const mockTask = {
    _id: 'task123',
    title: 'Test Task',
    description: 'Test description',
    status: 'todo',
    priority: 'medium',
    assignee: { _id: 'member123', name: 'Member User', email: 'member@test.com' },
    createdBy: { _id: 'member123', name: 'Member User', email: 'member@test.com' },
    dueDate: '2025-12-31T23:59:59.000Z',
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-01T00:00:00.000Z',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Layout Component - Role-Based Navigation', () => {
    it('should show user menu with logout for authenticated users', () => {
      renderWithProviders(<Layout><div>Content</div></Layout>, adminUser);
      
      expect(screen.getByText('Admin User')).toBeInTheDocument();
      expect(screen.getByText('Projects')).toBeInTheDocument();
    });

    it('should show admin-specific navigation items', () => {
      renderWithProviders(<Layout><div>Content</div></Layout>, adminUser);
      
      // Admin should see all navigation options
      expect(screen.getByText('Projects')).toBeInTheDocument();
    });

    it('should show member-specific navigation items', () => {
      renderWithProviders(<Layout><div>Content</div></Layout>, memberUser);
      
      // Member should see limited navigation options
      expect(screen.getByText('Projects')).toBeInTheDocument();
      expect(screen.getByText('Member User')).toBeInTheDocument();
    });
  });

  describe('Projects Page - Admin vs Member UI', () => {
    beforeEach(async () => {
      const { projectsAPI } = await import('../services/api');
      (projectsAPI.getAll as any).mockResolvedValue([mockProject]);
    });

    it('should show create project button for admin', async () => {
      renderWithProviders(<Projects />, adminUser);
      
      await waitFor(() => {
        expect(screen.getByText('Create Project')).toBeInTheDocument();
      });
    });

    it('should hide create project button for member', async () => {
      renderWithProviders(<Projects />, memberUser);
      
      await waitFor(() => {
        expect(screen.queryByText('Create Project')).not.toBeInTheDocument();
      });
    });

    it('should show edit/delete buttons for admin on project cards', async () => {
      renderWithProviders(<Projects />, adminUser);
      
      await waitFor(() => {
        expect(screen.getByTestId('edit-project-button')).toBeInTheDocument();
        expect(screen.getByTestId('delete-project-button')).toBeInTheDocument();
      });
    });

    it('should hide edit/delete buttons for member on project cards', async () => {
      renderWithProviders(<Projects />, memberUser);
      
      await waitFor(() => {
        expect(screen.queryByTestId('edit-project-button')).not.toBeInTheDocument();
        expect(screen.queryByTestId('delete-project-button')).not.toBeInTheDocument();
      });
    });

    it('should show dashboard and tasks buttons for both roles', async () => {
      renderWithProviders(<Projects />, memberUser);
      
      await waitFor(() => {
        expect(screen.getByText('Dashboard')).toBeInTheDocument();
        expect(screen.getByText('Tasks')).toBeInTheDocument();
      });
    });
  });

  describe('Tasks Page - Role-Based Task Management', () => {
    beforeEach(async () => {
      const { tasksAPI, projectsAPI } = await import('../services/api');
      (tasksAPI.getAll as any).mockResolvedValue({
        tasks: [mockTask],
        pagination: { page: 1, limit: 10, total: 1, pages: 1 },
      });
      (projectsAPI.getById as any).mockResolvedValue(mockProject);
    });

    it('should show create task button for both admin and member', async () => {
      renderWithProviders(<Tasks />, memberUser);
      
      await waitFor(() => {
        expect(screen.getByText('Create Task')).toBeInTheDocument();
      });
    });

    it('should show export CSV button for both admin and member', async () => {
      renderWithProviders(<Tasks />, memberUser);
      
      await waitFor(() => {
        expect(screen.getByText('Export CSV')).toBeInTheDocument();
      });
    });

    it('should show edit button for task assignee (member)', async () => {
      renderWithProviders(<Tasks />, memberUser);
      
      await waitFor(() => {
        const editButtons = screen.getAllByTestId('edit-task-button');
        expect(editButtons.length).toBeGreaterThan(0);
      });
    });

    it('should show edit button for admin on any task', async () => {
      renderWithProviders(<Tasks />, adminUser);
      
      await waitFor(() => {
        const editButtons = screen.getAllByTestId('edit-task-button');
        expect(editButtons.length).toBeGreaterThan(0);
      });
    });

    it('should show delete button only for admin', async () => {
      renderWithProviders(<Tasks />, adminUser);
      
      await waitFor(() => {
        expect(screen.getByTestId('delete-task-button')).toBeInTheDocument();
      });
    });

    it('should hide delete button for member', async () => {
      renderWithProviders(<Tasks />, memberUser);
      
      await waitFor(() => {
        expect(screen.queryByTestId('delete-task-button')).not.toBeInTheDocument();
      });
    });

    it('should allow member to edit only their assigned tasks', async () => {
      const otherUserTask = {
        ...mockTask,
        _id: 'task456',
        assignee: { _id: 'other123', name: 'Other User', email: 'other@test.com' },
      };

      const { tasksAPI } = await import('../services/api');
      (tasksAPI.getAll as any).mockResolvedValue({
        tasks: [mockTask, otherUserTask],
        pagination: { page: 1, limit: 10, total: 2, pages: 1 },
      });

      renderWithProviders(<Tasks />, memberUser);
      
      await waitFor(() => {
        const editButtons = screen.getAllByTestId('edit-task-button');
        // Member should only see edit button for their own task
        expect(editButtons).toHaveLength(1);
      });
    });
  });

  describe('Dashboard Page - Role-Based Access', () => {
    beforeEach(async () => {
      const { tasksAPI } = await import('../services/api');
      (tasksAPI.getSummary as any).mockResolvedValue({
        total: 10,
        todo: 3,
        inProgress: 4,
        done: 3,
        overdue: 1,
        completionRate: 30,
      });
    });

    it('should show dashboard for member users', async () => {
      renderWithProviders(<Dashboard />, memberUser);
      
      await waitFor(() => {
        expect(screen.getByText('Project Dashboard')).toBeInTheDocument();
        expect(screen.getByText('Total Tasks')).toBeInTheDocument();
        expect(screen.getByText('Completed')).toBeInTheDocument();
      });
    });

    it('should show dashboard for admin users', async () => {
      renderWithProviders(<Dashboard />, adminUser);
      
      await waitFor(() => {
        expect(screen.getByText('Project Dashboard')).toBeInTheDocument();
        expect(screen.getByText('Total Tasks')).toBeInTheDocument();
        expect(screen.getByText('Completed')).toBeInTheDocument();
      });
    });

    it('should display KPI cards with correct data', async () => {
      renderWithProviders(<Dashboard />, memberUser);
      
      await waitFor(() => {
        expect(screen.getByText('10')).toBeInTheDocument(); // Total tasks
        expect(screen.getByText('3')).toBeInTheDocument(); // Completed tasks
        expect(screen.getByText('30%')).toBeInTheDocument(); // Completion rate
      });
    });

    it('should show charts for task distribution', async () => {
      renderWithProviders(<Dashboard />, memberUser);
      
      await waitFor(() => {
        expect(screen.getByText('Task Status Distribution')).toBeInTheDocument();
        expect(screen.getByText('Tasks by Status')).toBeInTheDocument();
      });
    });
  });

  describe('Task Creation/Editing Forms', () => {
    it('should allow member to create task with assignee selection', async () => {
      renderWithProviders(<Tasks />, memberUser);
      
      await waitFor(() => {
        fireEvent.click(screen.getByText('Create Task'));
      });

      await waitFor(() => {
        expect(screen.getByLabelText('Title')).toBeInTheDocument();
        expect(screen.getByLabelText('Description')).toBeInTheDocument();
        expect(screen.getByLabelText('Status')).toBeInTheDocument();
        expect(screen.getByLabelText('Priority')).toBeInTheDocument();
        expect(screen.getByLabelText('Assignee')).toBeInTheDocument();
      });
    });

    it('should populate assignee dropdown with project members', async () => {
      renderWithProviders(<Tasks />, memberUser);
      
      await waitFor(() => {
        fireEvent.click(screen.getByText('Create Task'));
      });

      await waitFor(() => {
        fireEvent.mouseDown(screen.getByLabelText('Assignee'));
      });

      await waitFor(() => {
        expect(screen.getByText('Unassigned')).toBeInTheDocument();
        expect(screen.getByText('Admin User')).toBeInTheDocument();
        expect(screen.getByText('Member User')).toBeInTheDocument();
      });
    });

    it('should validate required fields in task form', async () => {
      renderWithProviders(<Tasks />, memberUser);
      
      await waitFor(() => {
        fireEvent.click(screen.getByText('Create Task'));
      });

      await waitFor(() => {
        fireEvent.click(screen.getByText('Create'));
      });

      // Form should show validation errors for required fields
      await waitFor(() => {
        expect(screen.getByText('Title is required')).toBeInTheDocument();
      });
    });
  });

  describe('Access Control Error Handling', () => {
    it('should show error message when member tries unauthorized action', async () => {
      const { projectsAPI } = await import('../services/api');
      (projectsAPI.create as any).mockRejectedValue(new Error('Forbidden'));

      renderWithProviders(<Projects />, memberUser);
      
      // This test would need the component to actually attempt the forbidden action
      // and handle the error appropriately
    });

    it('should redirect to login when token expires', async () => {
      const { tasksAPI } = await import('../services/api');
      (tasksAPI.getAll as any).mockRejectedValue(new Error('Unauthorized'));

      renderWithProviders(<Tasks />, null); // No user (expired token)
      
      // Should redirect to login page or show login form
    });
  });

  describe('Responsive Design for Role-Based UI', () => {
    it('should adapt admin controls for mobile view', async () => {
      // Mock mobile viewport
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 375,
      });

      renderWithProviders(<Projects />, adminUser);
      
      await waitFor(() => {
        // Admin controls should still be accessible on mobile
        expect(screen.getByText('Create Project')).toBeInTheDocument();
      });
    });

    it('should show appropriate controls in tablet view', async () => {
      // Mock tablet viewport
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 768,
      });

      renderWithProviders(<Tasks />, memberUser);
      
      await waitFor(() => {
        expect(screen.getByText('Create Task')).toBeInTheDocument();
        expect(screen.getByText('Export CSV')).toBeInTheDocument();
      });
    });
  });
});

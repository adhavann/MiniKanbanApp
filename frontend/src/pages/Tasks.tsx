import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
  Alert,
} from '@mui/material';
import { Add, Edit, Delete, FilterList, GetApp } from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import dayjs from 'dayjs';
import { useAuth } from '../hooks/useAuth';
import { useParams, useNavigate } from 'react-router-dom';
import { tasksAPI, projectsAPI } from '../services/api';
import { Task, Project, TaskFilters, User } from '../types';
import { useAlert } from '../hooks/useAlert';

const Tasks: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [project, setProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [pagination, setPagination] = useState({ page: 0, limit: 10, total: 0, pages: 0 });
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [filterDialogOpen, setFilterDialogOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  const { message: error, severity: errorSeverity, showAlert: showError, hideAlert: hideError, hasMessage: hasError } = useAlert();

  const [filters, setFilters] = useState<TaskFilters>({
    page: 1,
    limit: 10,
    status: undefined,
    assignee: undefined,
    priority: undefined,
    q: undefined,
  });

  // Temporary filters for the dialog (only applied when Apply is clicked)
  const [tempFilters, setTempFilters] = useState<TaskFilters>({
    page: 1,
    limit: 10,
    status: undefined,
    assignee: undefined,
    priority: undefined,
    q: undefined,
  });

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    status: 'todo',
    priority: '',
    assignee: '',
    dueDate: null as dayjs.Dayjs | null,
  });

  const [users, setUsers] = useState<User[]>([]);

  useEffect(() => {
    if (projectId) {
      loadProject();
      loadTasks();
      loadUsers();
    }
  }, [projectId, filters]);

  const loadUsers = async () => {
    try {
      const projectsResponse = await projectsAPI.getAll();
      const usersMap = new Map<string, any>();

      // Extract users from projects data
      projectsResponse.data.forEach((projectData: any) => {
        // Add project creator if not already added
        if (projectData.createdBy && projectData.createdBy._id && projectData.createdBy.name) {
          usersMap.set(projectData.createdBy._id, {
            _id: projectData.createdBy._id,
            name: projectData.createdBy.name,
            email: projectData.createdBy.email || `${projectData.createdBy.name.toLowerCase().replace(/\s+/g, '.')}@example.com`
          });
        }

        // For members, create placeholder entries since we can't fetch user details
        if (projectData.members && Array.isArray(projectData.members)) {
          projectData.members.forEach((memberId: string) => {
            if (memberId && typeof memberId === 'string' && !usersMap.has(memberId)) {
              // If this member ID matches the current user, use their info
              if (user?._id === memberId) {
                usersMap.set(memberId, {
                  _id: memberId,
                  name: user.name,
                  email: user.email
                });
              } else {
                // Create a placeholder for unknown users
                usersMap.set(memberId, {
                  _id: memberId,
                  name: `User ${memberId.slice(-4)}`,
                  email: `user${memberId.slice(-4)}@example.com`
                });
              }
            }
          });
        }
      });

      const users = Array.from(usersMap.values());
      console.log('Loaded users:', users);
      setUsers(users);

    } catch (err) {
      console.error('Failed to load users:', err);
      // Fallback: create basic user entries from current project
      if (project?.members && Array.isArray(project.members)) {
        const fallbackUsers: User[] = (project.members as any).map((memberId: string) => {
          if (user?._id === memberId) {
            return {
              _id: memberId,
              name: user.name,
              email: user.email,
              role: user.role
            };
          }
          return {
            _id: memberId,
            name: `User ${memberId.slice(-4)}`,
            email: `user${memberId.slice(-4)}@example.com`,
            role: 'member' as const
          };
        });
        setUsers(fallbackUsers);
      }
    }
  };

  const loadProject = async () => {
    if (!projectId) return;
    try {
      const response = await projectsAPI.getById(projectId);
      setProject(response.data);
      console.log('Project loaded:', response.data);
      console.log('Project members:', response.data.members);
    } catch (err: any) {
      showError(err.response?.data?.message || 'Failed to load project');
    }
  };

  const loadTasks = async () => {
    if (!projectId) return;
    try {
      const response = await tasksAPI.getAll(projectId, filters);
      setTasks(response.data.tasks);
      setPagination(response.data.pagination);
    } catch (err: any) {
      showError(err.response?.data?.message || 'Failed to load tasks');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTask = async () => {
    if (!projectId) return;
    try {
      await tasksAPI.create(projectId, {
        ...formData,
        assignee: formData.assignee || undefined,
        dueDate: formData.dueDate?.toISOString(),
      });
      setCreateDialogOpen(false);
      resetForm();
      loadTasks();
    } catch (err: any) {
      showError(err.response?.data?.message || 'Failed to create task');
    }
  };

  const handleEditTask = async () => {
    if (!selectedTask) return;
    try {
      await tasksAPI.update(selectedTask._id, {
        ...formData,
        assignee: formData.assignee || undefined,
        dueDate: formData.dueDate?.toISOString(),
      });
      setEditDialogOpen(false);
      setSelectedTask(null);
      resetForm();
      loadTasks();
    } catch (err: any) {
      showError(err.response?.data?.message || 'Failed to update task');
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    if (!window.confirm('Are you sure you want to delete this task?')) return;
    try {
      await tasksAPI.delete(taskId);
      loadTasks();
    } catch (err: any) {
      showError(err.response?.data?.message || 'Failed to delete task');
    }
  };

  const handleStatusChange = async (taskId: string, newStatus: string) => {
    try {
      await tasksAPI.update(taskId, { status: newStatus });
      loadTasks();
    } catch (err: any) {
      showError(err.response?.data?.message || 'Failed to update task status');
    }
  };

  const handleExportCsv = async () => {
    if (!projectId) return;
    try {
      const response = await tasksAPI.exportCsv(projectId);
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${project?.name || 'project'}_tasks.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err: any) {
      showError(err.response?.data?.message || 'Failed to export tasks');
    }
  };

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      status: 'todo',
      priority: '',
      assignee: '',
      dueDate: null,
    });
  };

  const openEditDialog = (task: Task) => {
    setSelectedTask(task);
    setFormData({
      title: task.title,
      description: task.description || '',
      status: task.status,
      priority: task.priority,
      assignee: task.assignee?._id || '',
      dueDate: task.dueDate ? dayjs(task.dueDate) : null,
    });
    setEditDialogOpen(true);
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'low': return 'success';
      case 'med': return 'warning';
      case 'high': return 'error';
      default: return 'default';
    }
  };

  const canEditTask = (task: Task) => {
    return user?.role === 'admin' || task.assignee?._id === user?._id;
  };

  const canDeleteTask = () => {
    return user?.role === 'admin';
  };

  if (loading) {
    return <Typography>Loading tasks...</Typography>;
  }

  return (
    <LocalizationProvider dateAdapter={AdapterDayjs}>
      <Box>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
          <Box>
            <Typography variant="h4" component="h1">
              Tasks
            </Typography>
            {project && (
              <Typography variant="subtitle1" color="text.secondary">
                {project.name} ({project.key})
              </Typography>
            )}
          </Box>
          <Box display="flex" gap={1}>
            <Button onClick={() => {
            setFilterDialogOpen(true);
            setTempFilters(filters); // Initialize temp filters with current filters
          }}>
            <FilterList sx={{ mr: 1 }} />
            Filters
          </Button>
            <Button
              variant="outlined"
              startIcon={<GetApp />}
              onClick={handleExportCsv}
            >
              Export CSV
            </Button>
            <Button
              variant="contained"
              startIcon={<Add />}
              onClick={() => {
                resetForm();
                setCreateDialogOpen(true);
              }}
            >
              Create Task
            </Button>
          </Box>
        </Box>

        {hasError && (
          <Alert
            severity={errorSeverity}
            sx={{ mb: 2 }}
            onClose={() => hideError()}
          >
            {error}
          </Alert>
        )}

        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Title</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Priority</TableCell>
                <TableCell>Assignee</TableCell>
                <TableCell>Due Date</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {tasks.map((task) => (
                <TableRow key={task._id}>
                  <TableCell>
                    <Typography variant="subtitle2">{task.title}</Typography>
                    {task.description && (
                      <Typography variant="body2" color="text.secondary">
                        {task.description}
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    <FormControl size="small" sx={{ minWidth: 120 }}>
                      <Select
                        value={task.status}
                        onChange={(e) => handleStatusChange(task._id, e.target.value)}
                        disabled={!canEditTask(task)}
                      >
                        <MenuItem value="todo">To Do</MenuItem>
                        <MenuItem value="in_progress">In Progress</MenuItem>
                        <MenuItem value="done">Done</MenuItem>
                      </Select>
                    </FormControl>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={task.priority.toUpperCase()}
                      size="small"
                      color={getPriorityColor(task.priority)}
                    />
                  </TableCell>
                  <TableCell>
                    {task.assignee ? task.assignee.name : 'Unassigned'}
                  </TableCell>
                  <TableCell>
                    {task.dueDate ? dayjs(task.dueDate).format('MMM DD, YYYY') : '-'}
                  </TableCell>
                  <TableCell>
                    {canEditTask(task) && (
                      <IconButton size="small" onClick={() => openEditDialog(task)}>
                        <Edit />
                      </IconButton>
                    )}
                    {canDeleteTask() && (
                      <IconButton size="small" onClick={() => handleDeleteTask(task._id)}>
                        <Delete />
                      </IconButton>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>

        <TablePagination
          component="div"
          count={pagination.total}
          page={pagination.page - 1}
          onPageChange={(_, newPage) => setFilters({ ...filters, page: newPage + 1 })}
          rowsPerPage={pagination.limit}
          onRowsPerPageChange={(e) => setFilters({ ...filters, limit: parseInt(e.target.value), page: 1 })}
        />

        {/* Filter Dialog */}
        <Dialog open={filterDialogOpen} onClose={() => {
          setTempFilters(filters); // Reset temp filters to current filters on close
          setFilterDialogOpen(false);
        }} maxWidth="md" fullWidth>
          <DialogTitle>Filter Tasks</DialogTitle>
          <DialogContent>
            <Grid container spacing={2} sx={{ mt: 1 }}>
              <Grid item xs={6}>
                <FormControl fullWidth>
                  <InputLabel>Status</InputLabel>
                  <Select
                    value={tempFilters.status || ''}
                    label="Status"
                    onChange={(e) => setTempFilters({ ...tempFilters, status: e.target.value })}
                  >
                    <MenuItem value="">All Statuses</MenuItem>
                    <MenuItem value="todo">To Do</MenuItem>
                    <MenuItem value="in_progress">In Progress</MenuItem>
                    <MenuItem value="done">Done</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={6}>
                <FormControl fullWidth>
                  <InputLabel>Priority</InputLabel>
                  <Select
                    value={tempFilters.priority || ''}
                    label="Priority"
                    onChange={(e) => setTempFilters({ ...tempFilters, priority: e.target.value })}
                  >
                    <MenuItem value="">All Priorities</MenuItem>
                    <MenuItem value="low">Low</MenuItem>
                    <MenuItem value="medium">Medium</MenuItem>
                    <MenuItem value="high">High</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={6}>
                <FormControl fullWidth>
                  <InputLabel>Assignee</InputLabel>
                  <Select
                    value={tempFilters.assignee || ''}
                    label="Assignee"
                    onChange={(e) => setTempFilters({ ...tempFilters, assignee: e.target.value })}
                  >
                    <MenuItem value="">All Assignees</MenuItem>
                    <MenuItem value="unassigned">Unassigned</MenuItem>
                    {users && users.length > 0 ? (
                      users.map((user) => (
                        <MenuItem key={user._id} value={user._id}>
                          {user.name}
                        </MenuItem>
                      ))
                    ) : (
                      <MenuItem disabled>
                        <em>Loading users...</em>
                      </MenuItem>
                    )}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={6}>
                <TextField
                  fullWidth
                  label="Search"
                  value={tempFilters.q || ''}
                  onChange={(e) => setTempFilters({ ...tempFilters, q: e.target.value || undefined })}
                  placeholder="Search tasks..."
                />
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => {
              setTempFilters({ page: 1, limit: 10 });
              setFilters({ page: 1, limit: 10 });
              setFilterDialogOpen(false);
            }}>Clear Filters</Button>
            <Button onClick={() => setFilterDialogOpen(false)}>Close</Button>
            <Button onClick={() => {
              // Apply filters, converting empty strings to undefined
              setFilters({ 
                ...tempFilters, 
                page: 1,
                status: tempFilters.status || undefined,
                priority: tempFilters.priority || undefined,
                assignee: tempFilters.assignee || undefined,
                q: tempFilters.q || undefined
              });
              setFilterDialogOpen(false);
            }} variant="contained">Apply Filters</Button>
          </DialogActions>
        </Dialog>

        {/* Create Task Dialog */}
        <Dialog open={createDialogOpen} onClose={() => {
          resetForm();
          setCreateDialogOpen(false);
        }} maxWidth="md" fullWidth>
          <DialogTitle>Create New Task</DialogTitle>
          <DialogContent>
            <Grid container spacing={2} sx={{ mt: 1 }}>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  multiline
                  rows={3}
                  label="Description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />
              </Grid>
              <Grid item xs={6}>
                <FormControl fullWidth>
                  <InputLabel>Status</InputLabel>
                  <Select
                    value={formData.status}
                    label="Status"
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  >
                    <MenuItem value="todo">To Do</MenuItem>
                    <MenuItem value="in_progress">In Progress</MenuItem>
                    <MenuItem value="done">Done</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={6}>
                <FormControl fullWidth>
                  <InputLabel>Priority</InputLabel>
                  <Select
                    value={formData.priority}
                    label="Priority"
                    onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                  >
                    <MenuItem value="low">Low</MenuItem>
                    <MenuItem value="medium">Medium</MenuItem>
                    <MenuItem value="high">High</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={6}>
                <FormControl fullWidth>
                  <InputLabel>Assignee</InputLabel>
                  <Select
                    value={formData.assignee}
                    label="Assignee"
                    onChange={(e) => setFormData({ ...formData, assignee: e.target.value })}
                  >
                    <MenuItem value="">Unassigned</MenuItem>
                    {users && users.length > 0 ? (
                      users.map((user) => (
                        <MenuItem key={user._id} value={user._id}>
                          {user.name}
                        </MenuItem>
                      ))
                    ) : (
                      <MenuItem disabled>
                        <em>Loading users...</em>
                      </MenuItem>
                    )}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={6}>
                <DatePicker
                  label="Due Date"
                  value={formData.dueDate}
                  onChange={(date) => setFormData({ ...formData, dueDate: date })}
                  slotProps={{ textField: { fullWidth: true } }}
                />
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => {
              resetForm();
              setCreateDialogOpen(false);
            }}>Cancel</Button>
            <Button onClick={handleCreateTask} variant="contained">Create</Button>
          </DialogActions>
        </Dialog>

        {/* Edit Task Dialog */}
        <Dialog open={editDialogOpen} onClose={() => {
          resetForm();
          setEditDialogOpen(false);
          setSelectedTask(null);
        }} maxWidth="md" fullWidth>
          <DialogTitle>Edit Task</DialogTitle>
          <DialogContent>
            <Grid container spacing={2} sx={{ mt: 1 }}>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  multiline
                  rows={3}
                  label="Description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />
              </Grid>
              <Grid item xs={6}>
                <FormControl fullWidth>
                  <InputLabel>Status</InputLabel>
                  <Select
                    value={formData.status}
                    label="Status"
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  >
                    <MenuItem value="todo">To Do</MenuItem>
                    <MenuItem value="in_progress">In Progress</MenuItem>
                    <MenuItem value="done">Done</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={6}>
                <FormControl fullWidth>
                  <InputLabel>Priority</InputLabel>
                  <Select
                    value={formData.priority}
                    label="Priority"
                    onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                  >
                    <MenuItem value="low">Low</MenuItem>
                    <MenuItem value="medium">Medium</MenuItem>
                    <MenuItem value="high">High</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={6}>
                <FormControl fullWidth>
                  <InputLabel>Assignee</InputLabel>
                  <Select
                    value={formData.assignee}
                    label="Assignee"
                    onChange={(e) => setFormData({ ...formData, assignee: e.target.value })}
                  >
                    <MenuItem value="">Unassigned</MenuItem>
                    {users && users.length > 0 ? (
                      users.map((user) => (
                        <MenuItem key={user._id} value={user._id}>
                          {user.name}
                        </MenuItem>
                      ))
                    ) : (
                      <MenuItem disabled>
                        <em>Loading users...</em>
                      </MenuItem>
                    )}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={6}>
                <DatePicker
                  label="Due Date"
                  value={formData.dueDate}
                  onChange={(date) => setFormData({ ...formData, dueDate: date })}
                  slotProps={{ textField: { fullWidth: true } }}
                />
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => {
              resetForm();
              setEditDialogOpen(false);
              setSelectedTask(null);
            }}>Cancel</Button>
            <Button onClick={handleEditTask} variant="contained">Update</Button>
          </DialogActions>
        </Dialog>
      </Box>
    </LocalizationProvider>
  );
};

export default Tasks;

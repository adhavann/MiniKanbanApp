import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  CardActions,
  Grid,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Alert,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  OutlinedInput,
  SelectChangeEvent,
} from '@mui/material';
import { Add, Edit, Delete, People, Dashboard } from '@mui/icons-material';
import { useAuth } from '../hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { projectsAPI, usersAPI } from '../services/api';
import { Project, User } from '../types';
import { useAlert } from '../hooks/useAlert';

const Projects: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [formData, setFormData] = useState({ 
    name: '', 
    key: '',
    members: [] as string[]
  });
  const [allUsers, setAllUsers] = useState<User[]>([]);

  const { message: error, severity: errorSeverity, showAlert: showError, hideAlert: hideError, hasMessage: hasError } = useAlert();

  useEffect(() => {
    loadProjects();
    loadUsers();
  }, []);

  const loadProjects = async () => {
    try {
      const response = await projectsAPI.getAll();
      setProjects(response.data);
    } catch (err: any) {
      showError(err.response?.data?.message || 'Failed to load projects');
    } finally {
      setLoading(false);
    }
  };

  const loadUsers = async () => {
    try {
      const response = await usersAPI.getAll();
      setAllUsers(response.data);
    } catch (err: any) {
      console.error('Failed to load users:', err);
    }
  };

  const handleCreateProject = async () => {
    try {
      await projectsAPI.create(formData);
      setCreateDialogOpen(false);
      setFormData({ name: '', key: '', members: [] });
      loadProjects();
    } catch (err: any) {
      showError(err.response?.data?.message || 'Failed to create project');
    }
  };

  const handleEditProject = async () => {
    if (!selectedProject) return;
    
    try {
      await projectsAPI.update(selectedProject._id, { 
        name: formData.name, 
        key: formData.key,
        members: formData.members 
      });
      setEditDialogOpen(false);
      setSelectedProject(null);
      setFormData({ name: '', key: '', members: [] });
      loadProjects();
    } catch (err: any) {
      showError(err.response?.data?.message || 'Failed to update project');
    }
  };

  const handleDeleteProject = async (projectId: string) => {
    if (!window.confirm('Are you sure you want to delete this project?')) return;
    
    try {
      await projectsAPI.delete(projectId);
      loadProjects();
    } catch (err: any) {
      showError(err.response?.data?.message || 'Failed to delete project');
    }
  };

  const handleDashboardClick = (project: Project) => {
    try {
      // Check if user is a member of this project
      if (user?.role !== 'admin') {
        const isMember = project.members.some(member => {
          // Handle both populated objects and string IDs
          const memberId = typeof member === 'string' ? member : member._id;
          // User object from auth has 'id' property, not '_id'
          const userId = (user as any)?.id;
          return memberId === userId;
        });
        
        if (!isMember) {
          showError('You do not have access to this project dashboard');
          return;
        }
      }
      
      navigate(`/projects/${project._id}/dashboard`);
    } catch (err) {
      showError('Failed to navigate to dashboard');
    }
  };

  const openEditDialog = (project: Project) => {
    setSelectedProject(project);
    setFormData({ 
      name: project.name, 
      key: project.key,
      members: project.members?.map(m => {
        const id = typeof m === 'string' ? m : (m._id || m.id);
        return id || '';
      }).filter(id => id !== '') || []
    });
    setEditDialogOpen(true);
  };

  if (loading) {
    return <Typography>Loading projects...</Typography>;
  }

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" component="h1">
          Projects
        </Typography>
        {user?.role === 'admin' && (
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={() => setCreateDialogOpen(true)}
          >
            Create Project
          </Button>
        )}
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

      <Grid container spacing={3}>
        {projects.map((project) => (
          <Grid item xs={12} sm={6} md={4} key={project._id}>
            <Card>
              <CardContent>
                <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={2}>
                  <Typography variant="h6" component="h2">
                    {project.name}
                  </Typography>
                  <Chip label={project.key} size="small" />
                </Box>
                
                <Typography color="text.secondary" gutterBottom>
                  Created by: {project.createdBy.name}
                </Typography>
                
                <Box display="flex" alignItems="center" gap={1} mb={1}>
                  <People fontSize="small" />
                  <Typography variant="body2">
                    {project.members.length} member{project.members.length !== 1 ? 's' : ''}
                  </Typography>
                </Box>
                
                <Typography variant="body2" color="text.secondary">
                  Created: {new Date(project.createdAt).toLocaleDateString()}
                </Typography>
              </CardContent>
              
              <CardActions>
                <Button
                  size="small"
                  startIcon={<Dashboard />}
                  onClick={() => handleDashboardClick(project)}
                >
                  Dashboard
                </Button>
                <Button
                  size="small"
                  onClick={() => navigate(`/projects/${project._id}/tasks`)}
                >
                  Tasks
                </Button>
                
                {user?.role === 'admin' && (
                  <>
                    <IconButton
                      size="small"
                      onClick={() => openEditDialog(project)}
                    >
                      <Edit />
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={() => handleDeleteProject(project._id)}
                    >
                      <Delete />
                    </IconButton>
                  </>
                )}
              </CardActions>
            </Card>
          </Grid>
        ))}
      </Grid>

      {projects.length === 0 && (
        <Box textAlign="center" mt={4}>
          <Typography variant="h6" color="text.secondary">
            No projects found
          </Typography>
          {user?.role === 'admin' && (
            <Typography variant="body2" color="text.secondary" mt={1}>
              Create your first project to get started
            </Typography>
          )}
        </Box>
      )}

      {/* Create Project Dialog */}
      <Dialog open={createDialogOpen} onClose={() => setCreateDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Create New Project</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Project Name"
            fullWidth
            variant="outlined"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            sx={{ mb: 2 }}
          />
          <TextField
            margin="dense"
            label="Project Key"
            fullWidth
            variant="outlined"
            value={formData.key}
            onChange={(e) => setFormData({ ...formData, key: e.target.value.toUpperCase() })}
            helperText="Short identifier for the project (e.g., KAN, PROJ)"
            sx={{ mb: 2 }}
          />
          <FormControl fullWidth>
            <InputLabel>Members</InputLabel>
            <Select
              multiple
              value={formData.members}
              onChange={(e: SelectChangeEvent<string[]>) => 
                setFormData({ ...formData, members: e.target.value as string[] })
              }
              input={<OutlinedInput label="Members" />}
              renderValue={(selected) => {
                const selectedUsers = allUsers.filter(u => {
                  const userId = u._id || u.id || '';
                  return selected.includes(userId);
                });
                return selectedUsers.map(u => u.name).join(', ');
              }}
            >
              {allUsers
                .filter(u => u._id !== (user as any)?.id) // Exclude current user (creator)
                .map((u) => (
                  <MenuItem key={u._id || u.id} value={u._id || u.id || ''}>
                    {u.name} ({u.email})
                  </MenuItem>
                ))}
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleCreateProject} variant="contained">Create</Button>
        </DialogActions>
      </Dialog>

      {/* Edit Project Dialog */}
      <Dialog open={editDialogOpen} onClose={() => setEditDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Edit Project</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Project Name"
            fullWidth
            variant="outlined"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            sx={{ mb: 2 }}
          />
          <TextField
            margin="dense"
            label="Project Key"
            fullWidth
            variant="outlined"
            value={formData.key}
            onChange={(e) => setFormData({ ...formData, key: e.target.value.toUpperCase() })}
            helperText="Short identifier for the project (e.g., KAN, PROJ)"
            sx={{ mb: 2 }}
          />
          <FormControl fullWidth>
            <InputLabel>Members</InputLabel>
            <Select
              multiple
              value={formData.members}
              onChange={(e: SelectChangeEvent<string[]>) => 
                setFormData({ ...formData, members: e.target.value as string[] })
              }
              input={<OutlinedInput label="Members" />}
              renderValue={(selected) => {
                const selectedUsers = allUsers.filter(u => {
                  const userId = u._id || u.id || '';
                  return selected.includes(userId);
                });
                return selectedUsers.map(u => u.name).join(', ');
              }}
            >
              {allUsers
                .filter(u => {
                  // Get the creator ID properly - it might be an object or string
                  const creatorId = typeof selectedProject?.createdBy === 'object' 
                    ? selectedProject.createdBy._id 
                    : selectedProject?.createdBy;
                  
                  // Exclude the project creator from the list
                  return u._id !== creatorId;
                })
                .map((u) => (
                  <MenuItem key={u._id} value={u._id}>
                    {u.name} ({u.email})
                  </MenuItem>
                ))}
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleEditProject} variant="contained">Update</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Projects;

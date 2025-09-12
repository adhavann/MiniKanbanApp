import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  Paper,
  Alert,
} from '@mui/material';
import {
  Assignment,
  CheckCircle,
  Schedule,
  Warning,
  TrendingUp,
} from '@mui/icons-material';
import { PieChart } from '@mui/x-charts/PieChart';
import { BarChart } from '@mui/x-charts/BarChart';
import { useParams } from 'react-router-dom';
import { tasksAPI, projectsAPI } from '../services/api';
import { Project, ProjectSummary } from '../types';
import { useAlert } from '../hooks/useAlert';
import { useAuth } from '../hooks/useAuth';

const Dashboard: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const { user } = useAuth();
  const [project, setProject] = useState<Project | null>(null);
  const [summary, setSummary] = useState<ProjectSummary | null>(null);
  const [loading, setLoading] = useState(true);

  const { message: error, severity: errorSeverity, showAlert: showError, hideAlert: hideError, hasMessage: hasError } = useAlert();

  useEffect(() => {
    if (projectId) {
      loadData();
    }
  }, [projectId]);

  const loadData = async () => {
    if (!projectId) return;
    
    try {
      // Try to load both project and summary
      const [projectResponse, summaryResponse] = await Promise.all([
        projectsAPI.getById(projectId).catch(() => null),
        tasksAPI.getSummary(projectId),
      ]);
      
      if (projectResponse) {
        setProject(projectResponse.data);
      }
      setSummary(summaryResponse.data);
    } catch (err: any) {
      // Show error for all access denied cases
      showError(err.response?.data?.message || 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <Typography>Loading dashboard...</Typography>;
  }

  if (hasError) {
    return (
      <Alert 
        severity={errorSeverity}
        onClose={hideError}
      >
        {error}
      </Alert>
    );
  }

  if (!summary) {
    return (
      <Alert 
        severity="info" 
        onClose={() => window.location.reload()}
      >
        No data available
      </Alert>
    );
  }

  // For members, show simplified dashboard even without full project access
  const isAdmin = user?.role === 'admin';

  const pieData = [
    { id: 0, value: summary.todo, label: 'To Do', color: '#2196f3' },
    { id: 1, value: summary.inProgress, label: 'In Progress', color: '#ff9800' },
    { id: 2, value: summary.done, label: 'Done', color: '#4caf50' },
  ].filter(item => item.value > 0);

  const barData = [
    { status: 'To Do', count: summary.todo },
    { status: 'In Progress', count: summary.inProgress },
    { status: 'Done', count: summary.done },
  ].filter(item => item.count > 0); // Only include items with count > 0

  return (
    <Box>
      <Typography variant="h4" component="h1" gutterBottom>
        Dashboard
      </Typography>
      {project && (
        <Typography variant="subtitle1" color="text.secondary" gutterBottom>
          {project.name} ({project.key})
        </Typography>
      )}
      {!project && !isAdmin && (
        <Typography variant="subtitle1" color="text.secondary" gutterBottom>
          Project Summary
        </Typography>
      )}

      {summary && (
        <Grid container spacing={3}>
        {/* Basic KPI Cards - Visible to all */}
        <Grid item xs={12} sm={6} md={isAdmin ? 3 : 4}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center">
                <Assignment color="primary" sx={{ mr: 2 }} />
                <Box>
                  <Typography color="text.secondary" gutterBottom>
                    Total Tasks
                  </Typography>
                  <Typography variant="h4">
                    {summary.total}
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={isAdmin ? 3 : 4}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center">
                <Schedule color="warning" sx={{ mr: 2 }} />
                <Box>
                  <Typography color="text.secondary" gutterBottom>
                    In Progress
                  </Typography>
                  <Typography variant="h4">
                    {summary.inProgress}
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={isAdmin ? 3 : 4}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center">
                <CheckCircle color="success" sx={{ mr: 2 }} />
                <Box>
                  <Typography color="text.secondary" gutterBottom>
                    Completed
                  </Typography>
                  <Typography variant="h4">
                    {summary.done}
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Admin-only cards */}
        {isAdmin && (
          <>
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Box display="flex" alignItems="center">
                    <Warning color="error" sx={{ mr: 2 }} />
                    <Box>
                      <Typography color="text.secondary" gutterBottom>
                        Overdue
                      </Typography>
                      <Typography variant="h4">
                        {summary.overdue}
                      </Typography>
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            </Grid>

            {/* Completion Rate - Admin only */}
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Box display="flex" alignItems="center" mb={2}>
                    <TrendingUp color="primary" sx={{ mr: 1 }} />
                    <Typography variant="h6">
                      Completion Rate
                    </Typography>
                  </Box>
                  <Typography variant="h3" color="primary">
                    {summary.completionRate}%
                  </Typography>
                  <Typography color="text.secondary">
                    {summary.done} of {summary.total} tasks completed
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </>
        )}

        {/* Task Distribution Pie Chart - Visible to all but positioned differently */}
        <Grid item xs={12} md={isAdmin ? 6 : 12}>
          <Paper sx={{ p: 2, height: 300 }}>
            <Typography variant="h6" gutterBottom>
              Task Distribution
            </Typography>
            {pieData.length > 0 ? (
              <PieChart
                series={[
                  {
                    data: pieData,
                    highlightScope: { faded: 'global', highlighted: 'item' },
                    faded: { innerRadius: 30, additionalRadius: -30, color: 'gray' },
                  },
                ]}
                height={250}
              />
            ) : (
              <Box display="flex" alignItems="center" justifyContent="center" height={250}>
                <Typography color="text.secondary">No tasks to display</Typography>
              </Box>
            )}
          </Paper>
        </Grid>

        {/* Task Status Bar Chart */}
        <Grid item xs={12}>
          <Paper sx={{ p: 2, height: 300 }}>
            <Typography variant="h6" gutterBottom>
              Tasks by Status
            </Typography>
            {barData.length > 0 ? (
              <BarChart
                xAxis={[{ 
                  scaleType: 'band', 
                  data: barData.map(item => item.status)
                }]}
                series={[{ 
                  data: barData.map(item => item.count),
                  label: 'Tasks',
                  color: '#1976d2'
                }]}
                height={250}
              />
            ) : (
              <Box display="flex" alignItems="center" justifyContent="center" height={250}>
                <Typography color="text.secondary">No tasks to display</Typography>
              </Box>
            )}
          </Paper>
        </Grid>
      </Grid>
      )}
    </Box>
  );
};

export default Dashboard;

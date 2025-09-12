import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Request, Query, Res } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { Response } from 'express';
import { TasksService } from './tasks.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { QueryTasksDto } from './dto/query-tasks.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../common/enums';

@ApiTags('Tasks')
@Controller()
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Post('projects/:projectId/tasks')
  @ApiOperation({ summary: 'Create a new task in a project' })
  @ApiResponse({ status: 201, description: 'Task created successfully' })
  @ApiResponse({ status: 404, description: 'Project not found' })
  @ApiResponse({ status: 403, description: 'Access denied to this project' })
  create(@Param('projectId') projectId: string, @Body() createTaskDto: CreateTaskDto, @Request() req) {
    const userId = req.user._id.toString();
    return this.tasksService.create(projectId, createTaskDto, userId, req.user.role);
  }

  @Get('projects/:projectId/tasks')
  @ApiOperation({ summary: 'Get all tasks in a project with filtering and pagination' })
  @ApiResponse({ status: 200, description: 'Tasks retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Project not found' })
  @ApiResponse({ status: 403, description: 'Access denied to this project' })
  findAll(@Param('projectId') projectId: string, @Query() query: QueryTasksDto, @Request() req) {
    const userId = req.user._id.toString();
    return this.tasksService.findAll(projectId, query, userId, req.user.role);
  }

  @Get('tasks/:id')
  @ApiOperation({ summary: 'Get a task by ID' })
  @ApiResponse({ status: 200, description: 'Task retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Task not found' })
  @ApiResponse({ status: 403, description: 'Access denied to this task' })
  findOne(@Param('id') id: string, @Request() req) {
    return this.tasksService.findOne(id, req.user._id, req.user.role);
  }

  @Patch('tasks/:id')
  @ApiOperation({ summary: 'Update a task (Admin or Assignee only)' })
  @ApiResponse({ status: 200, description: 'Task updated successfully' })
  @ApiResponse({ status: 403, description: 'Access denied - Admin or Assignee only' })
  @ApiResponse({ status: 404, description: 'Task not found' })
  update(@Param('id') id: string, @Body() updateTaskDto: UpdateTaskDto, @Request() req) {
    return this.tasksService.update(id, updateTaskDto, req.user._id, req.user.role);
  }

  @Delete('tasks/:id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Delete a task (Admin only)' })
  @ApiResponse({ status: 200, description: 'Task deleted successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden - Admin access required' })
  @ApiResponse({ status: 404, description: 'Task not found' })
  remove(@Param('id') id: string, @Request() req) {
    return this.tasksService.remove(id, req.user.role);
  }

  @Get('projects/:projectId/summary')
  @ApiOperation({ summary: 'Get project summary with KPIs' })
  @ApiResponse({ status: 200, description: 'Project summary retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Project not found' })
  @ApiResponse({ status: 403, description: 'Access denied to this project' })
  getProjectSummary(@Param('projectId') projectId: string, @Request() req) {
    const userId = req.user._id.toString();
    return this.tasksService.getProjectSummary(projectId, userId, req.user.role);
  }

  @Get('projects/:projectId/tasks/export.csv')
  @ApiOperation({ summary: 'Export project tasks to CSV' })
  @ApiResponse({ status: 200, description: 'CSV file generated successfully' })
  @ApiResponse({ status: 404, description: 'Project not found' })
  @ApiResponse({ status: 403, description: 'Access denied to this project' })
  exportTasks(@Param('projectId') projectId: string, @Res() res: Response, @Request() req) {
    return this.tasksService.exportToCsv(projectId, res, req.user._id, req.user.role);
  }
}

import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Task, TaskDocument } from './schemas/task.schema';
import { Project, ProjectDocument } from '../projects/schemas/project.schema';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { QueryTasksDto } from './dto/query-tasks.dto';
import { UserRole } from '../common/enums';
import * as csvWriter from 'csv-writer';
import { Response } from 'express';

@Injectable()
export class TasksService {
  constructor(
    @InjectModel(Task.name) private taskModel: Model<TaskDocument>,
    @InjectModel(Project.name) private projectModel: Model<ProjectDocument>,
  ) {}

  async create(projectId: string, createTaskDto: CreateTaskDto, userId: string, userRole: UserRole): Promise<TaskDocument> {
    // Check if user has access to the project
    const project = await this.projectModel.findById(projectId);
    if (!project) {
      throw new NotFoundException('Project not found');
    }

    // Admin can create tasks in any project, members only in projects they belong to
    if (userRole !== UserRole.ADMIN) {
      const isMember = project.members.some(member => member.toString() === userId);
      const hasTasksInProject = await this.taskModel.exists({
        projectId: new Types.ObjectId(projectId),
        assignee: new Types.ObjectId(userId)
      });
      
      if (!isMember && !hasTasksInProject) {
        throw new ForbiddenException('Access denied to this project');
      }
    }

    const task = new this.taskModel({
      ...createTaskDto,
      projectId: new Types.ObjectId(projectId),
      assignee: createTaskDto.assignee ? new Types.ObjectId(createTaskDto.assignee) : undefined,
      createdBy: new Types.ObjectId(userId),
      dueDate: createTaskDto.dueDate ? new Date(createTaskDto.dueDate) : undefined,
    });

    const savedTask = await task.save();
    await savedTask.populate('assignee', 'name email');
    await savedTask.populate('createdBy', 'name email');
    return savedTask;
  }

  async findAll(projectId: string, query: QueryTasksDto, userId: string, userRole: UserRole) {
    // Check if user has access to the project
    const project = await this.projectModel.findById(projectId);
    if (!project) {
      throw new NotFoundException('Project not found');
    }

    // Allow access if:
    // 1. User is admin
    // 2. User is a member of the project
    // 3. User has tasks assigned in this project
    if (userRole !== UserRole.ADMIN) {
      const isMember = project.members.some(member => member.toString() === userId);
      const hasTasksInProject = await this.taskModel.exists({
        projectId: new Types.ObjectId(projectId),
        assignee: new Types.ObjectId(userId)
      });
      
      if (!isMember && !hasTasksInProject) {
        throw new ForbiddenException('Access denied to this project');
      }
    }

    const page = parseInt(query.page) || 1;
    const limit = parseInt(query.limit) || 10;
    const skip = (page - 1) * limit;

    // Build filter
    const filter: any = { projectId: new Types.ObjectId(projectId) };

    if (query.status) {
      filter.status = query.status;
    }

    if (query.assignee) {
      filter.assignee = new Types.ObjectId(query.assignee);
    }

    if (query.priority) {
      filter.priority = query.priority;
    }

    if (query.dueFrom || query.dueTo) {
      filter.dueDate = {};
      if (query.dueFrom) {
        filter.dueDate.$gte = new Date(query.dueFrom);
      }
      if (query.dueTo) {
        filter.dueDate.$lte = new Date(query.dueTo);
      }
    }

    if (query.q) {
      filter.$text = { $search: query.q };
    }

    const [tasks, total] = await Promise.all([
      this.taskModel
        .find(filter)
        .populate('assignee', 'name email')
        .populate('createdBy', 'name email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.taskModel.countDocuments(filter),
    ]);

    return {
      tasks,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string, userId: string, userRole: UserRole): Promise<TaskDocument> {
    const task = await this.taskModel
      .findById(id)
      .populate('assignee', 'name email')
      .populate('createdBy', 'name email')
      .populate('projectId', 'name key members')
      .exec();

    if (!task) {
      throw new NotFoundException('Task not found');
    }

    // Check if user has access to this task's project
    const project = task.projectId as any;
    if (userRole !== UserRole.ADMIN && !project.members.some(member => member.toString() === userId)) {
      throw new ForbiddenException('Access denied to this task');
    }

    return task;
  }

  async update(id: string, updateTaskDto: UpdateTaskDto, userId: string, userRole: UserRole): Promise<TaskDocument> {
    const task = await this.taskModel.findById(id).populate('projectId', 'members');
    if (!task) {
      throw new NotFoundException('Task not found');
    }

    const project = task.projectId as any;

    // Check permissions: Admin can update any task, Member can only update their own tasks
    if (userRole !== UserRole.ADMIN) {
      if (!project.members.some(member => member.toString() === userId)) {
        throw new ForbiddenException('Access denied to this project');
      }
      if (task.assignee?.toString() !== userId) {
        throw new ForbiddenException('You can only update tasks assigned to you');
      }
    }

    const updatedTask = await this.taskModel.findByIdAndUpdate(
      id,
      {
        ...updateTaskDto,
        assignee: updateTaskDto.assignee ? new Types.ObjectId(updateTaskDto.assignee) : task.assignee,
        dueDate: updateTaskDto.dueDate ? new Date(updateTaskDto.dueDate) : task.dueDate,
        updatedAt: new Date(),
      },
      { new: true }
    ).populate(['assignee', 'createdBy'], 'name email').exec();

    return updatedTask;
  }

  async remove(id: string, userRole: UserRole): Promise<void> {
    if (userRole !== UserRole.ADMIN) {
      throw new ForbiddenException('Only admins can delete tasks');
    }

    const result = await this.taskModel.findByIdAndDelete(id).exec();
    if (!result) {
      throw new NotFoundException('Task not found');
    }
  }

  async getProjectSummary(projectId: string, userId: string, userRole: UserRole) {
    // Check if user has access to the project
    const project = await this.projectModel.findById(projectId);
    if (!project) {
      throw new NotFoundException('Project not found');
    }

    if (userRole !== UserRole.ADMIN) {
      console.log('TasksService - User is NOT admin, checking access. userRole:', userRole);
      const isMember = project.members.some(member => {
        const memberId = member.toString();
        console.log('Comparing memberId:', memberId, 'with userId:', userId, 'equal:', memberId === userId);
        return memberId === userId;
      });

      // Only members can access dashboard, not just task assignees
      if (!isMember) {
        console.log('User is not a member of project:', projectId, 'userId:', userId, 'members:', project.members);
        throw new ForbiddenException('Access denied to this project dashboard');
      }
    } else {
      console.log('TasksService - User is admin, granting access. userRole:', userRole);
    }

    const now = new Date();
    const [totalTasks, todoTasks, inProgressTasks, doneTasks, overdueTasks] = await Promise.all([
      this.taskModel.countDocuments({ projectId: new Types.ObjectId(projectId) }),
      this.taskModel.countDocuments({ projectId: new Types.ObjectId(projectId), status: 'todo' }),
      this.taskModel.countDocuments({ projectId: new Types.ObjectId(projectId), status: 'in_progress' }),
      this.taskModel.countDocuments({ projectId: new Types.ObjectId(projectId), status: 'done' }),
      this.taskModel.countDocuments({ 
        projectId: new Types.ObjectId(projectId), 
        dueDate: { $lt: now },
        status: { $ne: 'done' }
      }),
    ]);

    return {
      total: totalTasks,
      todo: todoTasks,
      inProgress: inProgressTasks,
      done: doneTasks,
      overdue: overdueTasks,
      completionRate: totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0,
    };
  }

  async exportToCsv(projectId: string, res: Response, userId: string, userRole: UserRole) {
    // Check if user has access to the project
    const project = await this.projectModel.findById(projectId);
    if (!project) {
      throw new NotFoundException('Project not found');
    }

    if (userRole !== UserRole.ADMIN) {
      const isMember = project.members.some(member => member.toString() === userId);
      const hasTasksInProject = await this.taskModel.exists({
        projectId: new Types.ObjectId(projectId),
        assignee: new Types.ObjectId(userId)
      });
      
      if (!isMember && !hasTasksInProject) {
        throw new ForbiddenException('Access denied to this project');
      }
    }

    const tasks = await this.taskModel
      .find({ projectId: new Types.ObjectId(projectId) })
      .populate('assignee', 'name email')
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 })
      .exec();

    const csvData = tasks.map(task => ({
      id: task._id.toString(),
      title: task.title,
      description: task.description || '',
      status: task.status,
      priority: task.priority,
      assignee: task.assignee ? (task.assignee as any).name : '',
      assigneeEmail: task.assignee ? (task.assignee as any).email : '',
      dueDate: task.dueDate ? task.dueDate.toISOString() : '',
      createdBy: (task.createdBy as any).name,
      createdAt: task.createdAt.toISOString(),
      updatedAt: task.updatedAt.toISOString(),
    }));

    const filename = `${project.name.replace(/\s+/g, '_')}_tasks_${new Date().toISOString().split('T')[0]}.csv`;
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    const csvString = [
      'ID,Title,Description,Status,Priority,Assignee,Assignee Email,Due Date,Created By,Created At,Updated At',
      ...csvData.map(row => 
        `"${row.id}","${row.title}","${row.description}","${row.status}","${row.priority}","${row.assignee}","${row.assigneeEmail}","${row.dueDate}","${row.createdBy}","${row.createdAt}","${row.updatedAt}"`
      )
    ].join('\n');

    res.send(csvString);
  }
}

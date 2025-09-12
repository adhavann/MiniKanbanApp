import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Project, ProjectDocument } from './schemas/project.schema';
import { Task, TaskDocument } from '../tasks/schemas/task.schema';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { UserRole } from '../common/enums';

@Injectable()
export class ProjectsService {
  constructor(
    @InjectModel(Project.name) private projectModel: Model<ProjectDocument>,
    @InjectModel(Task.name) private taskModel: Model<TaskDocument>,
  ) {}

  async create(createProjectDto: CreateProjectDto, userId: string): Promise<ProjectDocument> {
    console.log('ProjectsService.create - Starting project creation');
    console.log('ProjectsService.create - createProjectDto:', createProjectDto);
    console.log('ProjectsService.create - userId:', userId);

    try {
      const memberIds = createProjectDto.members?.map(id => new Types.ObjectId(id)) || [];
      console.log('ProjectsService.create - memberIds:', memberIds);

      const project = new this.projectModel({
        ...createProjectDto,
        members: memberIds,
        createdBy: new Types.ObjectId(userId),
      });

      console.log('ProjectsService.create - project object created:', project);
      const savedProject = await project.save();
      console.log('ProjectsService.create - project saved successfully:', savedProject._id);

      return savedProject;
    } catch (error) {
      console.error('ProjectsService.create - Error creating project:', error);
      throw error;
    }
  }

  async findAll(userId: string, userRole: UserRole): Promise<ProjectDocument[]> {
    if (userRole === UserRole.ADMIN) {
      return this.projectModel.find().populate('members', 'name email').populate('createdBy', 'name email').exec();
    }
    
    // Members can see projects they belong to OR projects where they have tasks assigned
    const userObjectId = new Types.ObjectId(userId);
    
    // First, find all project IDs where user has tasks
    const tasksWithUser = await this.taskModel.find({ 
      assignee: userObjectId 
    }).distinct('projectId');
    
    // Find projects where user is a member OR has tasks assigned
    return this.projectModel
      .find({
        $or: [
          { members: userObjectId },
          { _id: { $in: tasksWithUser } }
        ]
      })
      .populate('members', 'name email')
      .populate('createdBy', 'name email')
      .exec();
  }

  async findOne(id: string, userId: string, userRole: UserRole): Promise<ProjectDocument> {
    const project = await this.projectModel
      .findById(id)
      .populate('members', 'name email')
      .populate('createdBy', 'name email')
      .exec();

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    // Check if user has access to this project
    if (userRole !== UserRole.ADMIN) {
      console.log('ProjectsService - User is NOT admin, checking access. userRole:', userRole);
      const isMember = project.members.some(member => {
        const memberId = member._id.toString();
        console.log('ProjectsService - Comparing memberId:', memberId, 'with userId:', userId, 'equal:', memberId === userId);
        return memberId === userId;
      });

      // Also check if user has tasks assigned in this project
      const hasTasksInProject = await this.taskModel.exists({
        projectId: project._id,
        assignee: new Types.ObjectId(userId)
      });

      if (!isMember && !hasTasksInProject) {
        console.log('ProjectsService - User is not a member and has no tasks in project:', id, 'userId:', userId, 'userRole:', userRole);
        console.log('ProjectsService - Project members:', project.members.map((m: any) => ({ id: m._id.toString(), name: m.name })));
        throw new ForbiddenException('Access denied to this project');
      }
    } else {
      console.log('ProjectsService - User is admin, granting access. userRole:', userRole);
    }

    return project;
  }

  async update(id: string, updateProjectDto: UpdateProjectDto, userRole: UserRole): Promise<ProjectDocument> {
    if (userRole !== UserRole.ADMIN) {
      throw new ForbiddenException('Only admins can update projects');
    }

    // Handle members update separately if provided
    const updateData: any = { 
      ...updateProjectDto, 
      updatedAt: new Date() 
    };
    
    // Convert member IDs to ObjectIds if members are provided
    if (updateProjectDto.members) {
      updateData.members = updateProjectDto.members.map(memberId => new Types.ObjectId(memberId));
    }

    const project = await this.projectModel.findByIdAndUpdate(
      id,
      updateData,
      { new: true }
    ).populate('members', 'name email').populate('createdBy', 'name email').exec();

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    return project;
  }

  async remove(id: string, userRole: UserRole): Promise<void> {
    if (userRole !== UserRole.ADMIN) {
      throw new ForbiddenException('Only admins can delete projects');
    }

    const result = await this.projectModel.findByIdAndDelete(id).exec();
    if (!result) {
      throw new NotFoundException('Project not found');
    }
  }

  async addMembers(id: string, userIds: string[], userRole: UserRole): Promise<ProjectDocument> {
    if (userRole !== UserRole.ADMIN) {
      throw new ForbiddenException('Only admins can add project members');
    }

    const memberIds = userIds.map(userId => new Types.ObjectId(userId));
    
    const project = await this.projectModel.findByIdAndUpdate(
      id,
      { 
        $addToSet: { members: { $each: memberIds } },
        updatedAt: new Date()
      },
      { new: true }
    ).populate('members', 'name email').populate('createdBy', 'name email').exec();

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    return project;
  }

  async removeMembers(id: string, userIds: string[], userRole: UserRole): Promise<ProjectDocument> {
    if (userRole !== UserRole.ADMIN) {
      throw new ForbiddenException('Only admins can remove project members');
    }

    const memberIds = userIds.map(userId => new Types.ObjectId(userId));
    
    const project = await this.projectModel.findByIdAndUpdate(
      id,
      { 
        $pull: { members: { $in: memberIds } },
        updatedAt: new Date()
      },
      { new: true }
    ).populate('members', 'name email').populate('createdBy', 'name email').exec();

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    return project;
  }
}

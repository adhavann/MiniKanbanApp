import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { TasksService } from './tasks.service';
import { Task } from './schemas/task.schema';
import { Project } from '../projects/schemas/project.schema';
import { UserRole, TaskStatus, TaskPriority } from '../common/enums';

describe('TasksService', () => {
  let service: TasksService;
  let mockTaskModel: any;
  let mockProjectModel: any;

  const mockTask = {
    _id: 'task123',
    projectId: 'project123',
    title: 'Test Task',
    description: 'Test Description',
    status: TaskStatus.TODO,
    priority: TaskPriority.MEDIUM,
    assignee: 'user123',
    createdBy: 'admin123',
    save: jest.fn(),
    populate: jest.fn(),
  };

  const mockProject = {
    _id: 'project123',
    name: 'Test Project',
    members: ['user123', 'admin123'],
  };

  beforeEach(async () => {
    mockTaskModel = {
      find: jest.fn(),
      findById: jest.fn(),
      findByIdAndUpdate: jest.fn(),
      findByIdAndDelete: jest.fn(),
      countDocuments: jest.fn(),
      constructor: jest.fn().mockImplementation(() => mockTask),
    };

    mockProjectModel = {
      findById: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TasksService,
        {
          provide: getModelToken(Task.name),
          useValue: mockTaskModel,
        },
        {
          provide: getModelToken(Project.name),
          useValue: mockProjectModel,
        },
      ],
    }).compile();

    service = module.get<TasksService>(TasksService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a new task', async () => {
      const createTaskDto = {
        title: 'Test Task',
        description: 'Test Description',
        status: TaskStatus.TODO,
        priority: TaskPriority.MEDIUM,
      };

      mockProjectModel.findById.mockResolvedValue(mockProject);
      mockTask.save.mockResolvedValue(mockTask);
      mockTask.populate.mockResolvedValue(mockTask);

      const result = await service.create('project123', createTaskDto, 'admin123', UserRole.ADMIN);

      expect(mockProjectModel.findById).toHaveBeenCalledWith('project123');
      expect(mockTask.save).toHaveBeenCalled();
    });

    it('should throw NotFoundException if project not found', async () => {
      const createTaskDto = {
        title: 'Test Task',
      };

      mockProjectModel.findById.mockResolvedValue(null);

      await expect(
        service.create('project123', createTaskDto, 'admin123', UserRole.ADMIN)
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('findAll', () => {
    it('should return tasks with pagination for admin', async () => {
      const query = { page: '1', limit: '10' };
      const mockFind = {
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([mockTask]),
      };

      mockProjectModel.findById.mockResolvedValue(mockProject);
      mockTaskModel.find.mockReturnValue(mockFind);
      mockTaskModel.countDocuments.mockResolvedValue(1);

      const result = await service.findAll('project123', query, 'admin123', UserRole.ADMIN);

      expect(result.tasks).toEqual([mockTask]);
      expect(result.pagination.total).toBe(1);
    });

    it('should throw ForbiddenException if user not project member', async () => {
      const query = { page: '1', limit: '10' };
      const projectWithoutUser = {
        ...mockProject,
        members: ['other123'],
      };

      mockProjectModel.findById.mockResolvedValue(projectWithoutUser);

      await expect(
        service.findAll('project123', query, 'user123', UserRole.MEMBER)
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('update', () => {
    it('should update task for admin', async () => {
      const updateDto = { title: 'Updated Task' };
      const mockPopulatedTask = {
        ...mockTask,
        projectId: mockProject,
      };

      mockTaskModel.findById.mockResolvedValue(mockPopulatedTask);
      mockTaskModel.findByIdAndUpdate.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue({ ...mockTask, ...updateDto }),
        }),
      });

      const result = await service.update('task123', updateDto, 'admin123', UserRole.ADMIN);

      expect(mockTaskModel.findByIdAndUpdate).toHaveBeenCalled();
      expect(result.title).toBe('Updated Task');
    });

    it('should allow member to update their own task', async () => {
      const updateDto = { title: 'Updated Task' };
      const mockPopulatedTask = {
        ...mockTask,
        assignee: { toString: () => 'user123' },
        projectId: mockProject,
      };

      mockTaskModel.findById.mockResolvedValue(mockPopulatedTask);
      mockTaskModel.findByIdAndUpdate.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue({ ...mockTask, ...updateDto }),
        }),
      });

      const result = await service.update('task123', updateDto, 'user123', UserRole.MEMBER);

      expect(result.title).toBe('Updated Task');
    });

    it('should throw ForbiddenException if member tries to update others task', async () => {
      const updateDto = { title: 'Updated Task' };
      const mockPopulatedTask = {
        ...mockTask,
        assignee: { toString: () => 'other123' },
        projectId: mockProject,
      };

      mockTaskModel.findById.mockResolvedValue(mockPopulatedTask);

      await expect(
        service.update('task123', updateDto, 'user123', UserRole.MEMBER)
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('remove', () => {
    it('should delete task for admin', async () => {
      mockTaskModel.findByIdAndDelete.mockResolvedValue(mockTask);

      await service.remove('task123', UserRole.ADMIN);

      expect(mockTaskModel.findByIdAndDelete).toHaveBeenCalledWith('task123');
    });

    it('should throw ForbiddenException for non-admin', async () => {
      await expect(
        service.remove('task123', UserRole.MEMBER)
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('getProjectSummary', () => {
    it('should return project summary', async () => {
      mockProjectModel.findById.mockResolvedValue(mockProject);
      mockTaskModel.countDocuments
        .mockResolvedValueOnce(10) // total
        .mockResolvedValueOnce(3)  // todo
        .mockResolvedValueOnce(4)  // in_progress
        .mockResolvedValueOnce(3)  // done
        .mockResolvedValueOnce(1); // overdue

      const result = await service.getProjectSummary('project123', 'admin123', UserRole.ADMIN);

      expect(result).toEqual({
        total: 10,
        todo: 3,
        inProgress: 4,
        done: 3,
        overdue: 1,
        completionRate: 30,
      });
    });
  });
});

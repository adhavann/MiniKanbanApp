import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ProjectsService } from '../projects/projects.service';
import { TasksService } from '../tasks/tasks.service';
import { UserRole, TaskStatus, TaskPriority } from '../common/enums';

describe('Role-Based Access Control Tests', () => {
  let projectsService: ProjectsService;
  let tasksService: TasksService;
  let projectModel: Model<any>;
  let taskModel: Model<any>;

  const adminUser = {
    id: new Types.ObjectId().toString(),
    role: UserRole.ADMIN,
    name: 'Admin User',
    email: 'admin@test.com'
  };

  const memberUser = {
    id: new Types.ObjectId().toString(),
    role: UserRole.MEMBER,
    name: 'Member User',
    email: 'member@test.com'
  };

  const nonMemberUser = {
    id: new Types.ObjectId().toString(),
    role: UserRole.MEMBER,
    name: 'Non-Member User',
    email: 'nonmember@test.com'
  };

  const mockProject = {
    _id: new Types.ObjectId(),
    name: 'Test Project',
    key: 'TEST',
    members: [new Types.ObjectId(adminUser.id), new Types.ObjectId(memberUser.id)],
    createdBy: new Types.ObjectId(adminUser.id),
    save: jest.fn(),
    populate: jest.fn().mockReturnThis(),
  };

  const mockTask = {
    _id: new Types.ObjectId(),
    title: 'Test Task',
    projectId: mockProject._id,
    assignee: new Types.ObjectId(memberUser.id),
    createdBy: new Types.ObjectId(memberUser.id),
    status: 'todo',
    priority: 'medium',
    save: jest.fn(),
    populate: jest.fn().mockReturnThis(),
  };

  const mockProjectModel = {
    findById: jest.fn(),
    find: jest.fn(),
    create: jest.fn(),
    findByIdAndUpdate: jest.fn(),
    findByIdAndDelete: jest.fn(),
    countDocuments: jest.fn(),
  };

  const mockTaskModel = {
    findById: jest.fn(),
    find: jest.fn(),
    create: jest.fn(),
    findByIdAndUpdate: jest.fn(),
    findByIdAndDelete: jest.fn(),
    countDocuments: jest.fn(),
    aggregate: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProjectsService,
        TasksService,
        {
          provide: getModelToken('Project'),
          useValue: mockProjectModel,
        },
        {
          provide: getModelToken('Task'),
          useValue: mockTaskModel,
        },
      ],
    }).compile();

    projectsService = module.get<ProjectsService>(ProjectsService);
    tasksService = module.get<TasksService>(TasksService);
    projectModel = module.get<Model<any>>(getModelToken('Project'));
    taskModel = module.get<Model<any>>(getModelToken('Task'));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Member Role Capabilities', () => {
    describe('View projects they belong to', () => {
      it('should allow member to view projects they belong to', async () => {
        mockProjectModel.find.mockReturnValue({
          populate: jest.fn().mockResolvedValue([mockProject]),
        });

        const result = await projectsService.findAll(memberUser.id, memberUser.role);
        
        expect(mockProjectModel.find).toHaveBeenCalledWith({
          members: { $in: [memberUser.id] }
        });
        expect(result).toEqual([mockProject]);
      });

      it('should allow member to create tasks in projects they belong to', async () => {
        mockProjectModel.findById.mockResolvedValue(mockProject);
        mockTaskModel.create = jest.fn().mockReturnValue({ save: jest.fn().mockResolvedValue(mockTask) });
        
        const createTaskDto = {
          title: 'New Task',
          description: 'Task description',
          status: TaskStatus.TODO,
          priority: TaskPriority.MEDIUM
        };

        const result = await tasksService.create(
          mockProject._id.toString(),
          createTaskDto,
          memberUser.id,
          UserRole.MEMBER
        );

        expect(mockProjectModel.findById).toHaveBeenCalledWith(mockProject._id.toString());
        expect(result).toBeDefined();
      });

      it('should deny member from creating tasks in projects they do not belong to', async () => {
        const nonMemberProject = {
          ...mockProject,
          members: [new Types.ObjectId(adminUser.id)], // Only admin is member
        };
        
        mockProjectModel.findById.mockResolvedValue(nonMemberProject);

        const createTaskDto = {
          title: 'New Task',
          description: 'Task description',
          status: TaskStatus.TODO,
          priority: TaskPriority.MEDIUM
        };

        await expect(
          tasksService.create(
            mockProject._id.toString(),
            createTaskDto,
            memberUser.id,
            UserRole.MEMBER
          )
        ).rejects.toThrow(ForbiddenException);
      });
    });

    describe('Update their own tasks', () => {
      it('should allow member to update tasks assigned to them', async () => {
        const taskWithProject = {
          ...mockTask,
          projectId: { members: [new Types.ObjectId(memberUser.id)] }
        };
        
        mockTaskModel.findById.mockReturnValue({
          populate: jest.fn().mockResolvedValue(taskWithProject)
        });
        
        mockTaskModel.findByIdAndUpdate.mockReturnValue({
          populate: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue(mockTask)
          })
        });

        const updateDto = { title: 'Updated Task' };
        
        const result = await tasksService.update(
          mockTask._id.toString(),
          updateDto,
          memberUser.id,
          memberUser.role
        );

        expect(result).toBeDefined();
      });

      it('should deny member from updating tasks not assigned to them', async () => {
        const otherUserTask = {
          ...mockTask,
          assignee: new Types.ObjectId(adminUser.id), // Assigned to admin
          projectId: { members: [new Types.ObjectId(memberUser.id)] }
        };
        
        mockTaskModel.findById.mockReturnValue({
          populate: jest.fn().mockResolvedValue(otherUserTask)
        });

        const updateDto = { title: 'Updated Task' };
        
        await expect(
          tasksService.update(
            mockTask._id.toString(),
            updateDto,
            memberUser.id,
            memberUser.role
          )
        ).rejects.toThrow(ForbiddenException);
      });
    });

    describe('List tasks with pagination and filters', () => {
      it('should allow member to list tasks in projects they belong to', async () => {
        mockProjectModel.findById.mockResolvedValue(mockProject);
        mockTaskModel.find.mockReturnValue({
          populate: jest.fn().mockReturnValue({
            sort: jest.fn().mockReturnValue({
              skip: jest.fn().mockReturnValue({
                limit: jest.fn().mockReturnValue({
                  exec: jest.fn().mockResolvedValue([mockTask])
                })
              })
            })
          })
        });
        mockTaskModel.countDocuments.mockResolvedValue(1);

        const query = { page: '1', limit: '10' };
        
        const result = await tasksService.findAll(
          mockProject._id.toString(),
          query,
          memberUser.id,
          memberUser.role
        );

        expect(result.tasks).toEqual([mockTask]);
        expect(result.pagination.total).toBe(1);
      });
    });

    describe('Export project tasks to CSV', () => {
      it('should allow member to export CSV for projects they belong to', async () => {
        mockProjectModel.findById.mockResolvedValue(mockProject);
        mockTaskModel.find.mockReturnValue({
          populate: jest.fn().mockReturnValue({
            sort: jest.fn().mockReturnValue({
              exec: jest.fn().mockResolvedValue([mockTask])
            })
          })
        });

        const mockRes = {
          setHeader: jest.fn(),
          send: jest.fn(),
        };

        await tasksService.exportToCsv(
          mockProject._id.toString(),
          mockRes as any,
          memberUser.id,
          memberUser.role
        );

        expect(mockRes.setHeader).toHaveBeenCalledWith('Content-Type', 'text/csv');
        expect(mockRes.send).toHaveBeenCalled();
      });
    });

    describe('View dashboard', () => {
      it('should allow member to view dashboard for projects they belong to', async () => {
        mockProjectModel.findById.mockResolvedValue(mockProject);
        mockTaskModel.countDocuments.mockResolvedValue(5);

        const result = await tasksService.getProjectSummary(
          mockProject._id.toString(),
          memberUser.id,
          memberUser.role
        );

        expect(result).toHaveProperty('total');
        expect(result).toHaveProperty('todo');
        expect(result).toHaveProperty('inProgress');
        expect(result).toHaveProperty('done');
      });
    });
  });

  describe('Admin Role Capabilities', () => {
    describe('Create/Edit/Delete projects', () => {
      it('should allow admin to create projects', async () => {
        const newProject = { ...mockProject, save: jest.fn().mockResolvedValue(mockProject) };
        mockProjectModel.create = jest.fn().mockReturnValue(newProject);

        const createDto = {
          name: 'New Project',
          key: 'NEW',
          description: 'Project description'
        };

        const result = await projectsService.create(createDto, adminUser.id);
        
        expect(result).toBeDefined();
      });

      it('should allow admin to update any project', async () => {
        mockProjectModel.findByIdAndUpdate.mockReturnValue({
          populate: jest.fn().mockResolvedValue(mockProject)
        });

        const updateDto = { name: 'Updated Project' };
        
        const result = await projectsService.update(
          mockProject._id.toString(),
          updateDto,
          adminUser.role
        );

        expect(result).toBeDefined();
      });

      it('should allow admin to delete projects', async () => {
        mockProjectModel.findByIdAndDelete.mockResolvedValue(mockProject);

        await projectsService.remove(mockProject._id.toString(), adminUser.role);
        
        expect(mockProjectModel.findByIdAndDelete).toHaveBeenCalledWith(mockProject._id.toString());
      });

      it('should deny member from deleting projects', async () => {
        await expect(
          projectsService.remove(mockProject._id.toString(), memberUser.role)
        ).rejects.toThrow(ForbiddenException);
      });
    });

    describe('Add/Remove project members', () => {
      it('should allow admin to add members to projects', async () => {
        mockProjectModel.findById.mockResolvedValue(mockProject);
        mockProject.save.mockResolvedValue(mockProject);

        await projectsService.addMembers(
          mockProject._id.toString(),
          [nonMemberUser.id],
          adminUser.role
        );

        expect(mockProject.save).toHaveBeenCalled();
      });
    });

    describe('Update/Delete any task', () => {
      it('should allow admin to update any task', async () => {
        const taskWithProject = {
          ...mockTask,
          projectId: { members: [new Types.ObjectId(adminUser.id)] }
        };
        
        mockTaskModel.findById.mockReturnValue({
          populate: jest.fn().mockResolvedValue(taskWithProject)
        });
        
        mockTaskModel.findByIdAndUpdate.mockReturnValue({
          populate: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue(mockTask)
          })
        });

        const updateDto = { title: 'Admin Updated Task' };
        
        const result = await tasksService.update(
          mockTask._id.toString(),
          updateDto,
          adminUser.id,
          adminUser.role
        );

        expect(result).toBeDefined();
      });

      it('should allow admin to delete any task', async () => {
        mockTaskModel.findByIdAndDelete.mockResolvedValue(mockTask);

        await tasksService.remove(mockTask._id.toString(), adminUser.role);
        
        expect(mockTaskModel.findByIdAndDelete).toHaveBeenCalledWith(mockTask._id.toString());
      });

      it('should deny member from deleting tasks', async () => {
        await expect(
          tasksService.remove(mockTask._id.toString(), memberUser.role)
        ).rejects.toThrow(ForbiddenException);
      });
    });
  });

  describe('Guardrails', () => {
    it('should prevent member from accessing projects they do not belong to', async () => {
      const restrictedProject = {
        ...mockProject,
        members: [new Types.ObjectId(adminUser.id)] // Only admin
      };
      
      mockProjectModel.findById.mockResolvedValue(restrictedProject);

      await expect(
        tasksService.findAll(
          mockProject._id.toString(),
          { page: '1', limit: '10' },
          memberUser.id,
          memberUser.role
        )
      ).rejects.toThrow(ForbiddenException);
    });

    it('should prevent member from updating tasks not assigned to them', async () => {
      const otherTask = {
        ...mockTask,
        assignee: new Types.ObjectId(adminUser.id),
        projectId: { members: [new Types.ObjectId(memberUser.id)] }
      };
      
      mockTaskModel.findById.mockReturnValue({
        populate: jest.fn().mockResolvedValue(otherTask)
      });

      await expect(
        tasksService.update(
          mockTask._id.toString(),
          { title: 'Unauthorized Update' },
          memberUser.id,
          memberUser.role
        )
      ).rejects.toThrow(ForbiddenException);
    });

    it('should prevent non-admin from project management operations', async () => {
      await expect(
        projectsService.remove(mockProject._id.toString(), memberUser.role)
      ).rejects.toThrow(ForbiddenException);
    });
  });
});

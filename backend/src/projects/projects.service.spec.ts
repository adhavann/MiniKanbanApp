import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { ProjectsService } from './projects.service';
import { Project } from './schemas/project.schema';
import { UserRole } from '../common/enums';

describe('ProjectsService', () => {
  let service: ProjectsService;
  let mockProjectModel: any;

  const mockProject = {
    _id: 'project123',
    name: 'Test Project',
    key: 'TEST',
    members: ['user123'],
    createdBy: 'admin123',
    save: jest.fn(),
    populate: jest.fn(),
  };

  beforeEach(async () => {
    mockProjectModel = {
      find: jest.fn(),
      findById: jest.fn(),
      findByIdAndUpdate: jest.fn(),
      findByIdAndDelete: jest.fn(),
      constructor: jest.fn().mockImplementation(() => mockProject),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProjectsService,
        {
          provide: getModelToken(Project.name),
          useValue: mockProjectModel,
        },
      ],
    }).compile();

    service = module.get<ProjectsService>(ProjectsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a new project', async () => {
      const createProjectDto = {
        name: 'Test Project',
        key: 'TEST',
        members: ['user123'],
      };

      mockProject.save.mockResolvedValue(mockProject);

      const result = await service.create(createProjectDto, 'admin123');

      expect(mockProject.save).toHaveBeenCalled();
      expect(result).toEqual(mockProject);
    });
  });

  describe('findAll', () => {
    it('should return all projects for admin', async () => {
      const mockPopulate = {
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([mockProject]),
      };
      mockProjectModel.find.mockReturnValue(mockPopulate);

      const result = await service.findAll('admin123', UserRole.ADMIN);

      expect(mockProjectModel.find).toHaveBeenCalledWith();
      expect(result).toEqual([mockProject]);
    });

    it('should return only member projects for member', async () => {
      const mockPopulate = {
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([mockProject]),
      };
      mockProjectModel.find.mockReturnValue(mockPopulate);

      const result = await service.findAll('user123', UserRole.MEMBER);

      expect(mockProjectModel.find).toHaveBeenCalledWith({
        members: expect.any(Object),
      });
      expect(result).toEqual([mockProject]);
    });
  });

  describe('findOne', () => {
    it('should return project for admin', async () => {
      const mockPopulate = {
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(mockProject),
      };
      mockProjectModel.findById.mockReturnValue(mockPopulate);

      const result = await service.findOne('project123', 'admin123', UserRole.ADMIN);

      expect(result).toEqual(mockProject);
    });

    it('should throw NotFoundException if project not found', async () => {
      const mockPopulate = {
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(null),
      };
      mockProjectModel.findById.mockReturnValue(mockPopulate);

      await expect(
        service.findOne('project123', 'user123', UserRole.MEMBER)
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should update project for admin', async () => {
      const updateDto = { name: 'Updated Project' };
      const mockPopulate = {
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue({ ...mockProject, ...updateDto }),
      };
      mockProjectModel.findByIdAndUpdate.mockReturnValue(mockPopulate);

      const result = await service.update('project123', updateDto, UserRole.ADMIN);

      expect(mockProjectModel.findByIdAndUpdate).toHaveBeenCalledWith(
        'project123',
        expect.objectContaining(updateDto),
        { new: true }
      );
      expect(result.name).toBe('Updated Project');
    });

    it('should throw ForbiddenException for non-admin', async () => {
      const updateDto = { name: 'Updated Project' };

      await expect(
        service.update('project123', updateDto, UserRole.MEMBER)
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('remove', () => {
    it('should delete project for admin', async () => {
      mockProjectModel.findByIdAndDelete.mockResolvedValue(mockProject);

      await service.remove('project123', UserRole.ADMIN);

      expect(mockProjectModel.findByIdAndDelete).toHaveBeenCalledWith('project123');
    });

    it('should throw ForbiddenException for non-admin', async () => {
      await expect(
        service.remove('project123', UserRole.MEMBER)
      ).rejects.toThrow(ForbiddenException);
    });
  });
});

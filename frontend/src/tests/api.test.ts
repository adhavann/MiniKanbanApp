import axios from 'axios';
import { authAPI, projectsAPI, tasksAPI } from './api';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('API Services', () => {
  beforeEach(() => {
    mockedAxios.create.mockReturnValue(mockedAxios);
    mockedAxios.interceptors = {
      request: { use: jest.fn() },
      response: { use: jest.fn() },
    } as any;
  });

  describe('authAPI', () => {
    it('should call register endpoint', async () => {
      const registerData = { name: 'Test', email: 'test@example.com', password: 'password' };
      const mockResponse = { data: { access_token: 'token', user: {} } };
      
      mockedAxios.post.mockResolvedValue(mockResponse);
      
      const result = await authAPI.register(registerData);
      
      expect(mockedAxios.post).toHaveBeenCalledWith('/auth/register', registerData);
      expect(result).toEqual(mockResponse);
    });

    it('should call login endpoint', async () => {
      const loginData = { email: 'test@example.com', password: 'password' };
      const mockResponse = { data: { access_token: 'token', user: {} } };
      
      mockedAxios.post.mockResolvedValue(mockResponse);
      
      const result = await authAPI.login(loginData);
      
      expect(mockedAxios.post).toHaveBeenCalledWith('/auth/login', loginData);
      expect(result).toEqual(mockResponse);
    });
  });

  describe('projectsAPI', () => {
    it('should get all projects', async () => {
      const mockResponse = { data: [] };
      
      mockedAxios.get.mockResolvedValue(mockResponse);
      
      const result = await projectsAPI.getAll();
      
      expect(mockedAxios.get).toHaveBeenCalledWith('/projects');
      expect(result).toEqual(mockResponse);
    });

    it('should create project', async () => {
      const projectData = { name: 'Test Project', key: 'TEST' };
      const mockResponse = { data: { _id: '123', ...projectData } };
      
      mockedAxios.post.mockResolvedValue(mockResponse);
      
      const result = await projectsAPI.create(projectData);
      
      expect(mockedAxios.post).toHaveBeenCalledWith('/projects', projectData);
      expect(result).toEqual(mockResponse);
    });
  });

  describe('tasksAPI', () => {
    it('should get tasks with filters', async () => {
      const projectId = 'project123';
      const filters = { status: 'todo', page: 1 };
      const mockResponse = { data: { tasks: [], pagination: {} } };
      
      mockedAxios.get.mockResolvedValue(mockResponse);
      
      const result = await tasksAPI.getAll(projectId, filters);
      
      expect(mockedAxios.get).toHaveBeenCalledWith(`/projects/${projectId}/tasks?status=todo&page=1`);
      expect(result).toEqual(mockResponse);
    });
  });
});

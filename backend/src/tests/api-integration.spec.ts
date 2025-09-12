import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../app.module';
import { UserRole } from '../common/enums';

describe('API Integration Tests - Role-Based Access Control', () => {
  let app: INestApplication;
  let adminToken: string;
  let memberToken: string;
  let projectId: string;
  let taskId: string;
  let memberResponse: any;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    // Setup test users and get tokens
    await setupTestData();
  });

  afterAll(async () => {
    await app.close();
  });

  async function setupTestData() {
    // Register admin user
    const adminResponse = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        name: 'Test Admin',
        email: 'admin@test.com',
        password: 'Admin@123',
      });
    
    adminToken = adminResponse.body.access_token;

    // Register member user
    const memberResponse = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        name: 'Test Member',
        email: 'member@test.com',
        password: 'Member@123',
      });
    
    memberToken = memberResponse.body.access_token;

    // Create a project as admin
    const projectResponse = await request(app.getHttpServer())
      .post('/projects')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Test Project',
        key: 'TEST',
        description: 'Test project for role-based access',
      });
    
    projectId = projectResponse.body._id;

    // Add member to project
    await request(app.getHttpServer())
      .post(`/projects/${projectId}/members`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        userId: memberResponse.body.user.id,
      });
  }

  describe('Member Role - Project Access', () => {
    it('should allow member to view projects they belong to', async () => {
      const response = await request(app.getHttpServer())
        .get('/projects')
        .set('Authorization', `Bearer ${memberToken}`)
        .expect(200);

      expect(response.body).toHaveLength(1);
      expect(response.body[0]._id).toBe(projectId);
    });

    it('should deny member from creating projects', async () => {
      await request(app.getHttpServer())
        .post('/projects')
        .set('Authorization', `Bearer ${memberToken}`)
        .send({
          name: 'Unauthorized Project',
          key: 'UNAUTH',
        })
        .expect(403);
    });

    it('should deny member from deleting projects', async () => {
      await request(app.getHttpServer())
        .delete(`/projects/${projectId}`)
        .set('Authorization', `Bearer ${memberToken}`)
        .expect(403);
    });
  });

  describe('Member Role - Task Management', () => {
    it('should allow member to create tasks in assigned projects', async () => {
      const response = await request(app.getHttpServer())
        .post(`/projects/${projectId}/tasks`)
        .set('Authorization', `Bearer ${memberToken}`)
        .send({
          title: 'Member Created Task',
          description: 'Task created by member',
          status: 'todo',
          priority: 'medium',
        })
        .expect(201);

      taskId = response.body._id;
      expect(response.body.title).toBe('Member Created Task');
    });

    it('should allow member to view tasks in assigned projects', async () => {
      const response = await request(app.getHttpServer())
        .get(`/projects/${projectId}/tasks`)
        .set('Authorization', `Bearer ${memberToken}`)
        .expect(200);

      expect(response.body.tasks).toBeDefined();
      expect(response.body.pagination).toBeDefined();
    });

    it('should allow member to update their own tasks', async () => {
      // First assign the task to the member
      await request(app.getHttpServer())
        .patch(`/tasks/${taskId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          assignee: memberResponse.body.user.id,
        });

      // Now member should be able to update it
      const response = await request(app.getHttpServer())
        .patch(`/tasks/${taskId}`)
        .set('Authorization', `Bearer ${memberToken}`)
        .send({
          title: 'Updated by Member',
          status: 'in_progress',
        })
        .expect(200);

      expect(response.body.title).toBe('Updated by Member');
      expect(response.body.status).toBe('in_progress');
    });

    it('should deny member from deleting tasks', async () => {
      await request(app.getHttpServer())
        .delete(`/tasks/${taskId}`)
        .set('Authorization', `Bearer ${memberToken}`)
        .expect(403);
    });
  });

  describe('Member Role - Dashboard and Export', () => {
    it('should allow member to view project dashboard', async () => {
      const response = await request(app.getHttpServer())
        .get(`/projects/${projectId}/summary`)
        .set('Authorization', `Bearer ${memberToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('total');
      expect(response.body).toHaveProperty('todo');
      expect(response.body).toHaveProperty('inProgress');
      expect(response.body).toHaveProperty('done');
      expect(response.body).toHaveProperty('completionRate');
    });

    it('should allow member to export project tasks to CSV', async () => {
      const response = await request(app.getHttpServer())
        .get(`/projects/${projectId}/tasks/export.csv`)
        .set('Authorization', `Bearer ${memberToken}`)
        .expect(200);

      expect(response.headers['content-type']).toContain('text/csv');
      expect(response.headers['content-disposition']).toContain('attachment');
    });
  });

  describe('Admin Role - Full Access', () => {
    it('should allow admin to create projects', async () => {
      const response = await request(app.getHttpServer())
        .post('/projects')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Admin Project',
          key: 'ADMIN',
          description: 'Project created by admin',
        })
        .expect(201);

      expect(response.body.name).toBe('Admin Project');
    });

    it('should allow admin to update any project', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/projects/${projectId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Updated Project Name',
        })
        .expect(200);

      expect(response.body.name).toBe('Updated Project Name');
    });

    it('should allow admin to add/remove project members', async () => {
      // Test adding member (already done in setup, but verify endpoint works)
      await request(app.getHttpServer())
        .post(`/projects/${projectId}/members`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          userId: 'someUserId',
        })
        .expect(200);
    });

    it('should allow admin to update any task', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/tasks/${taskId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          title: 'Admin Updated Task',
          priority: 'high',
        })
        .expect(200);

      expect(response.body.title).toBe('Admin Updated Task');
      expect(response.body.priority).toBe('high');
    });

    it('should allow admin to delete tasks', async () => {
      await request(app.getHttpServer())
        .delete(`/tasks/${taskId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
    });

    it('should allow admin to delete projects', async () => {
      await request(app.getHttpServer())
        .delete(`/projects/${projectId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
    });
  });

  describe('Task Filtering and Pagination', () => {
    beforeEach(async () => {
      // Create a new project for filtering tests
      const projectResponse = await request(app.getHttpServer())
        .post('/projects')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Filter Test Project',
          key: 'FILTER',
        });
      
      projectId = projectResponse.body._id;

      // Add member to project
      await request(app.getHttpServer())
        .post(`/projects/${projectId}/members`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          userId: memberResponse.body.user.id,
        });

      // Create multiple tasks for filtering
      await Promise.all([
        request(app.getHttpServer())
          .post(`/projects/${projectId}/tasks`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            title: 'High Priority Task',
            status: 'todo',
            priority: 'high',
          }),
        request(app.getHttpServer())
          .post(`/projects/${projectId}/tasks`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            title: 'In Progress Task',
            status: 'in_progress',
            priority: 'medium',
          }),
        request(app.getHttpServer())
          .post(`/projects/${projectId}/tasks`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            title: 'Done Task',
            status: 'done',
            priority: 'low',
          }),
      ]);
    });

    it('should allow member to filter tasks by status', async () => {
      const response = await request(app.getHttpServer())
        .get(`/projects/${projectId}/tasks?status=todo`)
        .set('Authorization', `Bearer ${memberToken}`)
        .expect(200);

      expect(response.body.tasks.every(task => task.status === 'todo')).toBe(true);
    });

    it('should allow member to filter tasks by priority', async () => {
      const response = await request(app.getHttpServer())
        .get(`/projects/${projectId}/tasks?priority=high`)
        .set('Authorization', `Bearer ${memberToken}`)
        .expect(200);

      expect(response.body.tasks.every(task => task.priority === 'high')).toBe(true);
    });

    it('should allow member to search tasks by title', async () => {
      const response = await request(app.getHttpServer())
        .get(`/projects/${projectId}/tasks?q=High Priority`)
        .set('Authorization', `Bearer ${memberToken}`)
        .expect(200);

      expect(response.body.tasks.some(task => task.title.includes('High Priority'))).toBe(true);
    });

    it('should support pagination', async () => {
      const response = await request(app.getHttpServer())
        .get(`/projects/${projectId}/tasks?page=1&limit=2`)
        .set('Authorization', `Bearer ${memberToken}`)
        .expect(200);

      expect(response.body.tasks).toHaveLength(2);
      expect(response.body.pagination.page).toBe(1);
      expect(response.body.pagination.limit).toBe(2);
    });
  });

  describe('Access Control Guardrails', () => {
    let restrictedProjectId: string;
    let restrictedTaskId: string;

    beforeEach(async () => {
      // Create a project that member is NOT part of
      const projectResponse = await request(app.getHttpServer())
        .post('/projects')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Restricted Project',
          key: 'RESTRICTED',
        });
      
      restrictedProjectId = projectResponse.body._id;

      // Create a task in the restricted project
      const taskResponse = await request(app.getHttpServer())
        .post(`/projects/${restrictedProjectId}/tasks`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          title: 'Restricted Task',
          status: 'todo',
          priority: 'medium',
        });
      
      restrictedTaskId = taskResponse.body._id;
    });

    it('should deny member access to projects they are not part of', async () => {
      await request(app.getHttpServer())
        .get(`/projects/${restrictedProjectId}/tasks`)
        .set('Authorization', `Bearer ${memberToken}`)
        .expect(403);
    });

    it('should deny member from creating tasks in projects they are not part of', async () => {
      await request(app.getHttpServer())
        .post(`/projects/${restrictedProjectId}/tasks`)
        .set('Authorization', `Bearer ${memberToken}`)
        .send({
          title: 'Unauthorized Task',
          status: 'todo',
          priority: 'medium',
        })
        .expect(403);
    });

    it('should deny member from accessing dashboard of projects they are not part of', async () => {
      await request(app.getHttpServer())
        .get(`/projects/${restrictedProjectId}/summary`)
        .set('Authorization', `Bearer ${memberToken}`)
        .expect(403);
    });

    it('should deny member from exporting CSV of projects they are not part of', async () => {
      await request(app.getHttpServer())
        .get(`/projects/${restrictedProjectId}/tasks/export.csv`)
        .set('Authorization', `Bearer ${memberToken}`)
        .expect(403);
    });

    it('should deny unauthenticated access to any endpoint', async () => {
      await request(app.getHttpServer())
        .get('/projects')
        .expect(401);

      await request(app.getHttpServer())
        .post('/projects')
        .send({
          name: 'Unauthorized Project',
          key: 'UNAUTH',
        })
        .expect(401);
    });
  });
});

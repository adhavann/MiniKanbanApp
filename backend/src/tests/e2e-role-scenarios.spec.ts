import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../app.module';

describe('End-to-End Role-Based Scenarios', () => {
  let app: INestApplication;
  let adminToken: string;
  let memberToken: string;
  let member2Token: string;
  let adminUserId: string;
  let memberUserId: string;
  let member2UserId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    // Setup test users
    await setupUsers();
  });

  afterAll(async () => {
    await app.close();
  });

  async function setupUsers() {
    // Create admin user
    const adminResponse = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        name: 'E2E Admin',
        email: 'e2e.admin@test.com',
        password: 'Admin@123',
      });
    
    adminToken = adminResponse.body.access_token;
    adminUserId = adminResponse.body.user.id;

    // Create member user 1
    const memberResponse = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        name: 'E2E Member 1',
        email: 'e2e.member1@test.com',
        password: 'Member@123',
      });
    
    memberToken = memberResponse.body.access_token;
    memberUserId = memberResponse.body.user.id;

    // Create member user 2
    const member2Response = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        name: 'E2E Member 2',
        email: 'e2e.member2@test.com',
        password: 'Member@123',
      });
    
    member2Token = member2Response.body.access_token;
    member2UserId = member2Response.body.user.id;
  }

  describe('Complete Project Lifecycle - Admin Perspective', () => {
    let projectId: string;
    let taskId: string;

    it('Admin creates a new project', async () => {
      const response = await request(app.getHttpServer())
        .post('/projects')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'E2E Test Project',
          key: 'E2E',
          description: 'End-to-end testing project',
        })
        .expect(201);

      projectId = response.body._id;
      expect(response.body.name).toBe('E2E Test Project');
      expect(response.body.createdBy._id).toBe(adminUserId);
    });

    it('Admin adds members to the project', async () => {
      // Add member 1
      await request(app.getHttpServer())
        .post(`/projects/${projectId}/members`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ userId: memberUserId })
        .expect(200);

      // Add member 2
      await request(app.getHttpServer())
        .post(`/projects/${projectId}/members`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ userId: member2UserId })
        .expect(200);

      // Verify members were added
      const projectResponse = await request(app.getHttpServer())
        .get(`/projects/${projectId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(projectResponse.body.members).toHaveLength(3); // Admin + 2 members
    });

    it('Admin creates initial tasks', async () => {
      const taskResponse = await request(app.getHttpServer())
        .post(`/projects/${projectId}/tasks`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          title: 'Setup Project Infrastructure',
          description: 'Initial project setup and configuration',
          status: 'todo',
          priority: 'high',
          assignee: memberUserId,
        })
        .expect(201);

      taskId = taskResponse.body._id;
      expect(taskResponse.body.assignee._id).toBe(memberUserId);
    });

    it('Admin can view all project tasks and dashboard', async () => {
      // View tasks
      const tasksResponse = await request(app.getHttpServer())
        .get(`/projects/${projectId}/tasks`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(tasksResponse.body.tasks).toHaveLength(1);

      // View dashboard
      const dashboardResponse = await request(app.getHttpServer())
        .get(`/projects/${projectId}/summary`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(dashboardResponse.body.total).toBe(1);
      expect(dashboardResponse.body.todo).toBe(1);
    });

    it('Admin can update any task', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/tasks/${taskId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          status: 'in_progress',
          priority: 'medium',
        })
        .expect(200);

      expect(response.body.status).toBe('in_progress');
      expect(response.body.priority).toBe('medium');
    });

    it('Admin can export project data', async () => {
      const response = await request(app.getHttpServer())
        .get(`/projects/${projectId}/tasks/export.csv`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.headers['content-type']).toContain('text/csv');
    });

    it('Admin can delete tasks', async () => {
      await request(app.getHttpServer())
        .delete(`/tasks/${taskId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
    });

    it('Admin can delete the project', async () => {
      await request(app.getHttpServer())
        .delete(`/projects/${projectId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
    });
  });

  describe('Member Workflow - Project Collaboration', () => {
    let projectId: string;
    let memberTaskId: string;
    let otherTaskId: string;

    beforeAll(async () => {
      // Admin creates project and adds members
      const projectResponse = await request(app.getHttpServer())
        .post('/projects')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Member Collaboration Project',
          key: 'COLLAB',
          description: 'Testing member collaboration features',
        });
      
      projectId = projectResponse.body._id;

      // Add both members
      await request(app.getHttpServer())
        .post(`/projects/${projectId}/members`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ userId: memberUserId });

      await request(app.getHttpServer())
        .post(`/projects/${projectId}/members`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ userId: member2UserId });
    });

    it('Member can view assigned projects', async () => {
      const response = await request(app.getHttpServer())
        .get('/projects')
        .set('Authorization', `Bearer ${memberToken}`)
        .expect(200);

      expect(response.body).toHaveLength(1);
      expect(response.body[0]._id).toBe(projectId);
    });

    it('Member can create tasks in assigned projects', async () => {
      const response = await request(app.getHttpServer())
        .post(`/projects/${projectId}/tasks`)
        .set('Authorization', `Bearer ${memberToken}`)
        .send({
          title: 'Member Created Task',
          description: 'Task created by member user',
          status: 'todo',
          priority: 'medium',
          assignee: memberUserId, // Assign to self
        })
        .expect(201);

      memberTaskId = response.body._id;
      expect(response.body.createdBy._id).toBe(memberUserId);
    });

    it('Member can update their own tasks', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/tasks/${memberTaskId}`)
        .set('Authorization', `Bearer ${memberToken}`)
        .send({
          title: 'Updated Member Task',
          status: 'in_progress',
          description: 'Updated by the assignee',
        })
        .expect(200);

      expect(response.body.title).toBe('Updated Member Task');
      expect(response.body.status).toBe('in_progress');
    });

    it('Member cannot update tasks not assigned to them', async () => {
      // Admin creates a task assigned to member2
      const taskResponse = await request(app.getHttpServer())
        .post(`/projects/${projectId}/tasks`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          title: 'Other Member Task',
          assignee: member2UserId,
          status: 'todo',
          priority: 'low',
        });

      otherTaskId = taskResponse.body._id;

      // Member1 tries to update member2's task
      await request(app.getHttpServer())
        .patch(`/tasks/${otherTaskId}`)
        .set('Authorization', `Bearer ${memberToken}`)
        .send({
          title: 'Unauthorized Update',
        })
        .expect(403);
    });

    it('Member can view project dashboard and export CSV', async () => {
      // View dashboard
      const dashboardResponse = await request(app.getHttpServer())
        .get(`/projects/${projectId}/summary`)
        .set('Authorization', `Bearer ${memberToken}`)
        .expect(200);

      expect(dashboardResponse.body.total).toBeGreaterThan(0);

      // Export CSV
      await request(app.getHttpServer())
        .get(`/projects/${projectId}/tasks/export.csv`)
        .set('Authorization', `Bearer ${memberToken}`)
        .expect(200);
    });

    it('Member cannot delete tasks', async () => {
      await request(app.getHttpServer())
        .delete(`/tasks/${memberTaskId}`)
        .set('Authorization', `Bearer ${memberToken}`)
        .expect(403);
    });

    it('Member cannot perform project management operations', async () => {
      // Cannot create projects
      await request(app.getHttpServer())
        .post('/projects')
        .set('Authorization', `Bearer ${memberToken}`)
        .send({
          name: 'Unauthorized Project',
          key: 'UNAUTH',
        })
        .expect(403);

      // Cannot update projects
      await request(app.getHttpServer())
        .patch(`/projects/${projectId}`)
        .set('Authorization', `Bearer ${memberToken}`)
        .send({
          name: 'Unauthorized Update',
        })
        .expect(403);

      // Cannot delete projects
      await request(app.getHttpServer())
        .delete(`/projects/${projectId}`)
        .set('Authorization', `Bearer ${memberToken}`)
        .expect(403);

      // Cannot add/remove members
      await request(app.getHttpServer())
        .post(`/projects/${projectId}/members`)
        .set('Authorization', `Bearer ${memberToken}`)
        .send({ userId: 'someUserId' })
        .expect(403);
    });
  });

  describe('Task Filtering and Search Scenarios', () => {
    let projectId: string;
    let tasks: string[] = [];

    beforeAll(async () => {
      // Setup project with multiple tasks
      const projectResponse = await request(app.getHttpServer())
        .post('/projects')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Filter Test Project',
          key: 'FILTER',
        });
      
      projectId = projectResponse.body._id;

      // Add member
      await request(app.getHttpServer())
        .post(`/projects/${projectId}/members`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ userId: memberUserId });

      // Create various tasks for filtering
      const taskData = [
        { title: 'High Priority Bug Fix', status: 'todo', priority: 'high', assignee: memberUserId },
        { title: 'Medium Priority Feature', status: 'in_progress', priority: 'medium', assignee: memberUserId },
        { title: 'Low Priority Documentation', status: 'done', priority: 'low', assignee: member2UserId },
        { title: 'Critical Security Update', status: 'todo', priority: 'high', assignee: adminUserId },
        { title: 'UI Enhancement', status: 'in_progress', priority: 'medium' }, // Unassigned
      ];

      for (const task of taskData) {
        const response = await request(app.getHttpServer())
          .post(`/projects/${projectId}/tasks`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send(task);
        tasks.push(response.body._id);
      }
    });

    it('Member can filter tasks by status', async () => {
      const response = await request(app.getHttpServer())
        .get(`/projects/${projectId}/tasks?status=todo`)
        .set('Authorization', `Bearer ${memberToken}`)
        .expect(200);

      expect(response.body.tasks.every(task => task.status === 'todo')).toBe(true);
      expect(response.body.tasks.length).toBe(2);
    });

    it('Member can filter tasks by priority', async () => {
      const response = await request(app.getHttpServer())
        .get(`/projects/${projectId}/tasks?priority=high`)
        .set('Authorization', `Bearer ${memberToken}`)
        .expect(200);

      expect(response.body.tasks.every(task => task.priority === 'high')).toBe(true);
      expect(response.body.tasks.length).toBe(2);
    });

    it('Member can search tasks by title', async () => {
      const response = await request(app.getHttpServer())
        .get(`/projects/${projectId}/tasks?q=Bug`)
        .set('Authorization', `Bearer ${memberToken}`)
        .expect(200);

      expect(response.body.tasks.some(task => task.title.includes('Bug'))).toBe(true);
    });

    it('Member can filter by assignee', async () => {
      const response = await request(app.getHttpServer())
        .get(`/projects/${projectId}/tasks?assignee=${memberUserId}`)
        .set('Authorization', `Bearer ${memberToken}`)
        .expect(200);

      expect(response.body.tasks.every(task => 
        task.assignee && task.assignee._id === memberUserId
      )).toBe(true);
    });

    it('Member can combine multiple filters', async () => {
      const response = await request(app.getHttpServer())
        .get(`/projects/${projectId}/tasks?status=todo&priority=high`)
        .set('Authorization', `Bearer ${memberToken}`)
        .expect(200);

      expect(response.body.tasks.every(task => 
        task.status === 'todo' && task.priority === 'high'
      )).toBe(true);
    });

    it('Member can paginate through results', async () => {
      const page1Response = await request(app.getHttpServer())
        .get(`/projects/${projectId}/tasks?page=1&limit=2`)
        .set('Authorization', `Bearer ${memberToken}`)
        .expect(200);

      expect(page1Response.body.tasks).toHaveLength(2);
      expect(page1Response.body.pagination.page).toBe(1);
      expect(page1Response.body.pagination.total).toBe(5);

      const page2Response = await request(app.getHttpServer())
        .get(`/projects/${projectId}/tasks?page=2&limit=2`)
        .set('Authorization', `Bearer ${memberToken}`)
        .expect(200);

      expect(page2Response.body.tasks).toHaveLength(2);
      expect(page2Response.body.pagination.page).toBe(2);
    });
  });

  describe('Cross-Project Access Control', () => {
    let project1Id: string;
    let project2Id: string;
    let task1Id: string;
    let task2Id: string;

    beforeAll(async () => {
      // Create project 1 with member1
      const project1Response = await request(app.getHttpServer())
        .post('/projects')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Project Alpha',
          key: 'ALPHA',
        });
      project1Id = project1Response.body._id;

      await request(app.getHttpServer())
        .post(`/projects/${project1Id}/members`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ userId: memberUserId });

      // Create project 2 with member2 only
      const project2Response = await request(app.getHttpServer())
        .post('/projects')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Project Beta',
          key: 'BETA',
        });
      project2Id = project2Response.body._id;

      await request(app.getHttpServer())
        .post(`/projects/${project2Id}/members`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ userId: member2UserId });

      // Create tasks in each project
      const task1Response = await request(app.getHttpServer())
        .post(`/projects/${project1Id}/tasks`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          title: 'Alpha Task',
          status: 'todo',
          priority: 'medium',
        });
      task1Id = task1Response.body._id;

      const task2Response = await request(app.getHttpServer())
        .post(`/projects/${project2Id}/tasks`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          title: 'Beta Task',
          status: 'todo',
          priority: 'medium',
        });
      task2Id = task2Response.body._id;
    });

    it('Member1 can only see Project Alpha', async () => {
      const response = await request(app.getHttpServer())
        .get('/projects')
        .set('Authorization', `Bearer ${memberToken}`)
        .expect(200);

      expect(response.body).toHaveLength(1);
      expect(response.body[0]._id).toBe(project1Id);
    });

    it('Member2 can only see Project Beta', async () => {
      const response = await request(app.getHttpServer())
        .get('/projects')
        .set('Authorization', `Bearer ${member2Token}`)
        .expect(200);

      expect(response.body).toHaveLength(1);
      expect(response.body[0]._id).toBe(project2Id);
    });

    it('Member1 cannot access Project Beta tasks', async () => {
      await request(app.getHttpServer())
        .get(`/projects/${project2Id}/tasks`)
        .set('Authorization', `Bearer ${memberToken}`)
        .expect(403);
    });

    it('Member1 cannot access Project Beta dashboard', async () => {
      await request(app.getHttpServer())
        .get(`/projects/${project2Id}/summary`)
        .set('Authorization', `Bearer ${memberToken}`)
        .expect(403);
    });

    it('Member1 cannot create tasks in Project Beta', async () => {
      await request(app.getHttpServer())
        .post(`/projects/${project2Id}/tasks`)
        .set('Authorization', `Bearer ${memberToken}`)
        .send({
          title: 'Unauthorized Task',
          status: 'todo',
          priority: 'medium',
        })
        .expect(403);
    });

    it('Admin can access all projects and tasks', async () => {
      // Admin can see all projects
      const projectsResponse = await request(app.getHttpServer())
        .get('/projects')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(projectsResponse.body.length).toBeGreaterThanOrEqual(2);

      // Admin can access both project tasks
      await request(app.getHttpServer())
        .get(`/projects/${project1Id}/tasks`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      await request(app.getHttpServer())
        .get(`/projects/${project2Id}/tasks`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      // Admin can update tasks in any project
      await request(app.getHttpServer())
        .patch(`/tasks/${task1Id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ title: 'Admin Updated Alpha Task' })
        .expect(200);

      await request(app.getHttpServer())
        .patch(`/tasks/${task2Id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ title: 'Admin Updated Beta Task' })
        .expect(200);
    });
  });
});

import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { UsersService } from '../users/users.service';
import { ProjectsService } from '../projects/projects.service';
import { TasksService } from '../tasks/tasks.service';
import { UserRole, TaskStatus, TaskPriority } from '../common/enums';
import * as bcrypt from 'bcryptjs';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  
  const usersService = app.get(UsersService);
  const projectsService = app.get(ProjectsService);
  const tasksService = app.get(TasksService);

  try {
    console.log('Starting database seeding...');

    // Create admin user
    const adminPasswordHash = await bcrypt.hash('Admin@123', 10);
    const admin = await usersService.create({
      name: 'Admin User',
      email: 'admin@example.com',
      passwordHash: adminPasswordHash,
      role: UserRole.ADMIN,
    });
    console.log('Admin user created');

    // Create member user
    const memberPasswordHash = await bcrypt.hash('Member@123', 10);
    const member = await usersService.create({
      name: 'Member User',
      email: 'member@example.com',
      passwordHash: memberPasswordHash,
      role: UserRole.MEMBER,
    });
    console.log('Member user created');

    // Create a project
    const project = await projectsService.create(
      {
        name: 'Team Kanban Project',
        key: 'KAN',
        members: [admin._id.toString(), member._id.toString()],
      },
      admin._id.toString()
    );
    console.log('Project created');

    // Create sample tasks
    const tasks = [
      {
        title: 'Set up development environment',
        description: 'Configure Docker, Node.js, and MongoDB for the project',
        status: TaskStatus.DONE,
        priority: TaskPriority.HIGH,
        assignee: admin._id.toString(),
        dueDate: new Date('2024-01-15').toISOString(),
      },
      {
        title: 'Implement user authentication',
        description: 'Create JWT-based authentication system with login and registration',
        status: TaskStatus.DONE,
        priority: TaskPriority.HIGH,
        assignee: admin._id.toString(),
        dueDate: new Date('2024-01-20').toISOString(),
      },
      {
        title: 'Design database schema',
        description: 'Create MongoDB schemas for users, projects, and tasks',
        status: TaskStatus.DONE,
        priority: TaskPriority.MEDIUM,
        assignee: member._id.toString(),
        dueDate: new Date('2024-01-18').toISOString(),
      },
      {
        title: 'Build project management API',
        description: 'Implement CRUD operations for projects with role-based access',
        status: TaskStatus.IN_PROGRESS,
        priority: TaskPriority.HIGH,
        assignee: admin._id.toString(),
        dueDate: new Date('2024-02-01').toISOString(),
      },
      {
        title: 'Create task management system',
        description: 'Build API endpoints for task CRUD with filtering and pagination',
        status: TaskStatus.IN_PROGRESS,
        priority: TaskPriority.HIGH,
        assignee: member._id.toString(),
        dueDate: new Date('2024-02-05').toISOString(),
      },
      {
        title: 'Implement dashboard analytics',
        description: 'Create KPI dashboard with charts and project summaries',
        status: TaskStatus.TODO,
        priority: TaskPriority.MEDIUM,
        assignee: member._id.toString(),
        dueDate: new Date('2024-02-10').toISOString(),
      },
      {
        title: 'Add CSV export functionality',
        description: 'Allow users to export project tasks to CSV format',
        status: TaskStatus.TODO,
        priority: TaskPriority.LOW,
        assignee: admin._id.toString(),
        dueDate: new Date('2024-02-15').toISOString(),
      },
      {
        title: 'Write unit tests',
        description: 'Create comprehensive test suite for backend APIs',
        status: TaskStatus.TODO,
        priority: TaskPriority.MEDIUM,
        assignee: member._id.toString(),
        dueDate: new Date('2024-02-20').toISOString(),
      },
      {
        title: 'Build React frontend',
        description: 'Create responsive UI using Material-UI components',
        status: TaskStatus.TODO,
        priority: TaskPriority.HIGH,
        assignee: admin._id.toString(),
        dueDate: new Date('2024-02-25').toISOString(),
      },
      {
        title: 'Deploy to production',
        description: 'Set up CI/CD pipeline and deploy application',
        status: TaskStatus.TODO,
        priority: TaskPriority.LOW,
        assignee: admin._id.toString(),
        dueDate: new Date('2024-03-01').toISOString(),
      },
    ];

    for (const taskData of tasks) {
      await tasksService.create(project._id.toString(), taskData, admin._id.toString(), UserRole.ADMIN);
    }
    console.log('Sample tasks created');

    console.log('Database seeding completed successfully!');
    console.log('Test Accounts:');
    console.log('Admin: admin@example.com / Admin@123');
    console.log('Member: member@example.com / Member@123');

  } catch (error) {
    console.error('Error during seeding:', error);
  } finally {
    await app.close();
  }
}

bootstrap();

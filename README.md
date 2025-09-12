# Welcome to mini kanban Application

The application comes with pre-seeded test accounts:

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@example.com | Admin@123 |
| Member | member@example.com | Member@123 |


# Database Schema
# User 
{
  _id: ObjectId,
  name: string,
  email: string (unique),
  passwordHash: string,
  role: 'admin' | 'member',
  createdAt: Date,
  updatedAt: Date
}

# Project
{
  _id: ObjectId,
  name: string,
  key: string (unique),
  members: [ObjectId], // User IDs
  createdBy: ObjectId, // User ID
  createdAt: Date,
  updatedAt: Date
}

# Task
{
  _id: ObjectId,
  projectId: ObjectId,
  title: string,
  description: string,
  status: 'todo' | 'in_progress' | 'done',
  priority: 'low' | 'med' | 'high',
  assignee: ObjectId, // User ID
  dueDate: Date,
  createdBy: ObjectId, // User ID
  createdAt: Date,
  updatedAt: Date
}



# Running Application
# Local Dev setup
# Installing Dependencies
   # Backend
   cd backend
   npm install

   # Frontend
   cd frontend
   npm install

# Docker starting
Once you have docker deamon running,
cd into the mini-kanban

       docker-compose up --build 

# View all logs
docker-compose logs

# View specific service logs
docker-compose logs api
docker-compose logs web
docker-compose logs mongo


# API DOcumentation
Interactive API documentation is available at:
- **Swagger UI**: http://localhost:8080/api/docs



# Functinalities implemented
# Admin
 1. Can create project 
 2. Add/remove members to the project
 3. Create/Update/Delete project
 4. Create/ Update/ Delete any task
 5. Admin only dashboard with project details
# Members 
 1. can create task within their project
 2. Update task in the project
 3. use filter option based on status, priority, assignee and download teh task as csv.
 4. Can view dashboard if they are member of the project(not task assigned in the project) which will show only task counts woth their status and chart for the same

 # Core features
 1. Login/ register with JWT token 
 2. admin and member role for the kanban
 3. task - CRUD with role guards; list supports pagination, search, filters (status, assignee, priority, dueDate range).
 4. Dashboard (per project): KPIs (total, done, overdue) + chart (bar or pie).
 5. Export the task into csv file


 Please dont hesitate to reach out to me if you have any query related to this or any error if you are experiencing (It might due to not clearer README) - adhavann@hotmail.com

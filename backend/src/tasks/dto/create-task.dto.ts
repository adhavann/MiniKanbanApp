import { IsNotEmpty, IsString, IsOptional, IsEnum, IsDateString, IsMongoId } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { TaskStatus, TaskPriority } from '../../common/enums';

export class CreateTaskDto {
  @ApiProperty({ example: 'Implement user authentication' })
  @IsNotEmpty()
  @IsString()
  title: string;

  @ApiProperty({ example: 'Create JWT-based authentication system', required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ enum: TaskStatus, default: TaskStatus.TODO })
  @IsOptional()
  @IsEnum(TaskStatus)
  status?: TaskStatus;

  @ApiProperty({ enum: TaskPriority, default: TaskPriority.MEDIUM })
  @IsOptional()
  @IsEnum(TaskPriority)
  priority?: TaskPriority;

  @ApiProperty({ example: '507f1f7', required: false })
  @IsOptional()
  @IsMongoId({ message: 'assignee must be a valid mongodb id' })
  assignee?: string;

  @ApiProperty({ example: '2025-09-11T23:59:59.000Z', required: false })
  @IsOptional()
  @IsDateString()
  dueDate?: string;
}

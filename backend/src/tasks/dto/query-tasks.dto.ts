import { IsOptional, IsEnum, IsString, IsDateString, IsNumberString, IsMongoId } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { TaskStatus, TaskPriority } from '../../common/enums';

export class QueryTasksDto {
  @ApiProperty({ enum: TaskStatus, required: false })
  @IsOptional()
  @IsEnum(TaskStatus)
  status?: TaskStatus;

  @ApiProperty({ example: '507f1f77bcf86cd799439011', required: false })
  @IsOptional()
  @IsMongoId()
  assignee?: string;

  @ApiProperty({ example: 'search text', required: false })
  @IsOptional()
  @IsString()
  q?: string;

  @ApiProperty({ enum: TaskPriority, required: false })
  @IsOptional()
  @IsEnum(TaskPriority)
  priority?: TaskPriority;

  @ApiProperty({ example: '2024-01-01T00:00:00.000Z', required: false })
  @IsOptional()
  @IsDateString()
  dueFrom?: string;

  @ApiProperty({ example: '2024-12-31T23:59:59.000Z', required: false })
  @IsOptional()
  @IsDateString()
  dueTo?: string;

  @ApiProperty({ example: '1', default: '1', required: false })
  @IsOptional()
  @IsNumberString()
  page?: string;

  @ApiProperty({ example: '10', default: '10', required: false })
  @IsOptional()
  @IsNumberString()
  limit?: string;
}

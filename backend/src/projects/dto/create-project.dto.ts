import { IsNotEmpty, IsString, IsArray, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateProjectDto {
  @ApiProperty({ example: 'Team Kanban Project' })
  @IsNotEmpty()
  @IsString()
  name: string;

  @ApiProperty({ example: 'KAN' })
  @IsNotEmpty()
  @IsString()
  key: string;

  @ApiProperty({ example: ['userId1', 'userId2'], required: false })
  @IsOptional()
  @IsArray()
  members?: string[];
}

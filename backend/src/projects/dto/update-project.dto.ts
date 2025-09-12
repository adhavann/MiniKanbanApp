import { IsOptional, IsString, IsArray } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateProjectDto {
  @ApiProperty({ example: 'Updated Project Name', required: false })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiProperty({ example: 'UPDT', required: false })
  @IsOptional()
  @IsString()
  key?: string;

  @ApiProperty({ example: ['userId1', 'userId2'], required: false })
  @IsOptional()
  @IsArray()
  members?: string[];
}

export class AddMembersDto {
  @ApiProperty({ example: ['userId1', 'userId2'] })
  @IsArray()
  userIds: string[];
}

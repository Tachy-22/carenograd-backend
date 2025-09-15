import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsEmail, IsOptional } from 'class-validator';

export class UserProfileDto {
  @ApiProperty({ example: '8b276f6f-ac2d-43db-a776-ce976629d3f1', description: 'User unique identifier' })
  @IsString()
  id: string;

  @ApiProperty({ example: 'user@example.com', description: 'User email address' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'John Doe', description: 'User full name' })
  @IsString()
  name: string;

  @ApiProperty({ example: 'https://lh3.googleusercontent.com/...', description: 'User profile picture URL', required: false })
  @IsOptional()
  @IsString()
  picture?: string;

  @ApiProperty({ example: '2024-01-01T00:00:00.000Z', description: 'Account creation date' })
  created_at: Date;
}

export class AuthResponseDto {
  @ApiProperty({ example: 'Authentication successful', description: 'Status message' })
  @IsString()
  message: string;

  @ApiProperty({ type: UserProfileDto, description: 'User profile information' })
  user: UserProfileDto;

  @ApiProperty({ 
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...', 
    description: 'JWT access token for API authentication' 
  })
  @IsString()
  access_token: string;
}

export class RefreshTokenResponseDto {
  @ApiProperty({ 
    example: 'ya29.a0AfH6SMC...', 
    description: 'Refreshed Google access token' 
  })
  @IsString()
  access_token: string;
}
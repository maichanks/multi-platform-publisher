import { IsEmail, IsString, IsNotEmpty, IsOptional, IsUrl } from 'class-validator';

export class CreateUserDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsOptional()
  @IsUrl()
  avatarUrl?: string;
}

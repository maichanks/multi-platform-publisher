export class UserDto {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string;
  emailVerified?: Date;
  createdAt: Date;
}

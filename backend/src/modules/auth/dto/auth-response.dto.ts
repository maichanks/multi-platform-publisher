export class AuthResponseDto {
  accessToken: string;
  user: {
    id: string;
    email: string;
    name: string;
    avatarUrl?: string;
  };
  workspace?: {
    id: string;
    name: string;
    slug: string;
  };
}

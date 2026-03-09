export class WorkspaceDto {
  id: string;
  name: string;
  slug: string;
  description?: string;
  avatarUrl?: string;
  ownerId: string;
  createdAt: Date;
  updatedAt: Date;
}

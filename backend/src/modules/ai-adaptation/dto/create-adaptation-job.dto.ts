export class CreateAdaptationJobDto {
  contentId: string;
  workspaceId: string;
  platforms?: string[]; // if empty, use content.targetPlatforms
  force?: boolean; // rerun even if already adapted
}

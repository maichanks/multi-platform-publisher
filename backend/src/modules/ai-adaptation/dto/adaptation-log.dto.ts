export class AdaptationLogDto {
  id: string;
  contentId: string;
  platform: string;
  prompt: string;
  originalText: string;
  adaptedText: string;
  modelUsed: string;
  tokensInput: number;
  tokensOutput: number;
  tokensTotal: number;
  costCents: number;
  durationMs: number;
  success: boolean;
  errorMessage?: string;
  createdAt: Date;
}

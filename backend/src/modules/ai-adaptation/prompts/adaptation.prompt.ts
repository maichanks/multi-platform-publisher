export function getAdaptationPrompt(platform: string, content: { title?: string; body: string; tags?: string[] }): string {
  const platformGuidelines: Record<string, string> = {
    twitter: `
- Platform: Twitter (X)
- Max length: 280 characters (original tweet), but threads allowed
- Style: Concise, engaging, use hashtags sparingly (1-2 max)
- Tone: Direct, conversational, often with a hook
- Media: Can include images or videos; mention if media is present
- Do not use markdown formatting.
    `.trim(),
    linkedin: `
- Platform: LinkedIn
- Style: Professional, insightful, longer-form allowed
- Tone: Business-oriented, authoritative but approachable
- Use line breaks for readability; can include bullet points
- Include relevant industry hashtags (3-5)
- Can mention professional achievements or insights
    `.trim(),
    reddit: `
- Platform: Reddit
- Style: Casual, community-focused, often include context
- Tone: Conversational, can be humorous or serious depending on subreddit
- Avoid self-promotion; be valuable to the community
- Use markdown formatting (bold, italics, lists) for readability
- Include a call to action (question) to encourage engagement
    `.trim(),
    default: `
- Adapt the content for the target platform while maintaining core message
- Consider platform norms and constraints
    `.trim(),
  };

  const guidelines = platformGuidelines[platform] || platformGuidelines.default;

  const originalTitle = content.title || 'No title';
  const originalBody = content.body;
  const tags = content.tags?.join(', ') || 'none';

  return `
You are an expert social media writer. Adapt the following content for ${platform}.

${guidelines}

Original Title: ${originalTitle}
Original Body:
${originalBody}
Original Tags: ${tags}

Please provide the adapted version. Output only the adapted content, with no additional commentary.
`.trim();
}

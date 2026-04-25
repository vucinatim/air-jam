import { getReleaseModerationConfig } from "@/server/releases/release-moderation-config";

type OpenAiModerationResponse = {
  results?: Array<{
    flagged?: boolean;
    categories?: Record<string, boolean>;
    category_scores?: Record<string, number>;
  }>;
};

export type ReleaseImageModerationResult = {
  flagged: boolean;
  categories: Record<string, boolean>;
  categoryScores: Record<string, number>;
};

export const moderateReleaseScreenshot = async ({
  screenshotBuffer,
}: {
  screenshotBuffer: Buffer;
}): Promise<ReleaseImageModerationResult> => {
  const config = getReleaseModerationConfig();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.openAi.timeoutMs);

  try {
    const dataUrl = `data:image/png;base64,${screenshotBuffer.toString("base64")}`;
    const response = await fetch(`${config.openAi.baseUrl}/moderations`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${config.openAi.apiKey}`,
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: config.openAi.model,
        input: [
          {
            type: "image_url",
            image_url: {
              url: dataUrl,
            },
          },
        ],
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(
        `OpenAI moderation request failed with ${response.status}: ${body}`,
      );
    }

    const payload = (await response.json()) as OpenAiModerationResponse;
    const result = payload.results?.[0];
    if (!result) {
      throw new Error("OpenAI moderation response did not include a result.");
    }

    return {
      flagged: Boolean(result.flagged),
      categories: result.categories ?? {},
      categoryScores: result.category_scores ?? {},
    };
  } finally {
    clearTimeout(timeout);
  }
};

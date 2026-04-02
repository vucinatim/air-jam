import { expect, type Page } from "@playwright/test";

export async function dismissControllerFullscreenPrompt(
  page: Page,
): Promise<void> {
  const prompt = page.getByTestId("controller-fullscreen-prompt");
  await prompt.waitFor({ state: "visible", timeout: 5_000 }).catch(() => null);
  if (!(await prompt.isVisible().catch(() => false))) {
    return;
  }

  await page.getByTestId("controller-fullscreen-prompt-dismiss").click();
  await expect(prompt).toBeHidden();
}

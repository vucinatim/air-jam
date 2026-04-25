const AIRJAM_TEMPLATE_ID_PATTERN = /^[a-z0-9-]+$/;

export const isCreateAirJamTemplateId = (
  value: string | null | undefined,
): value is string => {
  const trimmed = value?.trim();
  return !!trimmed && AIRJAM_TEMPLATE_ID_PATTERN.test(trimmed);
};

export const buildCreateAirJamTemplateCommand = (
  templateId: string | null | undefined,
  projectName = "my-game",
): string | null => {
  const normalizedTemplateId = templateId?.trim();
  const normalizedProjectName = projectName.trim() || "my-game";

  if (!isCreateAirJamTemplateId(normalizedTemplateId)) {
    return null;
  }

  return `npx create-airjam@latest ${normalizedProjectName} --template ${normalizedTemplateId}`;
};

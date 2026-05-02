import { redirect } from "next/navigation";

export default async function LegacyGameSettingsPage({
  params,
}: {
  params: Promise<{ gameId: string }>;
}) {
  const { gameId } = await params;
  redirect(`/dashboard/games/${gameId}#development-preview`);
}

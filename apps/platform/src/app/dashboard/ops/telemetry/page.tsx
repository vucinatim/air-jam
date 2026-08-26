import { db } from "@/db";
import { users } from "@/db/schema";
import { auth } from "@/lib/auth";
import { createLoginHref } from "@/lib/auth-redirect";
import { isOpsAdmin } from "@/lib/auth/user-role";
import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { OpsTelemetryPageClient } from "./page-client";

export default async function OpsTelemetryPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.session || !session.user) {
    redirect(createLoginHref("/dashboard/ops/telemetry"));
  }

  const user = await db.query.users.findFirst({
    where: eq(users.id, session.user.id),
  });

  if (!user || !isOpsAdmin(user.role)) {
    redirect("/dashboard");
  }

  return <OpsTelemetryPageClient />;
}

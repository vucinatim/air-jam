import { auth } from "@/lib/auth";
import { createLoginHref } from "@/lib/auth-redirect";
import { isOpsAdmin } from "@/lib/auth/user-role";
import { db } from "@/db";
import { users } from "@/db/schema";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { OpsReleasesPageClient } from "./page-client";

export default async function OpsReleasesPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.session || !session.user) {
    redirect(createLoginHref("/dashboard/ops/releases"));
  }

  const user = await db.query.users.findFirst({
    where: eq(users.id, session.user.id),
  });

  if (!user || !isOpsAdmin(user.role)) {
    redirect("/dashboard");
  }

  return <OpsReleasesPageClient />;
}

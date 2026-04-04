import { getDefaultDocsHref } from "@/features/docs";
import { redirect } from "next/navigation";

export default function DocsPage() {
  redirect(getDefaultDocsHref());
}

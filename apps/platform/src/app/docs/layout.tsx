import { DocsSidebar } from "@/components/docs-sidebar";
import { DynamicBreadcrumbs } from "@/components/dynamic-breadcrumbs";
import { TableOfContents } from "@/components/toc";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Github } from "lucide-react";
import Link from "next/link";

export default function DocsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SidebarProvider>
      <DocsSidebar />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center justify-between gap-2 border-b px-4">
          <div className="flex items-center gap-2">
            <SidebarTrigger className="-ml-1" />
            <DynamicBreadcrumbs />
          </div>
          <Link
            href="https://github.com/vucinatim/air-jam"
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted-foreground hover:text-foreground transition-colors"
            aria-label="GitHub Repository"
          >
            <Github className="h-5 w-5" />
          </Link>
        </header>
        <div className="flex flex-1 flex-col p-4 md:p-6 lg:p-8">
          <div className="mx-auto w-full max-w-5xl">
            <div className="flex flex-col gap-4 xl:grid xl:grid-cols-[1fr_200px] xl:gap-12">
              <div className="prose dark:prose-invert prose-code:before:content-none prose-code:after:content-none max-w-none">
                {children}
              </div>
              <TableOfContents />
            </div>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}

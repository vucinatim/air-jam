import { Navbar } from "@/components/navbar";
import { getBlogPosts } from "@/features/blog";
import { ArrowRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Blog",
  description:
    "Release notes, architecture write-ups, and product updates from Air Jam.",
};

function formatPublishedDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date(value));
}

export default function BlogIndexPage() {
  const posts = getBlogPosts();

  return (
    <div className="bg-background min-h-screen">
      <Navbar />
      <main className="mx-auto flex max-w-4xl flex-col gap-10 px-4 pt-28 pb-16 md:px-6">
        <header className="space-y-4">
          <p className="text-muted-foreground text-sm tracking-[0.24em] uppercase">
            Air Jam Blog
          </p>
          <div className="space-y-3">
            <h1 className="text-foreground text-4xl font-semibold tracking-tight md:text-5xl">
              Product updates, release notes, and framework thinking.
            </h1>
            <p className="text-muted-foreground max-w-2xl text-base md:text-lg">
              The blog is for chronological updates. The docs stay canonical and
              evergreen.
            </p>
          </div>
        </header>

        <div className="grid gap-4">
          {posts.map((post) => (
            <Link
              key={post.slug}
              href={post.href}
              className="border-border/60 bg-card/40 hover:border-foreground/30 hover:bg-card/70 group rounded-2xl border p-6 transition-colors"
            >
              <article className="flex flex-col gap-4">
                <div className="text-muted-foreground flex flex-wrap items-center gap-3 text-sm">
                  <span>{formatPublishedDate(post.publishedAt)}</span>
                  <span>·</span>
                  <span>{post.author}</span>
                </div>
                <div className="space-y-2">
                  <h2 className="text-foreground text-2xl font-semibold tracking-tight">
                    {post.title}
                  </h2>
                  <p className="text-muted-foreground text-base">
                    {post.summary}
                  </p>
                </div>
                <div className="text-muted-foreground flex flex-wrap gap-2 text-sm">
                  {post.tags.map((tag) => (
                    <span key={tag} className="bg-muted rounded-full px-3 py-1">
                      {tag}
                    </span>
                  ))}
                </div>
                <div className="text-foreground inline-flex items-center gap-2 text-sm font-medium">
                  Read article
                  <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
                </div>
              </article>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}

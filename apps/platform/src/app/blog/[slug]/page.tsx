import { Navbar } from "@/components/navbar";
import {
  buildBlogJsonLd,
  getBlogDocumentBySlug,
  getBlogStaticParams,
} from "@/features/blog";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

type BlogPageProps = {
  params: Promise<{ slug: string }>;
};

function formatPublishedDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date(value));
}

export async function generateStaticParams() {
  return getBlogStaticParams();
}

export async function generateMetadata({
  params,
}: BlogPageProps): Promise<Metadata> {
  const { slug } = await params;
  const document = getBlogDocumentBySlug(slug);

  if (!document) {
    return {};
  }

  return document.metadata;
}

export default async function BlogPostPage({ params }: BlogPageProps) {
  const { slug } = await params;
  const document = getBlogDocumentBySlug(slug);

  if (!document) {
    notFound();
  }

  const { default: Component } = await document.loadComponent();
  const jsonLd = buildBlogJsonLd(document.post);

  return (
    <div className="bg-background min-h-screen">
      <Navbar />
      <main className="mx-auto flex max-w-3xl flex-col gap-8 px-4 pt-28 pb-16 md:px-6">
        <header className="space-y-4">
          <p className="text-muted-foreground text-sm tracking-[0.24em] uppercase">
            Air Jam Blog
          </p>
          <div className="space-y-3">
            <h1 className="text-foreground text-4xl font-semibold tracking-tight md:text-5xl">
              {document.post.title}
            </h1>
            <p className="text-muted-foreground text-base md:text-lg">
              {document.post.summary}
            </p>
          </div>
          <div className="text-muted-foreground flex flex-wrap items-center gap-3 text-sm">
            <span>{formatPublishedDate(document.post.publishedAt)}</span>
            <span>·</span>
            <span>{document.post.author}</span>
          </div>
        </header>

        <article className="prose dark:prose-invert prose-code:before:content-none prose-code:after:content-none max-w-none">
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
          />
          <Component />
        </article>
      </main>
    </div>
  );
}

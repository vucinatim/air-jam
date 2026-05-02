import {
  buildDocsJsonLd,
  getDocsDocumentBySlug,
  getDocsStaticParams,
} from "@/features/docs";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

type DocsPageProps = {
  params: Promise<{ slug: string[] }>;
};

export async function generateStaticParams() {
  return getDocsStaticParams();
}

export async function generateMetadata({
  params,
}: DocsPageProps): Promise<Metadata> {
  const { slug } = await params;
  const document = getDocsDocumentBySlug(slug);

  if (!document) {
    return {};
  }

  return document.metadata;
}

export default async function DocsPage({ params }: DocsPageProps) {
  const { slug } = await params;
  const document = getDocsDocumentBySlug(slug);

  if (!document) {
    notFound();
  }

  const { default: Component } = await document.loadComponent();
  const jsonLd = buildDocsJsonLd(document.page);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <Component />
    </>
  );
}

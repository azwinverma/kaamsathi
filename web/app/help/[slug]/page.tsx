import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLocale } from "next-intl/server";
import { PublicFrame } from "@/components/legal/legal-document";
import { HelpArticleView, fetchHelpArticle } from "@/components/support/help-public";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const article = await fetchHelpArticle(await getLocale(), slug);
  if (!article) return {};
  return { title: article.title, alternates: { canonical: `/help/${article.slug}` } };
}

export default async function HelpArticlePage({ params }: Props) {
  const { slug } = await params;
  const article = await fetchHelpArticle(await getLocale(), slug);
  if (!article) notFound();
  return (
    <PublicFrame>
      <HelpArticleView article={article} />
    </PublicFrame>
  );
}

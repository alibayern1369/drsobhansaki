import Image from "next/image";
import { articleCover } from "./article-content";
import Link from "next/link";
import { publishedArticles } from "@/server/content";
import { type Locale } from "@/lib/content";
export async function PublishedJournal({
  locale,
  articles: provided,
}: {
  locale: Locale;
  articles?: Awaited<ReturnType<typeof publishedArticles>>;
}) {
  const articles = provided || (await publishedArticles(locale));
  if (!articles.length) return null;
  return (
    <div className="services-grid" style={{ marginBottom: 25 }}>
      {articles.map((a) => (
        <Link
          key={a.id}
          href={`/${locale}/articles/${a.slug}`}
          className="service-card"
        >
          {articleCover(a.body) && (
            <Image
              src={articleCover(a.body)!.src}
              alt={articleCover(a.body)!.alt}
              unoptimized
              width={1200}
              height={630}
              className="article-cover"
            />
          )}
          <span className="eyebrow">
            {locale === "fa" ? "مقاله آموزشی" : "HEALTH ARTICLE"}
          </span>
          <h2 style={{ fontSize: 20 }}>{a.title}</h2>
          <p>{a.description}</p>
        </Link>
      ))}
    </div>
  );
}

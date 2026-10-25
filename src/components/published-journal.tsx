import Link from "next/link";
import { publishedArticles } from "@/server/content";
import { type Locale } from "@/lib/content";
export async function PublishedJournal({ locale }: { locale: Locale }) {
  const articles = await publishedArticles(locale);
  if (!articles.length) return null;
  return (
    <div className="services-grid" style={{ marginBottom: 25 }}>
      {articles.map((a) => (
        <Link
          key={a.id}
          href={`/${locale}/articles/${a.slug}`}
          className="service-card"
        >
          <span className="eyebrow">
            {locale === "fa" ? "مقاله تأییدشده" : "REVIEWED ARTICLE"}
          </span>
          <h2 style={{ fontSize: 20 }}>{a.title}</h2>
          <p>{a.description}</p>
        </Link>
      ))}
    </div>
  );
}

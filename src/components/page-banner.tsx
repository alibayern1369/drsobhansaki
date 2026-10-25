import Link from "next/link";
import { copy, type Locale } from "@/lib/content";
import { Icon } from "./icon";
export function PageBanner({
  locale,
  title,
  description,
}: {
  locale: Locale;
  title: string;
  description?: string;
}) {
  return (
    <div className="page-banner">
      <div className="breadcrumb">
        <Link href={`/${locale}`}>{copy[locale].home}</Link>
        <Icon name={locale === "fa" ? "left" : "right"} size={13} />
        <span>{title}</span>
      </div>
      <h1>{title}</h1>
      {description && <p>{description}</p>}
    </div>
  );
}

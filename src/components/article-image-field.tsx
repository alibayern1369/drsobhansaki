"use client";
import { useId, useState } from "react";
import { articleCover } from "./article-content";
export function withArticleCover(body: string, url: string, title: string) {
  if (!url) return body;
  const previous = articleCover(body);
  const rest =
    previous && body.startsWith("![")
      ? body.slice(body.indexOf(")") + 1).trimStart()
      : body;
  return `![${title.replace(/[\[\]]/g, "")}](${url})\n\n${rest}`;
}
export function ArticleImageField({
  fa,
  initialBody = "",
}: {
  fa: boolean;
  initialBody?: string;
}) {
  const id = useId();
  const [url, setUrl] = useState(articleCover(initialBody)?.src || "");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <fieldset className="article-image-field">
      <legend>{fa ? "تصویر اصلی مقاله" : "Article cover image"}</legend>
      <div className="field">
        <label htmlFor={id}>
          {fa
            ? "بارگذاری عکس (JPG، PNG یا WebP؛ حداکثر ۴ مگابایت)"
            : "Upload JPG, PNG or WebP (max 4 MB)"}
        </label>
        <input
          id={id}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          disabled={busy}
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            setBusy(true);
            setMessage("");
            try {
              if (file.size > 4 * 1024 * 1024)
                throw new Error(
                  fa
                    ? "حجم تصویر بیش از ۴ مگابایت است."
                    : "Image exceeds 4 MB.",
                );
              const r = await fetch("/api/admin/site-images", {
                method: "POST",
                headers: { "Content-Type": file.type },
                body: file,
              });
              const d = await r.json();
              if (!r.ok) throw new Error(d.message);
              setUrl(d.url);
              setMessage(
                fa
                  ? "تصویر آماده است؛ برای اعمال روی مقاله، ذخیره را بزنید."
                  : "Image ready. Save the article to apply it.",
              );
            } catch (error) {
              setMessage((error as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        />
      </div>
      <div className="field">
        <label htmlFor={`${id}-url`}>
          {fa ? "یا نشانی تصویر عمومی" : "Or a public image URL"}
        </label>
        <input
          id={`${id}-url`}
          name="coverImage"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          dir="ltr"
          pattern="(/(images|api/site-images)/[^ ]+|https://[^ ]+)"
        />
      </div>
      {message && <p role="status">{message}</p>}
      {busy && <p role="status">{fa ? "در حال بارگذاری…" : "Uploading…"}</p>}
    </fieldset>
  );
}

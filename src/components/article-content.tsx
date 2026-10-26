import Image from "next/image";
export function articleCover(body: string) {
  const match = body.match(
    /!\[([^\]]*)\]\((\/(?:images|api\/site-images)\/[\w/.-]+|https:\/\/[^\s)]+)\)/,
  );
  return match ? { alt: match[1], src: match[2] } : null;
}
// A deliberately small renderer: text is escaped by React, HTML is never executed.
export function ArticleContent({ body }: { body: string }) {
  return (
    <div className="article-content">
      {body.split(/\n\s*\n/).map((block, i) => {
        const image = articleCover(block);
        if (image && block.startsWith("!["))
          return (
            <Image
              key={i}
              src={image.src}
              alt={image.alt}
              width={1200}
              height={630}
              unoptimized={!image.src.startsWith("/images/")}
              className="article-cover"
            />
          );
        if (block.startsWith("## "))
          return (
            <h2 id={`section-${i}`} key={i}>
              {block.slice(3)}
            </h2>
          );
        if (block.startsWith("### ")) return <h3 key={i}>{block.slice(4)}</h3>;
        if (block.startsWith("- "))
          return (
            <ul key={i}>
              {block.split("\n").map((line, j) => (
                <li key={j}>{line.replace(/^- /, "")}</li>
              ))}
            </ul>
          );
        if (block.startsWith("https://"))
          return (
            <p key={i}>
              <a href={block} target="_blank" rel="noopener noreferrer">
                {block}
              </a>
            </p>
          );
        return <p key={i}>{block}</p>;
      })}
    </div>
  );
}

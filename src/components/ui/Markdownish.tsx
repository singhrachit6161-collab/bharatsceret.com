/**
 * Renders the small subset of Markdown used by policy pages (## headings,
 * paragraphs, "- " lists) as React elements. No raw HTML is rendered.
 */
export function Markdownish({ text }: { text: string }) {
  const blocks = text.replace(/\r\n/g, "\n").split(/\n{2,}/);
  return (
    <div className="prose-store">
      {blocks.map((block, i) => {
        const b = block.trim();
        if (!b) return null;
        if (b.startsWith("## ")) {
          const [heading, ...rest] = b.split("\n");
          return (
            <div key={i}>
              <h2>{heading.slice(3)}</h2>
              {rest.length > 0 && <p>{rest.join(" ")}</p>}
            </div>
          );
        }
        if (b.split("\n").every((l) => l.startsWith("- "))) {
          return (
            <ul key={i}>
              {b.split("\n").map((l, j) => (
                <li key={j}>{l.slice(2)}</li>
              ))}
            </ul>
          );
        }
        return <p key={i}>{b}</p>;
      })}
    </div>
  );
}

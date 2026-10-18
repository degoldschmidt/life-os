const ENTITIES: Record<string, string> = { "&nbsp;": " ", "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'", "&apos;": "'", "&ndash;": "–", "&mdash;": "—", "&hellip;": "…" };

function decode(s: string): string {
  return s
    .replace(/&(?:nbsp|amp|lt|gt|quot|apos|ndash|mdash|hellip|#39);/g, (m) => ENTITIES[m] ?? m)
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)));
}

/**
 * Apple Notes bodies are simple HTML. Convert to Markdown: headings, lists, checklists, bold,
 * italic, links, line breaks. Anything exotic is reduced to its text. Not a general HTML parser.
 */
export function htmlToMarkdown(html: string): string {
  let s = html.replace(/\r\n?/g, "\n");
  s = s.replace(/<!--[\s\S]*?-->/g, "").replace(/<(script|style|head)[\s\S]*?<\/\1>/gi, "");
  s = s.replace(/<img[^>]*>/gi, "");
  s = s.replace(/<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/gi, (_, n, t) => `\n\n${"#".repeat(Number(n))} ${t}\n\n`);
  s = s.replace(/<(b|strong)[^>]*>([\s\S]*?)<\/\1>/gi, "**$2**").replace(/<(i|em)[^>]*>([\s\S]*?)<\/\1>/gi, "*$2*");
  s = s.replace(/<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, (_, href, t) => (t.trim() ? `[${t}](${href})` : href));
  s = s.replace(/<li[^>]*class="[^"]*checked[^"]*"[^>]*>/gi, "\n- [x] ").replace(/<li[^>]*>/gi, "\n- ").replace(/<\/li>/gi, "");
  s = s.replace(/<\/?(ul|ol)[^>]*>/gi, "\n");
  s = s.replace(/<br\s*\/?>/gi, "\n").replace(/<\/(div|p|tr)>/gi, "\n").replace(/<(div|p|tr)[^>]*>/gi, "\n");
  s = s.replace(/<[^>]+>/g, "");
  s = decode(s);
  return s
    .split("\n")
    .map((l) => l.replace(/[ \t]+$/g, ""))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** The note's title: the first Markdown heading or first non-empty line, then the body without it. */
export function splitTitle(markdown: string, fallback: string): { title: string; body: string } {
  const lines = markdown.split("\n");
  const i = lines.findIndex((l) => l.trim());
  if (i === -1) return { title: fallback, body: "" };
  const first = lines[i].replace(/^#{1,6}\s+/, "").replace(/\*\*|\*/g, "").trim();
  if (first.length > 0 && first.length <= 120) return { title: first, body: lines.slice(i + 1).join("\n").trim() };
  return { title: fallback, body: markdown.trim() };
}

/** "12-Grocery list.html" -> "Grocery list". */
export function titleFromFilename(name: string): string {
  return name.replace(/\.[^.]+$/, "").replace(/^\d+[-_\s]+/, "").replace(/[_]+/g, " ").trim() || "Untitled";
}

export function stableId(name: string, text: string): string {
  // Cheap, deterministic id so re-importing the same file updates the note instead of duplicating it.
  let h = 5381;
  const s = `${name}\u0000${text.slice(0, 200)}`;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return `${name}:${(h >>> 0).toString(36)}`;
}

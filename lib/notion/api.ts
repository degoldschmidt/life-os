export type Fetch = (input: string, init?: RequestInit) => Promise<Response>;

const BASE = "https://api.notion.com/v1";
const VERSION = "2022-06-28";

export class NotionError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function call<T>(f: Fetch, token: string, path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const res = await f(`${BASE}${path}`, {
    method: init.method ?? "GET",
    headers: { Authorization: `Bearer ${token}`, "Notion-Version": VERSION, "Content-Type": "application/json" },
    body: init.body ? JSON.stringify(init.body) : undefined,
  });
  const body = (await res.json().catch(() => ({}))) as T & { message?: string };
  if (!res.ok) throw new NotionError(res.status, (body as { message?: string }).message ?? `Notion request failed (${res.status})`);
  return body;
}

type RichText = { plain_text?: string; href?: string | null; annotations?: { bold?: boolean; italic?: boolean; code?: boolean; strikethrough?: boolean } };
export type NotionBlock = {
  id: string;
  type: string;
  has_children?: boolean;
  children?: NotionBlock[];
  [key: string]: unknown;
};

const rich = (rt: RichText[] | undefined): string =>
  (rt ?? [])
    .map((t) => {
      let s = t.plain_text ?? "";
      if (!s) return "";
      if (t.annotations?.code) s = `\`${s}\``;
      if (t.annotations?.bold) s = `**${s}**`;
      if (t.annotations?.italic) s = `*${s}*`;
      if (t.annotations?.strikethrough) s = `~~${s}~~`;
      return t.href ? `[${s}](${t.href})` : s;
    })
    .join("");

/** Notion blocks -> Markdown. Unsupported block types are skipped; nested children are indented. */
export function blocksToMarkdown(blocks: NotionBlock[], depth = 0): string {
  const pad = "  ".repeat(depth);
  const out: string[] = [];
  let n = 0;
  for (const b of blocks) {
    const data = (b[b.type] ?? {}) as { rich_text?: RichText[]; checked?: boolean; language?: string; caption?: RichText[]; url?: string };
    const t = rich(data.rich_text);
    n = b.type === "numbered_list_item" ? n + 1 : 0;
    let line: string | null = null;
    switch (b.type) {
      case "paragraph": line = t ? `${pad}${t}` : ""; break;
      case "heading_1": line = `${pad}# ${t}`; break;
      case "heading_2": line = `${pad}## ${t}`; break;
      case "heading_3": line = `${pad}### ${t}`; break;
      case "bulleted_list_item": line = `${pad}- ${t}`; break;
      case "numbered_list_item": line = `${pad}${n}. ${t}`; break;
      case "to_do": line = `${pad}- [${data.checked ? "x" : " "}] ${t}`; break;
      case "quote": line = `${pad}> ${t}`; break;
      case "callout": line = `${pad}> ${t}`; break;
      case "toggle": line = `${pad}- ${t}`; break;
      case "code": line = `${pad}\`\`\`${data.language ?? ""}\n${(data.rich_text ?? []).map((r) => r.plain_text ?? "").join("")}\n${pad}\`\`\``; break;
      case "divider": line = `${pad}---`; break;
      case "bookmark": case "link_preview": line = data.url ? `${pad}${data.url}` : null; break;
      case "child_page": line = `${pad}[${(b.child_page as { title?: string })?.title ?? "Page"}]`; break;
      default: line = null;
    }
    if (line === null) continue;
    out.push(line);
    if (b.children?.length) out.push(blocksToMarkdown(b.children, depth + 1));
  }
  // Trim blank lines only: leading spaces are the indentation of a nested list.
  return out.join("\n").replace(/\n{3,}/g, "\n\n").replace(/^\n+|\s+$/g, "");
}

type SearchResult = { id: string; object: "page" | "database"; url?: string; last_edited_time?: string; properties?: Record<string, { type: string; title?: RichText[] }>; title?: RichText[] };
export type NotionItem = { id: string; kind: "page" | "database"; title: string; url: string | null; edited: string | null };

export function titleOf(r: SearchResult): string {
  if (r.object === "database") return rich(r.title) || "Untitled database";
  const prop = Object.values(r.properties ?? {}).find((p) => p.type === "title");
  return rich(prop?.title) || "Untitled";
}

/** Pages and databases the integration was shared with. */
export async function searchNotion(f: Fetch, token: string, query = ""): Promise<NotionItem[]> {
  const items: NotionItem[] = [];
  let cursor: string | undefined;
  do {
    const res = await call<{ results: SearchResult[]; has_more: boolean; next_cursor: string | null }>(f, token, "/search", {
      method: "POST",
      body: { query, page_size: 50, sort: { direction: "descending", timestamp: "last_edited_time" }, ...(cursor ? { start_cursor: cursor } : {}) },
    });
    for (const r of res.results) items.push({ id: r.id, kind: r.object, title: titleOf(r), url: r.url ?? null, edited: r.last_edited_time ?? null });
    cursor = res.has_more && res.next_cursor ? res.next_cursor : undefined;
  } while (cursor && items.length < 200);
  return items;
}

async function children(f: Fetch, token: string, blockId: string, depth: number): Promise<NotionBlock[]> {
  const blocks: NotionBlock[] = [];
  let cursor: string | undefined;
  do {
    const q = new URLSearchParams({ page_size: "100", ...(cursor ? { start_cursor: cursor } : {}) });
    const res = await call<{ results: NotionBlock[]; has_more: boolean; next_cursor: string | null }>(f, token, `/blocks/${blockId}/children?${q}`);
    blocks.push(...res.results);
    cursor = res.has_more && res.next_cursor ? res.next_cursor : undefined;
  } while (cursor);
  if (depth < 3) {
    for (const b of blocks) if (b.has_children && b.type !== "child_page" && b.type !== "child_database") b.children = await children(f, token, b.id, depth + 1);
  }
  return blocks;
}

export async function pageMarkdown(f: Fetch, token: string, pageId: string): Promise<{ title: string; markdown: string; url: string | null }> {
  const page = await call<SearchResult>(f, token, `/pages/${pageId}`);
  const blocks = await children(f, token, pageId, 0);
  return { title: titleOf({ ...page, object: "page" }), markdown: blocksToMarkdown(blocks), url: page.url ?? null };
}

/** Titles of every row in a database, newest first. */
export async function databaseTitles(f: Fetch, token: string, databaseId: string, max = 300): Promise<string[]> {
  const titles: string[] = [];
  let cursor: string | undefined;
  do {
    const res = await call<{ results: SearchResult[]; has_more: boolean; next_cursor: string | null }>(f, token, `/databases/${databaseId}/query`, {
      method: "POST",
      body: { page_size: 100, ...(cursor ? { start_cursor: cursor } : {}) },
    });
    for (const r of res.results) {
      const t = titleOf({ ...r, object: "page" }).trim();
      if (t && t !== "Untitled") titles.push(t);
    }
    cursor = res.has_more && res.next_cursor ? res.next_cursor : undefined;
  } while (cursor && titles.length < max);
  return titles.slice(0, max);
}

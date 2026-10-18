"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { htmlToMarkdown, splitTitle, stableId, titleFromFilename } from "@/lib/import/html";
import { databaseTitles, NotionError, pageMarkdown, searchNotion, type NotionItem } from "@/lib/notion/api";
import { upsertNote } from "@/lib/services/notes";
import { createTask, listInbox } from "@/lib/services/tasks";

export type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string };

function notionToken(): string | null {
  return process.env.NOTION_TOKEN ?? null;
}
function notionError(e: unknown): string {
  if (e instanceof NotionError) {
    if (e.status === 401) return "Notion rejected the token. Check NOTION_TOKEN.";
    if (e.status === 404) return "Notion can't see that page. Share it with your integration first.";
    return `Notion said: ${e.message}`;
  }
  console.error("[notion]", e);
  return "Couldn't reach Notion. Try again.";
}

export async function notionStatus(): Promise<boolean> {
  await requireUser();
  return Boolean(notionToken());
}

export async function notionSearch(query: string): Promise<ActionResult<NotionItem[]>> {
  await requireUser();
  const token = notionToken();
  if (!token) return { ok: false, error: "Notion isn't connected. Add NOTION_TOKEN in Vercel." };
  try {
    return { ok: true, data: await searchNotion(fetch, token, z.string().max(100).parse(query)) };
  } catch (e) {
    return { ok: false, error: notionError(e) };
  }
}

/** Import pages as notes. Re-importing refreshes the same note instead of duplicating it. */
export async function importNotionPages(ids: string[]): Promise<ActionResult<{ created: number; updated: number; failed: number }>> {
  const user = await requireUser();
  const token = notionToken();
  if (!token) return { ok: false, error: "Notion isn't connected." };
  const list = z.array(z.string().min(10).max(64)).max(25).parse(ids);
  const r = { created: 0, updated: 0, failed: 0 };
  for (const id of list) {
    try {
      const page = await pageMarkdown(fetch, token, id);
      const out = await upsertNote(user.id, { title: page.title, content: page.url ? `${page.markdown}\n\n[Open in Notion](${page.url})` : page.markdown, source: "notion", externalId: id });
      r[out]++;
    } catch (e) {
      console.error("[notion] page import failed:", id, e);
      r.failed++;
    }
  }
  revalidatePath("/", "layout");
  return { ok: true, data: r };
}

/** A database's rows become Inbox tasks (titles only). Titles you already have open are skipped. */
export async function importNotionDatabaseAsTasks(databaseId: string): Promise<ActionResult<{ added: number; skipped: number }>> {
  const user = await requireUser();
  const token = notionToken();
  if (!token) return { ok: false, error: "Notion isn't connected." };
  try {
    const titles = await databaseTitles(fetch, token, z.string().min(10).max(64).parse(databaseId));
    const have = new Set((await listInbox(user.id)).map((t) => t.title.trim().toLowerCase()));
    let added = 0;
    let skipped = 0;
    for (const t of titles) {
      if (have.has(t.toLowerCase())) { skipped++; continue; }
      await createTask(user.id, { title: t.slice(0, 500) });
      have.add(t.toLowerCase());
      added++;
    }
    revalidatePath("/", "layout");
    return { ok: true, data: { added, skipped } };
  } catch (e) {
    return { ok: false, error: notionError(e) };
  }
}

const file = z.object({ name: z.string().min(1).max(200), text: z.string().max(2_000_000) });

/**
 * Import exported files as notes: Apple Notes HTML, or Markdown and text from anywhere (Obsidian,
 * a folder of .md files). The note title comes from its first heading or line.
 */
export async function importNoteFiles(files: { name: string; text: string }[]): Promise<ActionResult<{ created: number; updated: number; skipped: number }>> {
  const user = await requireUser();
  const list = z.array(file).max(40).parse(files);
  const r = { created: 0, updated: 0, skipped: 0 };
  for (const f of list) {
    const isHtml = /\.html?$/i.test(f.name);
    const md = isHtml ? htmlToMarkdown(f.text) : f.text.replace(/\r\n?/g, "\n").trim();
    if (!md) { r.skipped++; continue; }
    const { title, body } = splitTitle(md, titleFromFilename(f.name));
    const out = await upsertNote(user.id, { title, content: body || md, source: isHtml ? "apple_notes" : "manual", externalId: stableId(f.name, f.text) });
    r[out]++;
  }
  revalidatePath("/", "layout");
  return { ok: true, data: r };
}

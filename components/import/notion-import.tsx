"use client";

import { useState, useTransition } from "react";
import { Label, Mono } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { importNotionDatabaseAsTasks, importNotionPages, notionSearch } from "@/app/actions/import";
import type { NotionItem } from "@/lib/notion/api";

export function NotionImport({ configured }: { configured: boolean }) {
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<NotionItem[] | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (!configured) {
    return (
      <ol className="list-decimal space-y-2 pl-5 text-[14px] text-muted">
        <li>Open notion.so/profile/integrations and create an <strong className="font-normal text-text">internal integration</strong>.</li>
        <li>Copy its token and add it in Vercel as <Mono>NOTION_TOKEN</Mono>, then redeploy.</li>
        <li>In Notion, open each page or database you want, choose ••• → Connections, and add your integration.</li>
      </ol>
    );
  }

  const pages = (items ?? []).filter((i) => i.kind === "page");
  const databases = (items ?? []).filter((i) => i.kind === "database");

  return (
    <div>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => {
            setError(null); setMessage(null);
            const r = await notionSearch(query);
            if (r.ok) { setItems(r.data); setPicked(new Set()); } else setError(r.error);
          });
        }}
      >
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search your Notion (or leave empty)" aria-label="Search Notion" className="min-w-0 flex-1 rounded-[8px] border border-line bg-transparent px-3 py-[9px] text-[14px]" />
        <Button type="submit" disabled={pending}>{pending ? "Searching…" : "Find pages"}</Button>
      </form>
      {error ? <p className="mt-3 text-[13px] text-orange">{error}</p> : null}
      {message ? <p className="mt-3 text-[13px] text-muted">{message}</p> : null}

      {items && items.length === 0 ? <p className="mt-4 text-[14px] text-muted">Nothing found. Share pages with your integration in Notion (••• → Connections).</p> : null}

      {pages.length ? (
        <div className="mt-4">
          <div className="flex items-center justify-between"><Label>Pages · import as notes</Label><Label>{picked.size} selected</Label></div>
          <ul className="mt-2 max-h-[280px] overflow-auto">
            {pages.map((p) => (
              <li key={p.id} className="leader flex items-center gap-3 py-2 text-[14px]">
                <input type="checkbox" checked={picked.has(p.id)} onChange={(e) => setPicked((s) => { const n = new Set(s); if (e.target.checked) n.add(p.id); else n.delete(p.id); return n; })} className="h-4 w-4 accent-[var(--text)]" aria-label={`Select ${p.title}`} />
                <span className="min-w-0 flex-1 truncate">{p.title}</span>
                {p.edited ? <Mono className="text-muted">{p.edited.slice(0, 10)}</Mono> : null}
              </li>
            ))}
          </ul>
          <div className="mt-3">
            <Button
              variant="fill"
              disabled={pending || picked.size === 0}
              onClick={() => start(async () => {
                setError(null);
                const r = await importNotionPages([...picked].slice(0, 25));
                if (r.ok) setMessage(`${r.data.created} created, ${r.data.updated} updated${r.data.failed ? `, ${r.data.failed} failed` : ""}.`);
                else setError(r.error);
              })}
            >
              Import selected (max 25)
            </Button>
          </div>
        </div>
      ) : null}

      {databases.length ? (
        <div className="mt-5">
          <Label>Databases · import rows as Inbox tasks</Label>
          <ul className="mt-2">
            {databases.map((d) => (
              <li key={d.id} className="leader flex items-center gap-3 py-2 text-[14px]">
                <span className="min-w-0 flex-1 truncate">{d.title}</span>
                <Button
                  variant="quiet"
                  disabled={pending}
                  onClick={() => start(async () => {
                    setError(null);
                    const r = await importNotionDatabaseAsTasks(d.id);
                    if (r.ok) setMessage(`${d.title}: ${r.data.added} tasks added, ${r.data.skipped} already there.`);
                    else setError(r.error);
                  })}
                >
                  As tasks
                </Button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

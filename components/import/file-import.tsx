"use client";

import { useRef, useState, useTransition } from "react";
import { Mono } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { importNoteFiles } from "@/app/actions/import";

const BATCH = 25;

/** Upload exported notes (Apple Notes .html, or any .md/.txt). Files are read in the browser and sent in small batches. */
export function FileImport() {
  const input = useRef<HTMLInputElement>(null);
  const [count, setCount] = useState(0);
  const [progress, setProgress] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function run() {
    const files = [...(input.current?.files ?? [])].filter((f) => /\.(html?|md|markdown|txt)$/i.test(f.name));
    if (files.length === 0) { setError("Choose some .html, .md or .txt files first."); return; }
    setError(null); setResult(null);
    start(async () => {
      const total = { created: 0, updated: 0, skipped: 0 };
      for (let i = 0; i < files.length; i += BATCH) {
        setProgress(`${Math.min(i + BATCH, files.length)} of ${files.length}`);
        const batch = await Promise.all(files.slice(i, i + BATCH).map(async (f) => ({ name: f.name, text: await f.text() })));
        const r = await importNoteFiles(batch);
        if (!r.ok) { setError(r.error); setProgress(null); return; }
        total.created += r.data.created; total.updated += r.data.updated; total.skipped += r.data.skipped;
      }
      setProgress(null);
      setResult(`${total.created} notes created, ${total.updated} updated, ${total.skipped} empty skipped.`);
      if (input.current) input.current.value = "";
      setCount(0);
    });
  }

  return (
    <div>
      <input
        ref={input}
        type="file"
        multiple
        accept=".html,.htm,.md,.markdown,.txt"
        aria-label="Choose note files"
        onChange={() => setCount(input.current?.files?.length ?? 0)}
        className="block w-full text-[13px] file:mr-3 file:rounded-full file:border file:border-line file:bg-transparent file:px-4 file:py-2 file:font-mono file:text-[12px] file:uppercase"
      />
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <Button variant="fill" disabled={pending || count === 0} onClick={run}>{pending ? "Importing…" : `Import ${count || ""} files`.trim()}</Button>
        {progress ? <Mono className="text-muted">{progress}</Mono> : null}
      </div>
      {error ? <p className="mt-3 text-[13px] text-orange">{error}</p> : null}
      {result ? <p className="mt-3 text-[13px] text-muted">{result}</p> : null}
    </div>
  );
}

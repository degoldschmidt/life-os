import type { Metadata } from "next";
import { Tile } from "@/components/ui/tile";
import { Label, Mono, Rule } from "@/components/ui/label";
import { NotionImport } from "@/components/import/notion-import";
import { FileImport } from "@/components/import/file-import";

export const metadata: Metadata = { title: "Import" };

export default function ImportPage() {
  return (
    <div className="flex flex-col gap-[14px]">
      <Tile dark className="!py-4">
        <div className="flex flex-wrap items-baseline gap-4">
          <Label>Import</Label>
          <Mono className="text-muted">BRING WHAT YOU ALREADY HAVE</Mono>
        </div>
      </Tile>

      <div className="grid gap-[14px] lg:grid-cols-2">
        <Tile>
          <Label>Notion</Label>
          <Rule dotted />
          <p className="mb-4 text-[14px] text-muted">Pages become notes with their formatting. Databases become Inbox tasks. Importing again refreshes the same note.</p>
          <NotionImport configured={Boolean(process.env.NOTION_TOKEN)} />
        </Tile>

        <Tile>
          <Label>Apple Notes and files</Label>
          <Rule dotted />
          <p className="text-[14px] text-muted">Apple has no import API, so export first, then upload.</p>
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-[14px] text-muted">
            <li><a href="/export-apple-notes.applescript" download className="text-text underline">Download the export script</a> and open it in Script Editor on your Mac.</li>
            <li>Press Run and allow access to Notes. It writes one file per note to <Mono>Desktop/AppleNotesExport</Mono>.</li>
            <li>Upload those files here. Markdown and text files from Obsidian or any folder work too.</li>
          </ol>
          <div className="mt-4"><FileImport /></div>
        </Tile>
      </div>
    </div>
  );
}

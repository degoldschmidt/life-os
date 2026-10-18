"use client";

import { useTransition } from "react";
import { deleteEntry } from "@/app/actions/journal";

export function DeleteEntry({ id }: { id: string }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => start(() => deleteEntry(id))}
      aria-label="Delete entry"
      className="label text-muted hover:text-text disabled:opacity-40"
    >
      Delete
    </button>
  );
}

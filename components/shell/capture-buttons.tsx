"use client";

import { useCapture } from "@/components/capture/capture-provider";

export function CaptureButton({ fab = false }: { fab?: boolean }) {
  const { openCapture } = useCapture();
  if (fab) {
    return (
      <button
        type="button"
        aria-label="Capture"
        onClick={openCapture}
        className="fixed bottom-[88px] right-[18px] z-20 flex h-[52px] w-[52px] items-center justify-center rounded-full bg-ink text-[26px] font-extralight text-on-ink md:hidden"
      >
        +
      </button>
    );
  }
  return (
    <button type="button" onClick={openCapture} className="mt-3 flex w-full items-center justify-between text-[13px] text-muted hover:text-text">
      <span>Capture</span>
      <span className="mono text-muted">C</span>
    </button>
  );
}

export function SearchButton() {
  const { openPalette } = useCapture();
  return (
    <button type="button" onClick={openPalette} className="mt-3 flex w-full items-center justify-between text-[13px] text-muted hover:text-text">
      <span>Search</span>
      <span className="mono text-muted">⌘K</span>
    </button>
  );
}

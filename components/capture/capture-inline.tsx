"use client";

import { useCapture } from "./capture-provider";

export function CaptureButtonInline() {
  const { openCapture } = useCapture();
  return (
    <button
      type="button"
      onClick={openCapture}
      className="inline-flex items-center gap-2 rounded-full border-[1.2px] border-text px-[18px] py-[9px] font-mono text-[12px] uppercase leading-none tracking-[0.04em] active:opacity-70"
    >
      + Capture <span className="text-muted">C</span>
    </button>
  );
}

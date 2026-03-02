"use client";

import { useState } from "react";
import { clsx } from "clsx";

interface Props {
  text: string;
  label?: string;
  className?: string;
  variant?: "default" | "premium";
}

export default function CopyButton({ text, label = "Copy", className, variant = "default" }: Props) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const el = document.createElement("textarea");
      el.value = text;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <button
      onClick={handleCopy}
      className={clsx(
        "inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition-all",
        variant === "premium"
          ? copied
            ? "bg-green-600 text-white"
            : "bg-purple text-white hover:shadow-purple-sm"
          : copied
          ? "bg-green-500/20 text-green-400 border border-green-500/20"
          : "border border-[rgba(255,255,255,0.1)] bg-ink-4 text-t2 hover:text-t1 hover:border-[rgba(255,255,255,0.18)]",
        className
      )}
    >
      {copied ? "✓ Copied" : `⌘ ${label}`}
    </button>
  );
}

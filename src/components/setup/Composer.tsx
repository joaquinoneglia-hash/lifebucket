"use client";

import { ArrowUp, Mic, Square } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/format";
import { useDictation } from "@/lib/hooks";

/** Escribir o dictar: el micrófono transcribe en vivo y Enter envía. */
export function Composer({
  onSend,
  placeholder,
  busy,
  autoFocus,
}: {
  onSend: (text: string) => void;
  placeholder: string;
  busy?: boolean;
  autoFocus?: boolean;
}) {
  const [text, setText] = useState("");
  const dictation = useDictation(setText);
  const send = () => {
    const clean = text.trim();
    if (!clean || busy) return;
    dictation.stop();
    setText("");
    onSend(clean);
  };

  return (
    <div className="flex flex-col gap-1">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
        className="flex items-end gap-1.5 rounded-2xl border border-line bg-surface p-1.5 shadow-[var(--shadow-card)] focus-within:border-ink"
      >
        <textarea
          rows={1}
          value={text}
          autoFocus={autoFocus}
          data-autofocus={autoFocus || undefined}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          placeholder={dictation.listening ? "Te escucho…" : placeholder}
          aria-label="Tu respuesta"
          className="max-h-28 min-h-9 flex-1 resize-none bg-transparent px-2 py-2 text-[14px] leading-snug placeholder:text-ink-muted/80 focus:outline-none"
        />
        {dictation.supported && (
          <button
            type="button"
            onClick={dictation.listening ? dictation.stop : dictation.start}
            aria-label={dictation.listening ? "Dejar de dictar" : "Dictar"}
            aria-pressed={dictation.listening}
            className={cn(
              "pressable grid size-9 shrink-0 place-items-center rounded-full",
              dictation.listening ? "bg-ink text-surface" : "text-ink-muted hover:bg-surface-sunken hover:text-ink",
            )}
          >
            {dictation.listening ? <Square aria-hidden className="size-3.5" /> : <Mic aria-hidden className="size-4" />}
          </button>
        )}
        <button
          type="submit"
          disabled={!text.trim() || busy}
          aria-label="Enviar"
          className="pressable grid size-9 shrink-0 place-items-center rounded-full bg-ink text-surface disabled:opacity-30"
        >
          <ArrowUp aria-hidden className="size-4" />
        </button>
      </form>
      {dictation.error && <p className="px-2 text-[12px] text-ink-muted">{dictation.error}</p>}
    </div>
  );
}

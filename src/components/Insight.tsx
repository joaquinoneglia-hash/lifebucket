import { Lightbulb } from "lucide-react";
import { cn } from "@/lib/format";

/**
 * Los "cositos" de la configuración: una frase corta que te hace caer la ficha de
 * en qué se te va el tiempo. Cambia con lo que hacés (por eso anima al cambiar de texto).
 */
export function Insight({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <p
      key={String(children)}
      role="status"
      className={cn(
        "animate-fade-up flex gap-2.5 rounded-xl bg-[linear-gradient(120deg,#eef3fd,#f5effc_55%,#fcf0f5)] px-3.5 py-3 text-[13px] leading-snug text-ink",
        className,
      )}
    >
      <Lightbulb aria-hidden className="mt-px size-4 shrink-0 text-ink-muted" strokeWidth={1.75} />
      <span>{children}</span>
    </p>
  );
}

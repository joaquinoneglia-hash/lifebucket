"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/format";

type Mark = { id: string; label: string; top: number };

/**
 * Barra para moverse en el celular: una línea fina a la derecha con un indicador que se arrastra con el dedo
 * (el calendario no scrollea con el dedo). Cada sección tiene su puntito; mientras arrastrás, aparece el nombre
 * de la sección en la que estás.
 */
export function ScrollRail({ labels }: { labels: Record<string, string> }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [m, setM] = useState({ track: 0, thumb: 0, top: 0, max: 0, marks: [] as Mark[] });
  const [grab, setGrab] = useState<{ offset: number } | null>(null);
  const [awake, setAwake] = useState(false);
  const sleepTimer = useRef(0);

  // Medir: alto del riel, tamaño y lugar del indicador, y dónde empieza cada sección.
  useEffect(() => {
    let frame = 0;
    const measure = () => {
      frame = 0;
      const track = trackRef.current?.clientHeight ?? 0;
      const doc = document.documentElement.scrollHeight;
      const view = window.innerHeight;
      const max = Math.max(0, doc - view);
      const thumb = max ? Math.max(36, (track * view) / doc) : track;
      const top = max ? ((track - thumb) * window.scrollY) / max : 0;
      const marks = [...document.querySelectorAll<HTMLElement>("[data-section]")].map((el) => {
        const y = Math.min(max, Math.max(0, el.getBoundingClientRect().top + window.scrollY - 12));
        const id = el.dataset.section!;
        return { id, label: labels[id] ?? id, top: max ? ((track - thumb) * y) / max + thumb / 2 : 0 };
      });
      setM({ track, thumb, top, max, marks });
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };
    const wake = () => {
      setAwake(true);
      window.clearTimeout(sleepTimer.current);
      sleepTimer.current = window.setTimeout(() => setAwake(false), 1200);
    };
    const onScroll = () => {
      schedule();
      wake();
    };
    measure();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", schedule);
    const ro = new ResizeObserver(schedule);
    ro.observe(document.body);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", schedule);
      ro.disconnect();
      window.clearTimeout(sleepTimer.current);
    };
  }, [labels]);

  if (!m.max) return null;

  /** Llevar la página a donde quedaría el indicador con su borde de arriba en `y` (px dentro del riel). */
  const scrollToThumb = (y: number, smooth = false) => {
    const ratio = Math.min(1, Math.max(0, y / Math.max(1, m.track - m.thumb)));
    window.scrollTo({ top: ratio * m.max, behavior: smooth ? "smooth" : "instant" });
  };
  const localY = (clientY: number) => clientY - (trackRef.current?.getBoundingClientRect().top ?? 0);
  const current = [...m.marks].reverse().find((k) => k.top <= m.top + m.thumb / 2 + 1) ?? m.marks[0];

  return (
    <div
      role="scrollbar"
      aria-label="Moverse por la página"
      aria-controls="contenido"
      aria-orientation="vertical"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={m.max ? Math.round((m.top / Math.max(1, m.track - m.thumb)) * 100) : 0}
      className="fixed top-[16vh] right-0 bottom-[16vh] z-30 w-6 touch-none select-none"
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture?.(e.pointerId);
        const y = localY(e.clientY);
        const onThumb = y >= m.top - 8 && y <= m.top + m.thumb + 8;
        if (onThumb) {
          setGrab({ offset: y - m.top });
          return;
        }
        // Tocar el riel: si es cerca de una sección, ir a esa sección; si no, a ese punto.
        const near = m.marks.find((k) => Math.abs(k.top - y) < 14);
        setGrab({ offset: m.thumb / 2 });
        scrollToThumb((near ? near.top : y) - m.thumb / 2, true);
      }}
      onPointerMove={(e) => grab && scrollToThumb(localY(e.clientY) - grab.offset)}
      onPointerUp={() => setGrab(null)}
      onPointerCancel={() => setGrab(null)}
    >
      <div ref={trackRef} className="absolute inset-y-0 right-1.5 w-[3px] rounded-full bg-ink/10">
        {m.marks.map((k) => (
          <span key={k.id} aria-hidden className="absolute left-1/2 size-[7px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-surface ring-1 ring-ink/25" style={{ top: k.top }} />
        ))}
        <span
          aria-hidden
          className={cn(
            "absolute left-1/2 -translate-x-1/2 rounded-full transition-[width,background-color] duration-150",
            grab ? "w-[7px] bg-ink/75" : awake ? "w-[5px] bg-ink/55" : "w-[5px] bg-ink/35",
          )}
          style={{ top: m.top, height: m.thumb }}
        />
        {grab && current && (
          <span
            aria-hidden
            className="absolute right-4 -translate-y-1/2 rounded-full bg-ink px-2.5 py-1 text-[12px] font-medium whitespace-nowrap text-surface shadow-[var(--shadow-popover)]"
            style={{ top: m.top + m.thumb / 2 }}
          >
            {current.label}
          </span>
        )}
      </div>
    </div>
  );
}

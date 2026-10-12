"use client";

import { create } from "zustand";
import { usePlanner } from "./store";
import { supabaseBrowser } from "./supabase/client";

/**
 * Los datos de cada persona en la nube (Supabase, tabla `datos`). El navegador queda como copia rápida:
 * al entrar se trae lo de la nube, cada cambio se guarda solo a los pocos segundos y, sin conexión, se
 * sigue usando la app y se sube cuando vuelve.
 */

export type SyncStatus = "idle" | "loading" | "saving" | "saved" | "offline" | "error";
export const useSync = create<{ status: SyncStatus; at: number | null }>(() => ({ status: "idle", at: null }));
const setStatus = (status: SyncStatus) => useSync.setState({ status, ...(status === "saved" ? { at: Date.now() } : {}) });

const META_KEY = "lb:sync";
const STORE_VERSION = 5;
const SAVE_DELAY = 1500;

/** A quién pertenecen los datos de este navegador y si quedó algo sin subir. */
type Meta = { userId: string; dirty: boolean };
const readMeta = (): Meta | null => {
  try {
    return JSON.parse(localStorage.getItem(META_KEY) ?? "null");
  } catch {
    return null;
  }
};
const writeMeta = (m: Meta) => {
  try {
    localStorage.setItem(META_KEY, JSON.stringify(m));
  } catch {}
};

/** El estado que se guarda: todos los datos del store (sin las funciones). */
const snapshot = () => Object.fromEntries(Object.entries(usePlanner.getState()).filter(([, v]) => typeof v !== "function"));
/** ¿Hay algo cargado? (para no subir una app vacía encima de datos de la nube). */
const hasData = (s: Record<string, unknown>) =>
  ["routine", "moments", "tasks", "blocks"].some((k) => Array.isArray(s[k]) && (s[k] as unknown[]).length > 0);

/** Cuánto hay cargado (bloques, momentos y objetivos). */
const amount = (s: Record<string, unknown>) => ["routine", "moments", "tasks"].reduce((acc, k) => acc + (Array.isArray(s[k]) ? (s[k] as unknown[]).length : 0), 0);

let current: { userId: string; stop: () => void; flush: () => Promise<void> } | null = null;

const waitHydration = () =>
  new Promise<void>((resolve) => {
    if (usePlanner.persist.hasHydrated()) return resolve();
    const off = usePlanner.persist.onFinishHydration(() => {
      off();
      resolve();
    });
  });

/** Empieza a sincronizar los datos de esta persona (una sola vez por sesión). */
export async function startCloudSync(userId: string) {
  if (current?.userId === userId) return;
  current?.stop();
  const db = supabaseBrowser();
  let applying = false;
  let timer = 0;
  let ready = false;
  let stopped = false;

  const push = async () => {
    window.clearTimeout(timer);
    if (!ready || stopped) return;
    if (!navigator.onLine) return setStatus("offline");
    setStatus("saving");
    const { error } = await db.from("datos").upsert({ usuario_id: userId, estado: snapshot(), version: STORE_VERSION, actualizado: new Date().toISOString() });
    if (error) {
      setStatus(navigator.onLine ? "error" : "offline");
      return;
    }
    writeMeta({ userId, dirty: false });
    setStatus("saved");
  };
  const schedule = () => {
    window.clearTimeout(timer);
    timer = window.setTimeout(push, SAVE_DELAY);
  };

  // Cada cambio se marca como pendiente y se sube unos segundos después.
  const unsubscribe = usePlanner.subscribe(() => {
    if (applying || !ready) return;
    writeMeta({ userId, dirty: true });
    schedule();
  });
  const onOnline = () => readMeta()?.dirty && push();
  const onHide = () => document.visibilityState === "hidden" && readMeta()?.dirty && void push();
  window.addEventListener("online", onOnline);
  document.addEventListener("visibilitychange", onHide);

  current = {
    userId,
    flush: push,
    stop: () => {
      stopped = true;
      window.clearTimeout(timer);
      unsubscribe();
      window.removeEventListener("online", onOnline);
      document.removeEventListener("visibilitychange", onHide);
    },
  };

  // Primera carga: decidir si manda la nube o lo que hay en este navegador.
  await waitHydration();
  setStatus("loading");
  const { data: row, error } = await db.from("datos").select("estado, version").eq("usuario_id", userId).maybeSingle();
  if (stopped) return;
  if (error) {
    // Sin conexión o sin la tabla todavía: se sigue con lo local y se reintenta al volver la conexión.
    setStatus(navigator.onLine ? "error" : "offline");
    ready = true;
    return;
  }

  const meta = readMeta();
  const local = snapshot();
  const localIsMine = !meta || meta.userId === userId; // sin marca: datos de antes de la nube (se asumen propios)
  // Cambios de este navegador que no llegaron a la nube. Si son de antes de la nube (sin marca) y la nube ya
  // tiene datos de otro dispositivo, gana la copia con más cosas cargadas.
  const localPending =
    localIsMine && hasData(local) && (meta ? meta.dirty : !row || amount(local) > amount((row?.estado ?? {}) as Record<string, unknown>));

  if (row && !localPending) {
    // Manda la nube (otro dispositivo o la última copia buena).
    applying = true;
    usePlanner.setState(row.estado as Partial<ReturnType<typeof usePlanner.getState>>);
    applying = false;
    writeMeta({ userId, dirty: false });
    ready = true;
    setStatus("saved");
    return;
  }
  if (!localIsMine) {
    // Los datos de este navegador son de otra cuenta: se arranca de cero (no se suben).
    applying = true;
    usePlanner.setState({ routine: [], moments: [], tasks: [], routineHistory: [], weekSeen: "" } as Partial<ReturnType<typeof usePlanner.getState>>);
    applying = false;
  }
  // No hay nada en la nube (o hay cambios sin subir de este navegador): se sube lo de acá.
  ready = true;
  await push();
}

/** Sube lo pendiente ya (antes de salir de la cuenta). */
export async function flushCloud() {
  await current?.flush();
}

/** Al salir: se corta la sincronización y se borran los datos de este navegador (quedan en la nube). */
export function stopCloudSync(clearLocal: boolean) {
  current?.stop();
  current = null;
  if (!clearLocal) return;
  try {
    localStorage.removeItem("lifebucket:v1");
    localStorage.removeItem(META_KEY);
  } catch {}
}

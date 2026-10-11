"use client";

import { useEffect, useState } from "react";
import { supabaseBrowser } from "./client";
import { authConfigured } from "./config";

export type Who = { id: string; email: string; name?: string; avatar?: string };

/** Sin login configurado (solo en desarrollo) se usa un usuario local. */
const LOCAL: Who = { id: "local", email: "" };

/** El usuario logueado: `undefined` mientras carga. */
export function useUser(): Who | undefined {
  const [who, setWho] = useState<Who | undefined>(authConfigured ? undefined : LOCAL);
  useEffect(() => {
    if (!authConfigured) return;
    let alive = true;
    supabaseBrowser()
      .auth.getUser()
      .then(({ data }) => {
        const u = data.user;
        if (!alive || !u) return;
        setWho({
          id: u.id,
          email: u.email ?? "",
          name: u.user_metadata?.full_name ?? u.user_metadata?.name,
          avatar: u.user_metadata?.avatar_url ?? u.user_metadata?.picture,
        });
      });
    return () => {
      alive = false;
    };
  }, []);
  return who;
}

/** El primer nombre, si lo hay ("Joaquín Oneglia" → "Joaquín"). */
export const firstName = (who?: Who) => who?.name?.trim().split(/\s+/)[0];

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { StepsApp } from "@/components/steps/StepsApp";
import { isBetaUser } from "@/lib/beta";

export const metadata: Metadata = { title: "LifeBucket · en pasos", robots: { index: false } };
export const dynamic = "force-dynamic";

/** La versión en pasos (formulario guiado). Oculta: solo la ven las cuentas de prueba; el resto vuelve a la app. */
export default async function StepsPage() {
  if (!(await isBetaUser())) redirect("/");
  return <StepsApp />;
}

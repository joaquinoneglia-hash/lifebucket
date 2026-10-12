import { NextResponse } from "next/server";
import { isBetaUser } from "@/lib/beta";

/** Si la persona logueada ve las versiones de prueba (para mostrar el acceso en su menú). */
export async function GET() {
  return NextResponse.json({ beta: await isBetaUser() });
}

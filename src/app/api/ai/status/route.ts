import { NextResponse } from "next/server";

/** Si el servidor tiene credenciales de Claude. Así la app no hace llamadas que van a fallar. */
export function GET() {
  const enabled = Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
  return NextResponse.json({ enabled });
}

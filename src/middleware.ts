import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { authConfigured, SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/supabase/config";

/** Páginas que se ven sin sesión. */
const PUBLIC = ["/login", "/auth"];

/**
 * El login es obligatorio: sin sesión, todo redirige a /login (y las rutas /api responden 401).
 * También renueva la sesión en cada pedido.
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isPublic = PUBLIC.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  if (!authConfigured) {
    // En desarrollo, sin Supabase configurado, la app abre igual. En producción queda cerrada.
    if (process.env.NODE_ENV !== "production" || isPublic) return NextResponse.next();
    return redirectToLogin(request);
  }

  let response = NextResponse.next({ request });
  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list) => {
        for (const { name, value } of list) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of list) response.cookies.set(name, value, options);
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && !isPublic) {
    if (pathname.startsWith("/api/")) return NextResponse.json({ error: "Tenés que entrar con tu cuenta." }, { status: 401 });
    return redirectToLogin(request);
  }
  if (user && pathname === "/login") return NextResponse.redirect(new URL("/", request.url));
  return response;
}

function redirectToLogin(request: NextRequest) {
  const url = request.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};

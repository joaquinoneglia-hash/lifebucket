# LifeBucket

Planificador de balance de vida. Tu vida es un balde de horas por semana y la app te muestra con qué lo estás llenando: Sueño, Trabajo, Cuerpo, Mente, Disfrute, Vínculos y Libre. Producto y decisiones de fondo en `PRODUCT.md`; sistema visual en `DESIGN.md`.

Hoy la app corre en **modo simple** (`SIMPLE_MODE` en `src/lib/mode.ts`): una sola pantalla con la semana tipo (lunes a domingo, 05:00–24:00, sin fechas), Momentos (Vínculos y Disfrute del mes), Resultados y Objetivos del año. El resto (onboarding, planner por fechas, asistentes con IA) sigue en el código pero oculto.

## Principios de producto

- No es una agenda detallada: bloques generales de la semana, que se arrastran y se ajustan.
- Cargar y marcar tiene que ser muy rápido. Si no es rápido, la gente abandona: es la regla de diseño más importante.
- Uso parejo en celular y compu: todo tiene que funcionar bien en mobile.
- Estética limpia y estándar, tipo app moderna.

## Stack

- Next.js 15 (App Router) + React 19 + TypeScript
- Tailwind CSS v4
- `zustand` con persistencia en `localStorage` (clave `lifebucket:v1`; migra sola desde la vieja `lifeplan:v1`). Supabase es el paso siguiente.
- `@dnd-kit/core`, `lucide-react`, `zod`
- IA: `@anthropic-ai/sdk` (Claude) en rutas de servidor; voz con ElevenLabs (`/api/tts`) y respaldo en la voz del navegador.

## Correr en local

```bash
npm install
cp .env.example .env.local   # completar las claves (opcional: sin claves la app funciona, sin IA ni voz de ElevenLabs)
npm run dev                  # http://localhost:3000
```

Chequeos antes de dar algo por terminado: `npx tsc --noEmit` y `npm run lint`.

Cuentas: login obligatorio con Supabase Auth (Google o email y contraseña). `src/middleware.ts` cierra todo sin sesión (en desarrollo sin Supabase configurado abre igual); pantalla en `src/app/login/`, vuelta de Google en `src/app/auth/callback/`, clientes en `src/lib/supabase/`. Cada ingreso queda en las tablas `usuarios` e `ingresos` (SQL en `supabase/migrations/`). Publicada en Vercel desde `main`: https://lifebucket-kappa.vercel.app (Supabase → URL Configuration tiene ese dominio y `http://localhost:3000/**` como redirects).

Asistente de la semana (botón flotante): `src/components/AssistantFab.tsx` → `src/app/api/week-ai/route.ts` (Claude Sonnet 5.5, salida estructurada) → cambios aplicados con `src/lib/week-ai.ts`. Propone y el usuario confirma.

Claves (solo en `.env.local` y en Vercel, nunca en el repo): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `ANTHROPIC_API_KEY`, `ELEVENLABS_API_KEY`. Sin clave, las rutas de IA responden 503 con un mensaje claro. Para probar la UI sin clave, interceptar `/api/assistant` en Playwright.

## Estructura

```
src/
  app/
    page.tsx, layout.tsx, globals.css   página única, metadata, tokens de color y fondo
    api/                                assistant, missions, setup, targets, ai (Claude) y tts (ElevenLabs)
  components/
    SimpleApp.tsx        la app actual: secciones plegables y reordenables, % del encabezado, semana nueva
    MomentsPanel.tsx     Momentos (Vínculos y Disfrute del mes)
    Dashboard.tsx        Resultados (torta, sueño, carga por día, semana a semana, objetivos)
    TasksPanel.tsx       Objetivos del año por mes
    SleepMeter.tsx       sueño en el encabezado y en Resultados
    setup/               calendario de semana tipo (WeekTemplateGrid), editor de bloques y el arranque viejo
    Planner.tsx, Onboarding.tsx, …   modo completo (oculto)
  lib/
    store.ts             estado y persistencia
    mode.ts              modo simple y sus categorías
    routine.ts           semana tipo: bloques, carve() para partir bloques
    week-shares.ts       % de la semana por parte
    bonds.ts             horas de Vínculos y Disfrute a partir de los Momentos
    sleep-stats.ts       métricas de sueño
    sfx.ts               sonidos (Web Audio)
    speech.ts, voice-config.ts   voz
    report.ts, balance.ts, sleep.ts, missions.ts, coach.ts   lógica del modo completo
docs/
  decisiones.md          registro de decisiones
PRODUCT.md, DESIGN.md
```

Modelo: los % son sobre la semana entera (168 h). El Sueño es una categoría más (sale del horario de sueño, `weekMinutes()` en `src/lib/week-shares.ts`); el resto del tiempo despierto sin bloques es Libre. Para medir un período en el modo completo usar `periodBlocks()` de `src/lib/report.ts`, no `inPeriod()`.

## Reglas de trabajo

- **Idioma:** todo en español rioplatense (interfaz, textos, comentarios, docs y respuestas).
- **Decisiones:** cada decisión de producto, diseño o técnica se registra en `docs/decisiones.md` con fecha (AAAA-MM-DD), qué se decidió y por qué.
- **Cambios grandes:** antes de un cambio grande (nueva sección, cambio de modelo de datos, refactor, dependencia nueva) proponé un plan corto y esperá el OK.
- **Claves:** nunca subir claves ni secretos; van en `.env.local`, que está en `.gitignore`.
- **Diseño:** para trabajo de UI, usar los skills de diseño instalados (impeccable, emil-design-eng, etc.) y respetar `DESIGN.md`.

## Autorevisión obligatoria

Después de cada cambio que afecte la interfaz:
- Levantá la app si no está corriendo.
- Con Playwright, abrí la pantalla modificada y sacá capturas en desktop (1440px) y mobile (390px).
- Revisá las capturas contra DESIGN.md: colores, tipografía, espaciados, estados.
- Revisá la consola del navegador: cero errores.
- Si encontrás problemas, corregilos en una sola tanda y verificá una vez más. No entres en loops de pulido infinitos.
- Recién ahí decime que terminaste, con un resumen corto de qué revisaste y qué corregiste.

Antes de dar por terminada cualquier tarea de código, verificá que funciona de verdad (que compila, que corre, que hace lo que pedí). Nunca digas "listo" sin haberlo comprobado.

# Decisiones

Registro de decisiones de producto, diseño y técnicas. Una entrada por decisión, la más nueva arriba: fecha, qué se decidió y por qué.

## 2026-10-11 · Tacho, Momentos simplificado y objetivos por año

- Arrastrar un bloque muestra un tacho abajo de la pantalla; soltarlo ahí pregunta qué eliminar. Los botones dicen qué pasa: "Solo este evento (lunes)" / "Eliminar todos los eventos" (o "Eliminar evento" si no se repite).
- Momentos: una sola lista del mes, mezclada (Vínculos y Disfrute con su color), con el total de horas de cada parte arriba. Agregar va aparte, abajo: escribís qué fue, el tipo se sugiere solo y elegís cuánto duró. Antes había dos grupos con su campo y su "+" cada uno y confundía.
- Objetivos: cada año es un grupo que se comprime (el actual y el que viene siempre; los demás si tienen objetivos). Se agregan en la misma línea (escribir, fecha opcional, Enter o "+"), sin otra pantalla; tocar uno lo abre para editarlo.
- Resultados: el resumen de objetivos es "X de Y propuestos cumplidos" con una barra (cumplidos, no cumplidos, en camino) en lugar de las barras por mes.

## 2026-10-11 · Pestañas en el celular y categoría sugerida

- En el celular (menos de 1024 px) cada sección es una pestaña con una barra abajo (Semana, Momentos, Objetivos, Resultados). La Semana entra entera en la pantalla y no hace falta scrollear; por eso se sacó la barra lateral para moverse y, en el celular, comprimir y reordenar secciones. En la compu sigue todo en una pantalla.
- Al sumar un bloque primero va "¿Qué es?" y la categoría se sugiere sola (palabras conocidas y tus propios bloques, `src/lib/categorize.ts`); si la elegís a mano, se respeta.
- Objetivos: el tipo se ve en cada uno y se sugiere solo; la fecha es opcional ("Sin fecha"); se ordenan por fecha. Se editan (y se pasan a otro mes) en una hoja.
- "Sueño" pasa a "Configuración del sueño".
- La app queda fija (`<ScrollLock />`): sin scroll de página, rebote, "tirar para recargar" ni zoom. Solo se desliza el contenido de adentro de una tarjeta u hoja cuando no entra.

## 2026-10-11 · Bienvenida, guía y ajustes para el celular

- Bienvenida una vez por cuenta (nombre de Google, intro sonora sintetizada) y guía de 10 consejos que resalta cada parte; se puede volver a ver desde el menú de la cuenta.
- En pantallas táctiles la grilla imita a la web: tocar crea (1 h) o abre; arrastrar marca un horario, mueve o estira. Dentro del calendario el dedo no scrollea (touch-action: none); se scrollea desde la columna de horas o fuera del calendario. Fuera del calendario se scrollea y se recarga normal.
- La página fija `maximum-scale=1`: en iPhone Safari quedaba con zoom después de tocar un campo y las hojas se veían cortadas.
- En pantallas táctiles los campos de texto van a 16 px como mínimo (con menos, el iPhone hace zoom y corta la pantalla) y las hojas no enfocan un campo solas (el teclado tapaba media hoja).
- En la compu las secciones se comprimen tocando su encabezado.
- Sin zoom: ni con dos dedos ni con doble toque (viewport + touch-action + gestos de Safari frenados en <NoZoom />).
- El sueño lleva una lunita para que se entienda que ese horario es dormir.
- Momentos: tachito siempre visible y la tarjeta se edita al tocarla.
- Orden por defecto: Semana, Momentos, Objetivos, Resultados.
- En el celular: LIFEBUCKET centrado arriba y los % de cada parte en una grilla que se toca para ver el detalle.

## 2026-10-11 · Login obligatorio y registro de ingresos

- Para usar la app hay que entrar con Google o con email y contraseña. Se usa Supabase Auth (ya estaba previsto como siguiente paso).
- Cada cuenta nueva queda en la tabla `usuarios` y cada entrada en `ingresos` (fecha, con qué entró, navegador). Se mira desde el panel de Supabase (vista `ingresos_detalle`). El SQL está en `supabase/migrations/`.
- Sin Supabase configurado: en desarrollo la app abre igual; en producción todo redirige a /login.
- Los datos de la semana siguen en el navegador por ahora; pasarlos a la nube por usuario es el paso siguiente.
- Publicación en Vercel, conectada a `main` en GitHub: https://lifebucket-kappa.vercel.app. Se apagó la "Vercel Authentication" para que el sitio sea público (lo protege el login propio).

## 2026-10-11 · El proyecto pasa a llamarse LifeBucket

- Se renombra "Lifeplan" a LifeBucket: `package.json`, `package-lock.json` y la configuración de preview (`.claude/launch.json`).
- La clave de guardado en el navegador pasa de `lifeplan:v1` a `lifebucket:v1`. Al cargar, si existe la vieja y no la nueva, se copian los datos (la vieja queda como respaldo). Así nadie pierde su semana.
- La carpeta local del proyecto sigue llamándose `lifeplan`: renombrarla no es necesario para el repo y rompía la sesión de trabajo. Se puede cambiar a mano cuando convenga.
- En los textos se mantiene "LifeBucket" (con B mayúscula), igual que en el logo.

## 2026-10-11 · Modo simple como primera pantalla

- La app arranca directo en la semana tipo (lunes a domingo, 05:00–24:00, sin fechas), con Momentos, Resultados y Objetivos en la misma pantalla. El onboarding y el planner por fechas quedan ocultos en el código.
- Por qué: el armado guiado era demasiado largo; la semana en bloques se entiende de un vistazo.

## 2026-10-11 · Categorías

- Trabajo, Cuerpo, Mente, Disfrute (antes "Alma"), Libre y Vínculos. Vínculos no va en el calendario: se carga con Momentos del mes y se pasa a horas por semana con pesos fijos (amor 3 h, familia 3 h, amigos 2,5 h).
- Libre es lo no agendado más los bloques marcados como libre (almuerzo, descanso).

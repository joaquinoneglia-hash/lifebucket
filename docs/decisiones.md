# Decisiones

Registro de decisiones de producto, diseño y técnicas. Una entrada por decisión, la más nueva arriba: fecha, qué se decidió y por qué.

## 2026-10-12 · La barra de arriba en tres grupos

- En vez de siete porcentajes sueltos, una barra con la semana entera (168 h) que se va llenando: Trabajo (rojo) y Cuerpo, Mente y Alma (tres colores). Lo que queda es el espacio libre (Libre y Sueño, rayado como en el calendario).
- Alma junta Disfrute y Vínculos (lo que disfrutás y tu gente) en esta vista. Debajo, tres resúmenes con su %; tocando o pasando el mouse, el detalle de cada parte.

## 2026-10-11 · Versión en pasos (beta, oculta)

- Prueba de un formato tipo formulario/encuesta, en `/pasos`, que solo ven las cuentas de `BETA_EMAILS` (por defecto, la de Joaco; el chequeo es en el servidor, `src/lib/beta.ts`). La app actual no cambia; el acceso aparece en el menú de la cuenta solo para esas cuentas.
- Pasos: intro → sueño (semana y finde) → la semana categoría por categoría (Trabajo, Cuerpo, Mente, Disfrute, comidas/traslados/descanso) → huecos sin asignar (se agrupan los que se repiten; se asignan o se dejan libres) → "Así es tu vida hoy" (barras contra una persona promedio, lo que más tiempo lleva, informe con recomendaciones) → "¿Te pone contento?" → mejorar.
- Mejorar: metas en horas por semana (+1/+2/+3/+5 h), no en porcentajes; la app propone dónde ponerlas (primero en huecos, en la franja que mejor le queda a cada cosa; si no, sobre bloques de Libre) y muestra antes y después.
- Trabaja sobre una copia aparte (`lifebucket:pasos:v1`); al final se puede pasar la semana (y el sueño) a la app, con confirmación.

## 2026-10-11 · El sueño es una categoría

- Los porcentajes pasan a ser sobre la semana entera (168 h) y el Sueño es una categoría más, con su color (chips de arriba, torta de Resultados, semana a semana). Antes se calculaba sobre las 133 h de 05:00 a 24:00 sin sueño, y las horas dormidas dentro de esa franja (por ejemplo, de 5 a 7) se contaban como Libre por error.
- El botón de arriba dice siempre "Configurar horarios de sueño" (las horas por noche se ven en el chip de Sueño y al pasar el mouse).
- En el celular el sonido se activa y silencia desde el menú de la cuenta (en el encabezado no entraba).
- Las semanas guardadas antes de este cambio quedan con sus porcentajes viejos (sin Sueño).

## 2026-10-11 · Asistente con IA, limpiar todo y aclaraciones

- Asistente (botón flotante): pedís cambios hablando o escribiendo y propone bloques, cambios, momentos u objetivos; se aplican solo si confirmás. Usa Claude Sonnet 5.5 (`WEEK_MODEL`): entiende bien modificaciones en lenguaje natural y responde rápido, que importa con voz. Voz con el reconocimiento del navegador (es-AR). Necesita `ANTHROPIC_API_KEY` en el servidor (Vercel); sin clave avisa que no está activado. Ruta `src/app/api/week-ai`, lógica en `src/lib/week-ai.ts`.
- El sueño se configura tocando la lunita de arriba; donde estaba ese botón va "Limpiar todo" (borra los bloques de la semana, con confirmación).
- Los porcentajes de arriba se ordenan de mayor a menor.
- Momentos muestra cuánto suman por semana: las horas del mes se reparten en ~4,3 semanas (24 h en el mes ≈ 5,6 h por semana ≈ 4% de la semana despierta).
- Objetivos aclara que no cambian el balance. La bienvenida y la guía aclaran que LifeBucket no es una agenda de eventos sino la semana tipo en bloques.

## 2026-10-11 · Detalles del calendario en el celular

- Las hojas (sumar a tu semana, sueño, etc.) se cierran también deslizándolas para abajo desde la manija o el borde de arriba.
- En columnas angostas el nombre de cada bloque va en varias líneas (cortando palabras si hace falta) y el horario corto abajo si entra, en vez de "Br…".
- El tacho para eliminar aparece más arriba (sobre las pestañas, apenas encima del calendario) y en negro con texto blanco; rojo al pasar por encima.
- Al crear, mover o estirar un bloque, la columna de las horas marca la franja con su hora de inicio y de fin (como Google Calendar): con el dedo encima del bloque no se leía el rango.

## 2026-10-11 · Tacho, Momentos simplificado y objetivos por año

- Arrastrar un bloque muestra un tacho abajo de la pantalla; soltarlo ahí pregunta qué eliminar. Los botones dicen qué pasa: "Solo este evento (lunes)" / "Eliminar todos los eventos" (o "Eliminar evento" si no se repite).
- Momentos: una sola lista del mes, mezclada (Vínculos y Disfrute con su color), con el total de horas de cada parte arriba. Agregar va aparte, abajo: escribís qué fue, el tipo se sugiere solo y elegís cuánto duró. Antes había dos grupos con su campo y su "+" cada uno y confundía.
- Objetivos: cada año es un grupo que se comprime (el actual y el que viene siempre; los demás si tienen objetivos). Se agregan en la misma línea (escribir, fecha opcional, Enter o "+"), sin otra pantalla; tocar uno lo abre para editarlo.
- En el celular las hojas abren sin enfocar ningún campo (abría solo el reloj de "Configuración del sueño" o el teclado).
- La intro: el isotipo aparece, el logotipo se escribe letra por letra, con sonido, y la frase "Enterate en qué se te van las horas de tus días… y algunas funciones más!".
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

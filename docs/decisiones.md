# Decisiones

Registro de decisiones de producto, diseño y técnicas. Una entrada por decisión, la más nueva arriba: fecha, qué se decidió y por qué.

## 2026-10-12 · Semana tipo + logros, categorías nuevas y todo a la vista

- Objetivo de la app: que cada persona vea cuánto tiempo le queda para lo que le hace bien (y cuánto se lleva el trabajo).
- Categorías: Deporte (verde), Mente y Alma (violeta: meditar, terapia), Hobbies y disfrute (amarillo: por gusto, sin fin económico), Habilidades (azul: aprender algo intelectual) y Vínculos (rosa). La base: Trabajo, Libre y Sueño. Ids internos reusados para no perder datos: `cuerpo` = Deporte, `mente` = Habilidades, `alma` = Hobbies; nuevo `interior` = Mente y Alma.
- Dos cosas distintas: la semana tipo (la estructura que se repite, en el calendario) y los logros (el diario de cada día: lo que hiciste una vez, con fecha, categoría y duración). Los logros reemplazan a Momentos y suman a los % de la semana y del mes.
- Desktop, todo abierto: a la izquierda "Cómo llenás tu balde" (torta de la semana o del mes, con el reporte completo) y Logros; en el centro la semana; a la derecha Metas. Celular: pestañas Semana · Logros · Reporte · Metas.
- "Metas y logros" vuelve a ser "Metas" (Logros ahora es el diario).
- Datos v6: los Momentos pasan a logros (fechados el 1.º de su mes) y lo que era meditar o terapia en Mente pasa a Mente y Alma. También se migran los datos que llegan de la nube.
- Los bloques muestran su total de horas.

## 2026-10-12 · Menos divisiones: Libre y sueño juntos, Disfrute solo en Momentos, Metas y logros

- En la barra de arriba, Libre y Sueño son un solo espacio por llenar ("Libre y sueño", gris rayado).
- Al agregar un evento ya no está Disfrute: quedan Trabajo, Cuerpo, Mente y Libre (en gris). Lo que disfrutás se carga en Momentos y suma a Alma. Los bloques viejos de Disfrute siguen y se pueden editar.
- Objetivos pasa a llamarse "Metas y logros" (en la pestaña, "Metas").

## 2026-10-12 · Los datos se guardan en la nube

- Antes todo quedaba solo en el navegador: borrar la caché lo perdía y cada dispositivo tenía lo suyo. Ahora cada cuenta tiene una fila en Supabase (tabla `datos`, con RLS: cada uno ve y modifica solo lo suyo). SQL en `supabase/migrations/20261012_datos_en_la_nube.sql`.
- `src/lib/cloud-sync.ts`: al entrar se trae lo de la nube; cada cambio se sube solo a los ~1,5 s; sin conexión se sigue usando y se sube al volver. El navegador queda como copia rápida.
- Primera vez: si la nube está vacía, se suben los datos del navegador. Si los dos tienen datos de antes de la nube, gana la copia con más cosas cargadas. Si el navegador tiene datos de otra cuenta, no se suben.
- Al salir de la cuenta se sube lo pendiente y se borran los datos de ese navegador (quedan en la nube).

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

## 2026-10-12 · Objetivos diarios, metas en calendario y encabezado limpio

- Logros: el texto se lee con reglas, sin IA (`src/lib/logro-parse.ts`): "salí a correr dos horas ayer" elige 2 h y ayer y se guarda "Salí a correr". Lo que se elige a mano no se pisa. Por qué: cargar tiene que ser muy rápido y la IA no está conectada.
- Balde: Trabajo, Libre y Sueño van en la misma lista y en la torta (Sueño con lunita). Se saca la barra de arriba: el balde ya cuenta lo mismo.
- Encabezado: el logo y LIFEBUCKET al centro, el sueño a la izquierda y la cuenta a la derecha (en compu y en celular).
- Columna derecha: arriba, objetivos diarios (5 lugares de base y + para más; grilla del mes con un tilde por objetivo y día, puntaje del día y % del mes); abajo, metas anuales en calendario de 12 meses con un pop-up por mes. Datos nuevos `dailyGoals` y `dailyChecks` (se sincronizan con la nube como el resto). El reporte suma una sección de objetivos diarios y el panel se cierra con una cruz.

## 2026-10-12 · Paneles modulares, diario, logros diarios y "Cómo fue tu semana"

- Paneles modulares en compu (`Modules.tsx`): cada panel se comprime a su título o se mueve de columna (arrastrando ⠿ o desde ···). La disposición se guarda en este navegador (`lb:layout`). Por qué: los paneles de la derecha quedaban chicos y cada uno usa la pantalla distinto.
- Objetivos diarios pasan a llamarse Logros diarios: nombres en vertical arriba de cada columna; si el panel es chico, abren en la semana de hoy.
- Logros pasa a ser el Diario: lo que destacás del día. Si el texto trae actividad y duración suma al balde; si no, queda como nota (categoría opcional).
- Balde: arriba la base (Trabajo, Libre, Sueño) y abajo lo que te hace bien, cada grupo de mayor a menor.
- Las métricas del mes arrancan el primer día de uso (`startedAt`, STORE_VERSION 7): si empezaste a mitad de mes, no te suma los días anteriores.
- El reporte pasa a ser "Cómo fue tu semana / tu mes" (`RecapBook.tsx`, texto por reglas en `src/lib/recap.ts`): un libro con capítulos y gráficos, que se puede escuchar en voz alta. Metas anuales: el pop-up de un mes se abre solo con clic.

## 2026-10-12 · LifeBucket como acompañante motivacional

- Objetivo: un acompañante para personas a las que les cuesta organizarse y se traban año tras año con sus objetivos. No es un calendario ni un checklist: cada parte tiene sonidos, frases y recomendaciones (`src/lib/motivation.ts`, `Cheer.tsx`).
- Arranque guiado (`Setup.tsx`): bienvenida con el mensaje de LifeBucket y música zen (generada en el navegador, `src/lib/zen.ts`); después, con cada panel destacado, rutina (trabajo y sueño, y luego el tiempo libre), no negociables (y los de hoy), metas importantes, diario y cuándo preguntar. Termina en "Bienvenido a tu dashboard de vida". Quien ya tenía semana cargada no lo repite (STORE_VERSION 8, `setupDone`).
- Recordatorios dentro de la app (`Reminder.tsx`): al abrir o desde una hora (mañana, mediodía, noche), una vez por día. Sin notificaciones del sistema por ahora.
- Dashboard fijo (`Modules.tsx`): rutina arriba; abajo Tu Balde (un balde dibujado por capas) y Metas importantes; a la derecha No negociables a lo largo y Mi diario personal. Se comprimen y se ajusta el alto; no se mueven de lugar.
- No negociables (antes logros diarios): lista por mes (`goalMonths`), se puede cambiar mes a mes. Con poco alto, se ve el día para tildar y el mes como calendario de colores.
- Mi diario personal (`Diary.tsx`, `src/lib/diary.ts`): un texto puede traer varios logros; se reconoce categoría, duración y día. Se abre como libro: de un lado se escribe, del otro la historia del mes con tarjetas de color e hitos.
- Metas importantes: guardan cuándo se crearon, cuándo se cumplieron y cuántas veces se postergaron; avisan si una meta parece tarea simple, hábito o rutina (`src/lib/goal-tips.ts`).

## 2026-10-12 · Ajustes de balde, metas, no negociables y rutina

- Tu Balde: totales por grupo (Para vos; Libre y sueño) con horas y %, y en el dibujo solo un % chiquito en cada capa.
- Metas importantes: las metas se ven adentro de cada mes, con «+ Sumar» (sin pop-up). Se postergan arrastrándolas a otro mes o con →; el reporte expandido muestra propuestas, cumplidas, no cumplidas, postergadas y el recorrido de cada meta (creada, meses, días, cumplida).
- No negociables: vuelve la columna larga con la grilla del mes entero por día (el diario de abajo queda chico, solo para escribir).
- Rutina semanal: botón «Editar rutina» (sueño y cada bloque, agrupados por categoría). Se saca la pastilla del sueño de arriba.

## 2026-10-12 · Resumen general con IA, diario como libro y avisos

- No negociables: los nombres van en horizontal (se doblan si no entran). Con expandir, «mes a mes»: gráfico de líneas del cumplimiento (total y de cada hábito) y un resumen de cada mes.
- Mi diario personal (expandido): meses con flechas; a la izquierda, escribir y un gráfico de líneas con las horas de cada grupo en los últimos 6 meses; a la derecha, el cuento del mes. Al anotar suena una hoja de papel.
- «Cómo viene tu balde» pasa a ser «Resumen general» (mes y año con proyección). La IA (`/api/summary`, Claude Sonnet 5.5, salida estructurada) escribe el relato con todos los datos; los gráficos los pone la app. Sin clave o si falla, queda el texto armado por reglas.
- Avisos (`src/lib/nudges.ts`): si algo está vacío o conviene (rutina sin trabajo, sin no negociables, metas del año vacías, diario sin cargar, metas trabadas, grupos sin tiempo, poco sueño), salta un aviso por visita y todos quedan juntos en la campanita «Recomendaciones y recordatorios».

## 2026-10-12 · Arranque obligatorio y empezar de cero

- El arranque guiado no deja seguir hasta completar cada paso: sueño configurado y al menos un bloque de trabajo; al menos una actividad que se repite; al menos un no negociable; tildar los de hoy (o «Hoy ninguno»); al menos una meta en los meses que quedan; algo escrito en el diario hoy. Al lado del botón se dice qué falta.
- «Empezar de cero (borra todo)» en el menú de la cuenta: con confirmación, borra todos los datos (en el navegador y en la nube), cierra la sesión y al volver a entrar arranca la bienvenida (con la música de intro) y la configuración.
- La música zen suena siempre por defecto (desde el primer toque, porque el navegador no deja antes); solo se apaga con el botón.

## 2026-10-12 · Ajustes del arranque y del tablero

- Paso 1 del arranque: tres botones directos (configurar sueño, trabajo y emprendimiento, con «No tengo»); sale el paso de tiempos libres. Los pasos 2 a 4 se completan en el mismo cartel (no negociables, los de hoy, metas con el mes y el diario) y se aplican al tablero. La capa de la guía ya no bloquea los clics sobre lo destacado.
- El sueño no se muestra en el calendario hasta configurarlo (`sleepSet`, STORE_VERSION 9).
- Tablero: a la izquierda Tu Balde (con su resumen) y Metas importantes debajo; al centro la rutina a todo lo alto; a la derecha No negociables y Mi diario personal.
- Balde: total «Tiempo para vos»; Trabajo, Libre y Sueño sueltos debajo de la línea.
- Diario: se elige la fecha (Hoy, Ayer u otro día) además de la que dice el texto.
- Los avisos de «le falta X» abren el editor de la rutina con un ejemplo de esa categoría; el de sueño abre la configuración de sueño.
- Música: el parlante de arriba la prende y apaga (tachado si está apagada). Los sonidos de la app se silencian desde el menú de la cuenta.
- El botón flotante del asistente con IA queda apagado por ahora.

## 2026-10-12 · Arranque más guiado

- Bienvenida en frases cortas; después, un paso que presenta la rutina («vamos a configurarla muy rápido… para ver qué espacio queda libre para vos»).
- La rutina en cuatro subpasos: sueño, trabajo, emprendimiento (o «No tengo») y «lo importante» (Deporte, Mente y Alma, Hobbies, Habilidades, cada uno con su explicación y un ejemplo). Vínculos no va en la rutina: los encuentros se anotan en el diario.
- Los pasos de no negociables, metas y diario se completan en el panel del tablero; el cartel solo guía («qué tocar», paso a paso).
- Editor de bloques: lo que ya tenés aparece como sugerencia solo mientras escribís; si venís de una categoría, ideas de esa categoría. Cada categoría muestra qué entra en ella.

## 2026-10-12 · Sin «Libre»: el balde es sueño, trabajo y lo tuyo

- El tiempo libre deja de contar: el balde se reparte entre Sueño, Trabajo y lo que hacés para vos (`bucketTotal()` en `week-shares.ts`). Si no hay nada para vos, el 100% es sueño y trabajo.
- Sin nada para vos, el balde se ve desbordado (se sale por arriba y gotea) con un aviso y el botón «Sumar algo para vos», que abre el editor.
- «Libre» ya no se elige como categoría; los bloques viejos así (por ejemplo el almuerzo) se siguen viendo en el calendario, pero no cuentan.
- Arranque: cartel a los 30 s de terminar («¿Te olvidaste de agregar algo?»). Arriba vuelven dos botones: música (nota, tachada si está apagada) y sonidos (parlante).

## 2026-10-13 · Diario en el encabezado, semanas navegables y recordatorio para completar

- Mi diario personal sale del tablero: arriba a la derecha queda un librito (abre el diario completo) y la barra «Contame lo que hiciste hoy». «Resumen general» pasa arriba a la izquierda.
- Rutina semanal: semanas numeradas y navegables. Cada semana guarda cómo quedó la rutina (`weekRoutines`); las anteriores se ven y se pueden replicar en la actual. Hoy queda resaltado y los días que ya pasaron, atenuados.
- Recordatorio al entrar: se completa ahí mismo (1. tildar no negociables, 2. escribir en el diario), con «Saltear por hoy» y «Recordarme más tarde».
- La historia del mes se cuenta como texto, con cada cosa en su color y los hitos (2 h o más) subrayados.
- Vistas ampliadas: no negociables con «Esta semana» (día por día) y «El año»; diario con «Este mes» (día por día) y «El año» (mes por mes).
- Guía: Trabajo y emprendimiento con categoría fija y explicaciones de días y horario; los pasos que se completan solos avanzan solos.
- Música: se arregló el botón (no arrancaba si el navegador no había recibido un toque, y el arranque automático lo volvía a prender).

## 2026-10-13 · Categorías nuevas, huecos que titilan y no negociables más cómodos

- Categorías: Habilidades pasa a «Intelecto y Cognitivo» y Mente y Alma a «Mente y Espíritu». Libre pasa a ser «Tareas cotidianas» (cocinar, desayunar, barrer, ordenar): se agenda y suma al balde como base, con Trabajo y Sueño (el tiempo sin agendar no cuenta).
- Rutina: los huecos de una hora o más entre que te levantás y te acostás titilan suave (la idea es completarla).
- Balde: dos grupos bien separados, «Tiempo para vos» (con su total) y «La base».
- Metas: entran todos los meses que quedan sin scroll; volver una meta para atrás deshace la postergación.
- Los botones que abren un reporte usan un ícono de gráfico (no el de expandir).
- No negociables: casilleros juntos y más grandes, tildar arrastrando, colores tipo semáforo por puntaje del día (rojo, azul, amarillo… verde al completar), totales por columna abajo y un sonido de festejo al completar el día.

## 2026-10-13 · Tu balde ideal, tablero de logros y avisos espaciados

- Meta: un «balde ideal» realista de tiempo para vos (~18 h por semana, 2,5 h por día, dentro de las 2–5 h diarias que más bienestar dan según Sharif et al. 2021), repartido por categoría con valores de referencia: Deporte 3 h (OMS: 150–300 min y fuerza 2 días), Mente y Espíritu 2 h (10–20 min por día), Vínculos 6 h (verse ~2 veces por semana), Hobbies 4 h, Intelecto y Cognitivo 3 h (sin estándar; punto de partida). Cada persona los puede ajustar (`idealHours`, `src/lib/balance-goals.ts`). No se usa "superar la base" porque sueño + trabajo + tareas pasan las 100 h semanales.
- Tablero de logros dentro de Tu Balde: cada categoría con su barra hacia la meta, ordenadas por avance y animadas al cambiar de puesto, con sonido. Hitos (mitad, meta, balde ideal completo) se festejan una vez por semana.
- Avisos: recomendaciones de balance según cómo viene la semana (por ejemplo, Vínculos atrasado el miércoles), con un toque para sumarlo a la rutina. Como mucho 3 por día, uno cada 3,5 h, nunca entre las 22 y las 8.
- Rutina: aviso fijo «Terminá de completar tu rutina» con las horas sin asignar, hasta que no quede ningún hueco; línea punteada en la hora actual y lo que ya pasó de hoy atenuado; la luna (azul) abre la configuración del sueño.
- Colores: selector en el menú de la cuenta con tres paletas (Neutro, Pastel, Intenso).
- Tu Balde sin el dibujo del balde (ocupaba mucho lugar). La barra del diario dice «¿Qué hiciste hoy fuera de tu rutina?».

## 2026-10-13 · La base, en oscuro; lo tuyo, con color

- La base (lo estructural que se configura al principio: Trabajo, Tareas cotidianas y Sueño) va en tonos oscuros: Trabajo casi negro y Tareas cotidianas gris oscuro, con su ícono en el calendario (como la luna del sueño). Los colores quedan para el tiempo para vos.
- Al sumar o cambiar un bloque, las categorías se agrupan en «La base» y «Tiempo para vos».
- El sueño se estira desde el calendario (los bordes de la franja de la luna): cambia la hora de levantarte o acostarte de ese tipo de día (de semana o de finde).

## 2026-10-13 · Tablero modular, listas y diario debajo de la rutina

- Tablero modular en tres columnas (la del centro, la más ancha): cada panel se mueve de columna o de lugar (⠿ o ···), se comprime y se estira desde el borde con el siguiente. Si una columna queda con un panel, ocupa todo el alto.
- Listas personales (botón arriba a la izquierda): Súper (agrupada por sección), Pendientes (con prioridad), Checklist para repetir (se reinicia), ¿Dónde está? (dónde guardaste cada cosa) y Notas. Se pueden ocultar (ojito) y volver a mostrar.
- «¿Qué hiciste hoy fuera de tu rutina?» va abajo del calendario; «Mi diario» es un panel chico con lo de hoy contado en una frase, que abre el diario completo. Si escribís la hora («de 18 a 20», «a las 7 de la mañana»), aparece en el calendario de esa semana como algo puntual.
- El calendario llega hasta las 24:00. Los huecos ya no titilan: quedan en blanco con el aviso fijo arriba.
- Tareas cotidianas suma ideas: desayuno, almuerzo, cena, pasear al perro.

## 2026-10-13 — Paneles, listas y eventos fuera de la rutina

- **Ocultar paneles:** cada panel tiene un ojito a la derecha (aparece al pasar el mouse). Lo oculto se vuelve a mostrar desde «Mis listas», arriba.
- **Mis listas:** menú que se abre con hover, a la derecha de «Resumen general». Una sola lista por tipo (Súper, Pendientes, Checklist, ¿Dónde está?, Notas); mostrarla la crea si no existe. No hay un panel general de listas: cada lista es su panel. Si había listas repetidas, sus ítems se juntan en una (v10 del estado).
- **Menú de cuenta:** sin «Ver la guía otra vez» ni «Versión en pasos». Queda «Empezar de cero».
- **Colores:** un botón arriba que va pasando pastel → intenso → neutro con cada clic, en vez de elegir dentro del menú.
- **Eventos fuera de la rutina (con hora):** se mueven, se estiran y se borran en el calendario. Si pisan un bloque de la rutina, lo reemplazan ese día (el bloque se corta, no se superponen).
- **Lector de texto (sin IA):** entiende fechas futuras ("mañana", "pasado mañana", "el viernes que viene", "en dos días"), horas con parte del día ("10 de la noche", "9 am", "y media", "menos cuarto", "al mediodía"), rangos ("de 9 a 12", "entre las 7 y las 8", "hasta las 12") y repeticiones ("todos los días", "de lunes a viernes", "lunes, miércoles y viernes", "los findes"). El tiempo del verbo decide el día suelto: "el sábado tengo" es el que viene; "el sábado tuve / salí" es el que pasó. Reconoce tus propias actividades de la rutina para la categoría.
- **Barra de abajo del calendario:** «Pedime algo para agregar a tu rutina o sumá algo que hiciste fuera de tu rutina para esta semana». Mientras escribís, se dibuja en el calendario dónde va a quedar. El título se puede editar y, si solo dijiste cuándo, queda vacío hasta que digas qué es. Cada cosa puede pasar a la rutina eligiendo los días («¿Lo hacés rutina?»); si se dijo una repetición, ya viene marcado.
- **Replicar una semana:** si tenía eventos fuera de la rutina, pregunta si se copian también o solo la rutina.
- **Borrar (rutina semanal):** pregunta qué borrar (la rutina, los eventos fuera de la rutina de esta semana o todo) y pide confirmar.
- **Duración visible:** al crear o arrastrar un bloque o evento se ve cuánto dura, y la tarjeta muestra la duración primero.

## 2026-10-13 — Cómo te sentiste, Pendientes y ajustes del tablero

- **«¿Cómo te sentiste hoy?»** reemplaza al panel «Mi diario»: hasta 3 emociones (feliz, tranquilo, agradecido, con energía, cansado, ansioso, triste, angustiado, enojado, frustrado) y texto libre, una entrada por día (se puede ir a días anteriores). Se guarda aparte (`moods`), no suma horas al balde. «Leer» lo muestra como un cuentito por semana o por mes, con la mezcla de emociones arriba. Lo que hiciste fuera de la rutina queda solo en la barra del calendario.
- **Paneles:** se arrastran desde el encabezado; sin manija ni menú de «mover».
- **Sin «Resumen general»** arriba.
- **Listas:** se va la «Checklist para repetir»; sus pasos pasan a Pendientes como pendientes que se repiten cada día, en un grupo con el nombre de la checklist (v11). Sin el tacho de «vaciar» arriba de las listas.
- **Pendientes** (aparece de entrada en el tablero, y en el celular en «Hoy»): fecha límite con «vence en N días / vencida hace N días», dividido por mes, grupos propios (Personal, Trabajo…), ocultar o mostrar lo hecho, repetición (cada día, semana o mes: al completarlo vuelve con la fecha siguiente), orden por prioridad (y fecha), por fecha o a mano (arrastrando). El texto entiende la fecha y la repetición («pagar la luz el viernes», «sacar la basura todos los días»). «Ampliar» lo abre en grande con un calendario del mes: arrastrás un pendiente a un día para fecharlo. Avisos de vencidos y de hoy dentro del panel y, una vez por día, en el tablero, con Hecho / Para hoy / Mañana / En una semana.
- **Metas importantes:** el nombre se lee entero (varias líneas); los botones aparecen encima al pasar el mouse.
- **Tu balde:** siempre se ve el % de cada categoría (con ✓ al completarla) y el % total del tiempo para vos.

## 2026-10-13 — Ajustes de Pendientes, Balde, Metas y deshacer

- **Pendientes:** la fecha que pusiste se ve siempre («Vence en 3 días · 16 oct»). Al sumar uno se puede crear un grupo nuevo ahí mismo. El desplegable dice «Importancia» (adentro: baja, media, alta). Lo completado queda en su lugar, tachado, y arriba hay un botón fijo «Ocultar / Mostrar completados». Lo que no tiene fecha va en un grupo aparte, abajo de todo. El ícono para verlo en grande es un calendario. Grupos arriba y, abajo, orden y completados (en una fila no entraban).
- **No negociables:** el % es tildes hechas sobre todas las casillas del mes (no negociables × días), de 0 a 100. La fila de totales queda pegada abajo, sin hueco.
- **Barra del calendario:** «Agregá algo dentro o fuera de tu rutina, como: «Mañana salgo a comer de 19 a 21 hs con amigos»».
- **Deshacer:** botón arriba (y Ctrl+Z fuera de los campos) para volver atrás el último cambio. Los cambios seguidos cuentan como uno; el historial vive en la pestaña y no incluye la carga inicial de datos.
- **Tu balde:** sin la barra de «Tu balde ideal». Cada categoría del tiempo para vos en una tabla: objetivo, llenado y qué % representa del total del tiempo para vos, con una fila de total.
- **¿Cómo te sentiste?:** Enter guarda (Shift+Enter, nueva línea) y lo confirma.
- **Metas importantes en grande:** reemplaza al reporte. Todo el año para editar (tildar, sumar, borrar, arrastrar entre meses) y estadísticas: cumplimiento, postergaciones (y promedio por meta), meses de atraso, tiempo promedio para cumplir, la más postergada, la más antigua sin cumplir, mejor mes y avance por área; en la tabla de cada meta, el atraso en meses.
- **Celular:** el encabezado pone el logo a la izquierda y los botones a la derecha (con deshacer no entraban).
- **Tu balde, vista del mes:** es el mes entero: tu semana (rutina y objetivos) llevada a todos los días del mes, más lo que anotaste en el mes. Así «5 h por semana» se ve como ~22 h en el mes.
- **Ajustar, bien visible:** botón «Ajustar» en «Para vos» (horas objetivo) y en «La base» (horarios de sueño, sumar trabajo o tareas cotidianas).
- **«Metas anuales importantes»** (nuevo nombre). La vista en grande entra sin scroll: pestañas «El año» (los 12 meses para editar, con las estadísticas al costado) y «Cada meta» (la tabla).

## 2026-10-13 — Recordatorios (antes Pendientes)

- **Pendientes pasa a llamarse Recordatorios** (v12 renombra la lista si tenía el nombre de siempre).
- **Tipos**, cada uno con color e ícono: Tareas, Cumpleaños, Aniversarios, Pagos y vencimientos, Salud, Mascotas y Trámites. El tipo se adivina por el texto («cumple de Juan», «pagar el alquiler», «turno con el dentista») y se puede cambiar. Cumpleaños y aniversarios se repiten cada año y, si cargás el año, dicen cuántos cumple; los pagos, cada mes. La importancia es solo para tareas. Cumpleaños y aniversarios avisan 3 días antes.
- **Feriados y fechas especiales:** se calculan en la app para Argentina (fijos, Carnaval y Semana Santa según la Pascua, y los trasladables con la regla de la Ley 27.399) más Día de la Madre, del Padre, del Amigo, del Niño, San Valentín, Primavera, Nochebuena y Fin de año. Sin depender de Google ni de un servicio externo (traerlos de Google pide una clave). Se ven en el calendario y en «Próximas fechas» (15 días).
- **Vista en grande:** una fila de interruptores, uno por tipo (con feriados), para mostrar u ocultar cada uno en el calendario y la lista.
- **Recordatorios, más:** tipos propios (nombre, emoji y un color que no use otro tipo), que se crean desde «Tipo → + Nuevo tipo…» o desde «Configurar tipos» en la vista en grande (ahí también se muestran u ocultan, se editan y se borran). El grupo (Personal, Trabajo…) es solo para tareas. Cada recordatorio puede tener hora (se lee del texto: «a las 18») y aviso (en el momento, 1 o 3 horas antes, 1 o 2 días antes, una semana antes); el aviso del tablero aparece cuando llega ese momento y cada uno se cierra una vez. Lo que vence hoy y lo vencido, en rojo. Textos del módulo más chicos.
- **Feriados y fechas especiales:** cada uno se puede quitar «solo este año» o «para siempre» (se vuelven a mostrar desde «Configurar tipos»).
- **La base → Ajustar** abre directo «Tu base»: sueño (cambiar horarios), y cada bloque de trabajo y de tareas cotidianas para editarlo, o sumar uno nuevo.

## 2026-10-13 — Guía de configuración, desde cero

- **Bienvenida** a pantalla completa (todavía no se ve la app).
- **Pasos:** Bloque 1, rutina: sueño → trabajo principal (con nombre) → emprendimiento (o «Más adelante» / «No emprendo») → el resto de la semana. Ahí una animación arrastra y suma el **almuerzo de 13 a 14**, encima del trabajo, y un cartel explica que se puede mover, estirar o borrar; el cartel se va al tocar el calendario o cambiar la rutina. Después, la barra de texto: la guía escribe sola un ejemplo («mañana salgo a caminar de 19 a 20 hs»), lo agrega con «Enter» y pregunta si va a la rutina y qué días; mientras se eligen, se ve en el calendario. Bloque 2: no negociables (mínimo 3, hasta 5) y tildar los de hoy (sigue solo al completarlos). Bloque 3: metas anuales. Bloque 4: recordatorios (la guía escribe «cumple de mamá el 3 de mayo» y muestra lo que entendió). Al final, el balde con lo que falta para vos (y un botón para sumar cada cosa) y un repaso de los botones de arriba.
- **Cómo se ve:** sin burbujas grandes en los módulos. Arriba, una barra chica con el paso, qué hacer y «Saltear» / «Siguiente»; en cada elemento del panel, una etiqueta con flechita (la principal en amarillo). El resto de la pantalla queda oscuro y borroso; el panel del paso se despliega (y agranda) si estaba comprimido u oculto, y lo marcado se trae a la vista.
- **Editor dentro de la guía:** se abre al costado (el calendario queda a la vista y lo que armás se dibuja en él), con el paso, la pregunta y qué completar; la barra de la guía se esconde mientras está abierto. Lo que avanza solo (sueño, trabajo, emprendimiento, tildes de hoy) espera un momento para que se entienda.
- **Guía, revisión de experiencia (13/10):** nada encima del calendario: el horario de sueño y el editor de bloques se abren al costado, y la barra de la guía se ubica arriba o abajo del panel o, si es muy alto (la rutina), a su costado. Los pasos que terminan solos (sueño, trabajo, emprendimiento) no muestran «Siguiente» ni un cartel de completado: pasan directo. Donde el panel ya tiene su forma de terminar (no negociables: «Listo»; metas: al sumar la segunda), la barra no muestra «Siguiente» y la flechita señala qué tocar. La flechita de no negociables sigue en el campo que estás escribiendo (no salta al siguiente al tipear). El ejemplo de la barra de texto pregunta «¿Es algo de una vez o parte de tu rutina?» con «Solo esta vez» marcado; si elegís rutina, se ve en todos los días y sacás los que no van. El recordatorio de ejemplo se escribe solo, las flechitas señalan lo que reconoció (tipo, fecha, aviso) y se agrega solo; después te invita a probar uno.
- **Sueño por defecto:** lunes a viernes de 22 a 7; fin de semana de 23 a 9. **Emprendimiento por defecto:** de 17 a 19.
- **Cierre de la guía, el balde en 3 pasos:** «Este es tu LifeBucket» (flechitas a la base y a lo que es para vos), «Tocá estos botones para editar» (las dos perillas «Ajustar») y «Veo que no agregaste nada en…» con un botón para sumar cada cosa. Recordatorios: después del ejemplo, cuando sumás uno vos, el paso termina solo. No negociables: con la lista cerrada la flechita señala el lápiz («Modificá o agregá no negociables»).
- **Avisos:** se sacan todos los anteriores (consejos y campanita de recomendaciones, el aviso al entrar a la app y «¿Te olvidaste de agregar algo?»); se van a rehacer desde cero. Queda uno: si tu semana tiene horas sin completar, una vez por día, al costado del calendario, «Te quedan N h sin completar» con «Mostrame cómo», que muestra un cursor arrastrando y sumando «Desayuno» de 7 a 8 (o el primer hueco libre). Los avisos de tus recordatorios (vencidos, del día) siguen, porque son parte de ese módulo.

## 2026-10-13 — Modo prueba, balde con espacios sin completar y más

- **Modo prueba** (menú de tu cuenta): la app con datos aparte y vacíos, en este navegador y sin sincronizar con la nube; sirve para hacer la guía o probar cambios sin tocar tu cuenta. Una etiqueta violeta abajo lo avisa, con «Reiniciar» (vuelve a empezar la prueba) y «Salir» (vuelven tus datos tal cual). «Empezar de cero» y «Salir» de la cuenta, en modo prueba, solo afectan la prueba.
- **«¿Cómo te sentiste?»** arranca oculto en la primera configuración (se muestra desde «Mis listas»).
- **No negociables en grande:** indicadores arriba (cumplimiento del mes, racha actual, mejor racha, días perfectos, lo más constante y lo que más cuesta) y pestañas «Este mes» (para tildar día por día), «Esta semana» (también se tilda) y «El año» (gráfico y resumen por mes). «Editar» cambia los de este mes ahí mismo.
- **Tu balde:** «Espacios sin completar» aparte (no cuentan en el 100%, que es base más para vos); tocándolo se abre el editor en el primer hueco libre de tu rutina. El aviso tiene niveles según cuánto ocupa la base: ajustado (80 %+), muy cargado (88 %+) y desbordado (95 %+ o nada para vos).
- **Calendario:** se ven todas las horas al costado, más legibles.
- **Días elegidos en verde** (editor y guía), con la aclaración de que si algún día es en otro horario se cambia después en el calendario.
- **Guía, «Agregá tus espacios libres»:** «Por ejemplo, voy a agregar el almuerzo de 12 a 13»; después pregunta «¿Te sirve?» con «Sí, dejalo» o «No, borralo», y explica cómo sumar lo demás arrastrando.

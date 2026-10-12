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

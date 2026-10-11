---
name: LifeBucket
description: Planificador de balance de vida en cinco cuadrantes, pensado para cabezas con TDAH.
colors:
  ink: "#252836"
  ink-muted: "#656B7D"
  ink-faint: "#9AA0AE"
  canvas: "#F6F8FB"
  surface: "#FFFFFF"
  surface-sunken: "#F2F4F8"
  line: "#EAEDF2"
  selection: "rgba(37, 40, 54, 0.12)"
  cuerpo: "#F06A3F"
  cuerpo-soft: "#FDECE5"
  mente: "#3C7BF0"
  mente-soft: "#E6EEFD"
  alma: "#9A6BE8"
  alma-soft: "#F1EAFC"
  vinculos: "#E5508A"
  vinculos-soft: "#FCE8F0"
  trabajo: "#52606D"
  trabajo-soft: "#EBEEF1"
  libre: "#B8893A"
  libre-soft: "#F6EEDF"
  sleep: "#2C3044"
  sleep-soft: "#ECEEF4"
  danger: "#C93C3C"
typography:
  display:
    fontFamily: "Be Vietnam Pro, system-ui, sans-serif"
    fontSize: "1.375rem"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-0.015em"
  headline:
    fontFamily: "Be Vietnam Pro, system-ui, sans-serif"
    fontSize: "1.0625rem"
    fontWeight: 600
    lineHeight: 1.3
  title:
    fontFamily: "Be Vietnam Pro, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 600
    lineHeight: 1.35
  body:
    fontFamily: "Be Vietnam Pro, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
  control:
    fontFamily: "Be Vietnam Pro, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 500
    lineHeight: 1.3
  block:
    fontFamily: "Be Vietnam Pro, system-ui, sans-serif"
    fontSize: "12.5px"
    fontWeight: 500
    lineHeight: 1.3
  label:
    fontFamily: "Be Vietnam Pro, system-ui, sans-serif"
    fontSize: "0.6875rem"
    fontWeight: 500
    lineHeight: 1.3
  micro:
    fontFamily: "Be Vietnam Pro, system-ui, sans-serif"
    fontSize: "11px"
    fontWeight: 500
    lineHeight: 1.3
  metric:
    fontFamily: "Be Vietnam Pro, system-ui, sans-serif"
    fontSize: "1.375rem"
    fontWeight: 600
    lineHeight: 1
    fontFeature: "\"tnum\" 1"
rounded:
  sm: "6px"
  md: "8px"
  lg: "12px"
  xl: "16px"
  pill: "999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "20px"
  2xl: "24px"
  3xl: "32px"
components:
  card:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.lg}"
    shadow: "0 3px 16px rgba(142,134,171,0.07), 0 0 0 1px rgba(37,40,54,0.025)"
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.surface}"
    rounded: "{rounded.md}"
    height: "40px"
  block:
    backgroundColor: "quadrant soft"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "7px 4px 7px 10px"
  segmented:
    backgroundColor: "{colors.surface-sunken}"
    selectedBackground: "{colors.surface}"
    rounded: "{rounded.lg}"
---

# Design System: LifeBucket

## Overview

**Creative North Star: "La torta en equilibrio", en un tablero moderno**

LifeBucket se ve como un dashboard de productividad actual (referencia de Joaco: Rizz admin): lienzo gris frío, tarjetas blancas sin borde que flotan con una sombra difusa, una barra lateral angosta de íconos y un saludo personal arriba. La interfaz casi no tiene color propio: **el color pertenece a la vida del usuario**. Los cinco cuadrantes son lo único cromático, así que una semana planificada se lee como un mosaico y el balance se entiende antes de leer un número.

Es una herramienta para cabezas con TDAH: una decisión principal por pantalla, acciones de un toque, recompensa visual inmediata y nada que suene a reproche.

**Key Characteristics:**
- Chrome neutro y frío (tinta azulada, grises fríos); el color lo ponen solo los cuadrantes.
- Tarjetas blancas con sombra difusa; nunca tarjetas dentro de tarjetas.
- El anillo de balance (real vs. objetivo) es la firma y también el isotipo.
- Tipografía chica y precisa (13–14px), densidad media.
- Nunca rojo para lo no cumplido.

## Colors

### Primary
- **Tinta** (#252836): texto principal, botón primario, día seleccionado. El acento de la interfaz es la tinta, no un color de marca.

### Quadrant colors
- **Cuerpo, Naranja Energía** (#F06A3F / soft #FDECE5)
- **Mente, Azul Foco** (#3C7BF0 / soft #E6EEFD)
- **Alma, Lavanda** (#9A6BE8 / soft #F1EAFC)
- **Vínculos, Frambuesa** (#E5508A / soft #FCE8F0)
- **Trabajo, Grafito** (#52606D / soft #EBEEF1)
- **Libre, Ocre** (#B8893A / soft #F6EEDF): descanso, ocio, traslados, casa. Va entre Vínculos y Alma en el orden de gráficos (validado para daltonismo).
- **Sueño, Noche** (#2C3044 / soft #ECEEF4): solo para la franja de sueño, siempre con rayado diagonal. No es una categoría del balance.

### Neutral
- **Lienzo** (#F6F8FB), **Superficie** (#FFFFFF), **Superficie hundida** (#F2F4F8: controles segmentados, chips, zona de drop), **Línea** (#EAEDF2: divisores de 1px).
- **Tinta suave** (#656B7D) para texto secundario; **Tinta tenue** (#9AA0AE) solo para rótulos decorativos e íconos inactivos, nunca para texto que haya que leer.
- **Peligro** (#C93C3C): solo acciones destructivas.

### Named Rules
**The Six Voices Rule.** Solo las seis categorías del tiempo despierto (cinco cuadrantes + Libre) llevan color saturado. Si algo del chrome necesita destacarse, se resuelve con tinta, peso o espacio.

**The Grafito Rule.** Trabajo es el color más apagado: si la semana se desbalancea hacia el trabajo, se ve gris, y ese es el mensaje.

**The Hue-Tinted Meta Rule.** Sobre un fondo de cuadrante, el texto secundario se tiñe con el color del cuadrante (`color-mix(var(--q) 55%, ink)`), nunca gris.

## Typography

**Familia:** Be Vietnam Pro (400/500/600) para todo, con números tabulares en métricas.

### Hierarchy
- **Display** (600, 22px): saludo ("Buen día, Joaquín") o título de vista. Uno por pantalla.
- **Headline** (600, 17px): título de hojas y diálogos.
- **Title** (600, 14px): títulos de tarjeta ("Balance de la semana", "Tu semana").
- **Body** (400, 14px): textos; máximo 65ch.
- **Control** (500, 13px): chips, segmentados, inputs chicos.
- **Block** (500, 12.5px, máx. 2 líneas): nombre del bloque en la semana. Tooltip con el nombre completo.
- **Label / Micro** (500, 11px): rótulos de campo, Mañana/Tarde/Noche, metadatos.
- **Metric** (600, 22px, tabular): porcentajes.

## Layout

**Desktop (≥768px):** barra lateral de íconos fija de 72px (isotipo, Semana, Actividades, inicial del usuario). Contenido con máximo 1600px: saludo + "Nuevo bloque"; tarjeta de Balance; tarjeta de Semana.

**Tarjeta de Balance:** en ≥1180px es una sola fila (anillo + resumen, y los cinco cuadrantes separados por divisores con % real, objetivo, barra con marca de objetivo y horas). Por debajo, el anillo arriba y los cuadrantes en una fila deslizable.

**Semana:** grilla horaria fija de 6:00 a 24:00 en tramos de 30 min (26px por tramo), 7 columnas continuas. Mañana, Tarde y Noche son bandas rotuladas en el eje horario, no cajas. Cada día muestra en su encabezado cuántas horas libres le quedan (7 a 23 h) y hoy lleva una línea de "ahora". La grilla no tiene scroll propio: crece con la página. Al bajar, la tarjeta de Balance se comprime en una **barra fija arriba** (56px: anillo chico + cinco chips con %), y la navegación de la semana con los días queda pegada debajo. Por debajo de 900px se usa la vista de día.

**Mobile (<640px):** saludo con isotipo; Balance compacto; navegación de semana; selector de días pegajoso (con puntitos de los cuadrantes); la grilla horaria de un día; barra inferior Semana / Balance / Actividades; botón flotante "+".

### Named Rules
**The Full Day Rule.** Cada minuto despierto está asignado: los huecos se pintan como Libre (fondo ocre suave, sin borde, sin check), y el sueño es una franja rayada fija que no se puede agendar. **The Free Time Rule.** El día se ve como horas fijas para que el espacio libre sea visible. Los bloques se agendan a una hora pero se mueven arrastrando, sin fricción; Mañana, Tarde y Noche siguen como bandas de referencia.

## Elevation & Depth

- **Card** (`0 3px 16px rgba(142,134,171,0.07)` + anillo de 1px casi invisible): todas las tarjetas en reposo.
- **Lifted** (`0 10px 28px rgba(37,40,54,0.14)`): bloque arrastrándose (escala 1.02) y botón flotante.
- **Popover** (`0 12px 40px rgba(37,40,54,0.14)`): diálogos en desktop. **Sheet** para hojas inferiores en mobile.

## Motion

- Curvas propias: `--ease-out: cubic-bezier(0.23, 1, 0.32, 1)`, `--ease-drawer: cubic-bezier(0.32, 0.72, 0, 1)`.
- Todo lo presionable baja a `scale(0.97)` al apretar (`pressable`).
- El anillo y las barras crecen en 400ms al completar un bloque; el check hace un pop de 280ms.
- Hover que revela controles solo en dispositivos con hover real.
- `prefers-reduced-motion` anula las animaciones.

## Components

### Bloque (firma)
Alto proporcional a la duración. 30 min: una línea (nombre + check). 1 h: nombre en una línea + horario. 2 h: nombre hasta en dos líneas, sin cortar palabras. Nombre completo en tooltip.
Fondo *soft* del cuadrante, sin barra lateral. Nombre en Block (12.5px, 2 líneas máx.), debajo duración + ícono de repetición si es parte de una serie, teñidos del color del cuadrante. Check circular de 16px (20px en mobile) a la derecha. Estados: *cumplido* (fondo más saturado + check lleno), *no cumplido / "Hoy no"* (opacidad 55% y borde punteado, nunca rojo), *arrastrando* (Lifted).

### Anillo de balance (firma)
Dona de 5 segmentos con 2px de separación; aro exterior fino al 40% marca el objetivo. En el centro, el puntaje de balance (0–100). El mismo anillo, en equilibrio, es el isotipo.

### Hoja de bloque (crear/editar)
Orden: Actividad (todas juntas, cada chip con el ícono de su cuadrante; al elegirla aparece "Suma a Cuerpo · …"; "+ Nueva" pide nombre y a qué parte de la vida suma) → Duración (30 min / 1 h / 2 h) → Cuándo (día + hora) → Repetir (No / Todos los días / Elegir días con L M M J V S D). El cuadrante nunca se elige aparte. Una sola acción primaria.

### Arrastre
La ficha encastra: salta de a 30 min, se alinea a la columna del día que tiene debajo y muestra en vivo el horario en que va a quedar. El destino lo define el puntero.

### Asistente
Panel lateral (desktop) u hoja inferior (mobile): conversación, sugerencias de arranque, dictado por voz. Las respuestas proponen cambios en una lista con el ícono del cuadrante; nada se aplica hasta tocar "Aplicar". El micrófono activo usa tinta, nunca rojo.

### Eventos que se repiten
Al editar o borrar un evento de una serie se pregunta el alcance, como en Google Calendar: *Solo este evento*, *Este y los siguientes*, *Todos los eventos*.

### Actividades
Por cuadrante: elegidas (chips *soft* con quitar), sugerencias (chips punteados "+ Nombre") y un campo para sumar una propia. Se usan en el onboarding y en la vista Actividades.

### Semana base
Asistente en dos pasos dentro de una hoja: **Lo que se repite** (explicación corta, sugerencias rápidas como Desayuno, Almuerzo o Gimnasio y un formulario de días + horario) y **Tus espacios libres** (lista de huecos de 1 h o más; tocar uno te lleva a ese día y abre el alta en ese horario). En modo relleno el calendario resalta lo Libre y muestra una banda con "Listo".

Un bloque que queda completamente dentro de otro (el almuerzo dentro del horario de trabajo) se dibuja encima con una pequeña sangría y un anillo del color de la superficie, como Google Calendar; los que se pisan en parte se reparten el ancho.

### Check-in, resúmenes y reportes
- **Check-in:** hoja "¿Hiciste X?" con Sí, lo hice / No pude / Pasarlo a otro día. Se abre sola una vez por día si hay bloques vencidos sin marcar, y también desde el aviso "Tenés N bloques sin marcar".
- **Resumen de semana y mes:** al empezar un período nuevo, anillo que se dibuja con conteo del puntaje, comparación sin reproche y logros (medallas en círculo con anillo).
- **Reportes (Balance):** Semana / Mes / Año; barras apiladas por cuadrante (orden de gráfico Mente, Vínculos, Alma, Cuerpo, Trabajo, validado para daltonismo), línea de puntaje semanal, ranking de cumplimiento, recomendaciones con "Agendar un bloque", logros y edición del objetivo.

### Tres capas
Objetivo = marca fina; agendado = color suave; cumplido = color pleno dentro de lo agendado. Se usa en el anillo (aro exterior = objetivo; tramo suave = agendado que se llena al cumplir) y en las barras por cuadrante. Distribución y cumplimiento siempre con nombre propio, nunca mezclados en un solo número.

### Tarjetas de cuadrante
Sin anillo. Cada cuadrante es una tarjeta gris con dos lecturas que no se parecen: **% grande** sobre el 100% del tiempo despierto (con "obj. X%" y la diferencia en puntos) y una **barra de cumplido** verde (`--color-success`) sobre gris, con un brillo de líquido lento. Van ordenadas por peso y cada una es tan ancha como lo que pesa; Trabajo y Libre (no se marcan) van al final, más chicas y sin barra.

### Concepto: el balde
LifeBucket: tu vida es un balde de 168 horas por semana y cada parte de tu vida lo llena con su color. El isotipo es un balde con manija y agua en capas (Vínculos, Alma, Mente, Cuerpo) con una ola arriba; en la portada la ola se mueve despacio.

### Fondo
Manchas de color suaves (celeste, lavanda, rosa, durazno) fijas detrás de todo y, abajo, tres capas de olas de agua translúcidas que se desplazan muy lento (se frenan con reduced motion); las tarjetas blancas flotan encima. El rail y la barra inferior son translúcidos con desenfoque.

### Grilla que entra en pantalla
El alto de cada media hora se ajusta a la ventana (16–26 px) para que el día entero se vea sin scroll. Fichas angostas (≤104 px, container query): botones arriba y texto abajo con todo el ancho; si además son cortas, se oculta el check. Trabajo y Libre se dibujan planos, sin borde ni check.

### Semana ideal
A la izquierda, el 100% de tu tiempo despierto en una torta (porciones con 2px de separación) con la leyenda de horas y %, el selector Semana / Mes y el mensaje. A la derecha, los cuatro cuadrantes en dos columnas, cada uno con sus actividades, recomendaciones ("+ Yoga"), "+ Otra" y "No hago nada de esto" (colapsa y atenúa la tarjeta). Por cuadrante, sus actividades con "− 3 veces por semana +" y la duración. Trabajo y Libre al final como resultado (no se editan); si Libre queda negativo, se avisa en rojo y no se puede guardar.

### Mensajes ("Insight")
Una frase con un ícono de lamparita sobre un degradado suave (celeste → lavanda → rosa). Aparece en la portada, en cada paso del onboarding y en la semana ideal, donde cambia según lo que hacés. Corta, sin sermones: un dato o una pregunta.

### Base y Actividades
Arriba del balance, una barra con todas las horas del período: **Base** (Dormir, rayado; Libre, ocre) y **Actividades** (los cinco cuadrantes con su color). Con horas y %.

### Borrado rápido
Tachito en cada evento al pasar el mouse; borra al toque y muestra "Borraste X · Deshacer" por 6 segundos. En táctil se borra desde la edición.

### Sueño por día
La franja de sueño se toca para cambiar ese día ("Solo este día" o "Todos los días de semana / fines de semana"). El horario general está en el botón "Sueño" de la barra de la semana.

### Vista Balance
Arriba una tarjeta oscura (fondo tinta) con el anillo y tres métricas: Distribución, Cumplimiento y Balance real. Después "¿A dónde va tu 100%?" (barras al 100%: objetivo / agendado / cumplido), cumplimiento por cuadrante, tendencia con dos líneas, recomendaciones, misiones, sueño, ritual y logros.

### Balde de configuración
En el encabezado del arranque, un balde chico (silueta de balde con manija, borde de tinta) que se llena por capas: Dormir (tinta), Trabajo (gris), Cuerpo, Mente y Alma con sus colores; lo vacío es Libre. Al lado, el % lleno. En la pausa "Tu balde hoy", la versión grande con horas y % por capa y el selector Semana / Mes.

### Franjas de horarios
Dos filas de 24 h (05:00 a 05:00, celdas de media hora) donde se pinta con un pincel: Dormir (tinta), Trabajo (gris), Proyecto (gris lavanda) y Borrar. Arrastrar pinta todas las celdas que cruzás. Sin desplegables en el camino principal.

### Arranque en pantalla dividida
El calendario de la semana tipo siempre a la vista (derecha en escritorio, arriba en el celular); los pasos a la izquierda, con la parte ("Parte 1 · Tu semana hoy", "Parte 2 · Tu objetivo") arriba del título. En el encabezado, los pasos agrupados por parte y el balde.

### Comparación en columnas
Por cuadrante, dos columnas lado a lado con la misma escala (vos en color, la referencia en gris o punteada) y una etiqueta (+1 h, 1,8×, parejo). Trabajo y Libre van abajo como números para no aplastar al resto.

## Do's and Don'ts

### Do:
- **Do** dejar que el color venga solo de los cuadrantes (The Five Voices Rule).
- **Do** permitir completar cualquier bloque con un solo toque, desde la vista de semana o desde la notificación.
- **Do** celebrar lo cumplido con una micro-animación corta (≤400ms).
- **Do** usar áreas táctiles de 44px mínimo y respetar `prefers-reduced-motion`.
- **Do** escribir en español rioplatense, cálido y breve ("¿Fuiste al gimnasio?", "Seguimos mañana").

### Don't:
- **Don't** usar rojo, cruces ni tachados para lo no cumplido; lo no cumplido se apaga, no se castiga.
- **Don't** mostrar rachas que se rompen ni contadores de días fallados.
- **Don't** anotar reuniones, llamados ni mails: el calendario es de bloques grandes de rutina.
- **Don't** agregar un color de marca para la interfaz; el sexto color rompe la lectura del balance.
- **Don't** usar gradientes ni glassmorphism dentro de las tarjetas: el degradado vive solo en el fondo (y en los mensajes), y el vidrio solo en el rail y la barra inferior.
- **Don't** poner más de una acción primaria por pantalla.

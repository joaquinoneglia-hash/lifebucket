# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

Uso parejo en celular y compu. Responsive real: la planificación semanal en bloques es cómoda en desktop; el check-in rápido y los recordatorios ("¿fuiste al gimnasio?") viven en el celular.

## Stack

Next.js (App Router) + TypeScript + Tailwind v4. Datos en el navegador por ahora; Supabase (auth + base) es el paso siguiente.

## Users

Adultos con TDAH (empezando por el propio fundador) que se desbalancean: se meten de lleno en una sola área de su vida (típicamente el trabajo) y descuidan el resto. Necesitan **cuantificar y visualizar** su balance para sentir que no están perdiendo el tiempo. Su patrón conocido: arman un sistema de orden, a los tres días dejan de marcarlo, lo abandonan, vuelve el estrés y vuelve el desorden.

## Product Purpose

LifeBucket organiza la vida en **cinco cuadrantes** y muestra, como un gráfico de torta, qué porcentaje del tiempo real va a cada uno. El usuario define un balance objetivo (ej.: este mes 50% laboral, el resto repartido) y arma su semana con bloques de actividad asignados a cada cuadrante. La app recuerda, pregunta si se cumplió y muestra el balance logrado contra el objetivo.

Éxito: que el usuario siga usándolo después de la tercera semana, y que pueda ver de un vistazo si su vida está balanceada.

## Positioning

No es un calendario de reuniones ni una lista de tareas. Es un **planificador de balance de vida**: la unidad no es la cita con horario, es el bloque de vida asignado a un cuadrante, y el resultado no es "tareas hechas" sino "qué tan balanceada estuvo mi semana/mes". Diseñado desde la cabeza TDAH: cero fricción para marcar, tolerante a los abandonos.

## Operating Context

- **Ritual de revisión programable:** el usuario elige cuándo revisa su balance (domingo, un día fijo del mes, etc.) y la app le genera el recordatorio.
- **Armado semanal en bloques:** vista semanal con horarios fijos (6 a 24 h) para ver qué tiempo queda libre. Bloques que se crean con un clic en un horario y se arrastran entre días y horas.
- **Objetivos de balance:** porcentaje objetivo por cuadrante para un período (semana o mes).
- **Check-in de cumplimiento:** la app pregunta proactivamente si un bloque se cumplió; marcarlo tiene que tomar segundos.

## Capabilities and Constraints

Cuadrantes (confirmados), más **Libre** como sexta categoría del tiempo despierto:
1. **Cuerpo** — salud, gimnasio, deporte, sueño, alimentación.
2. **Mente** — lo intelectual: estudiar, aprender una habilidad, leer.
3. **Alma** — meditación, arte, espiritualidad, trabajar la cabeza desde lo creativo.
4. **Vínculos** — vida amorosa y vida social.
5. **Trabajo** — lo laboral.

Mente, Alma y Cuerpo forman el trío "superior" del ser; Vínculos y Trabajo son el afuera.

Decisiones tomadas:
- Los cinco cuadrantes son fijos.
- Un bloque se mide por tiempo, con duraciones simples: 30 min, 1 h o 2 h.
- Cada cuadrante tiene **actividades** (subcategorías: Gimnasio, Correr…). Se eligen como recomendación en el onboarding y se editan en la vista Actividades. Al agregar un bloque solo se muestran las del cuadrante elegido, con un botón para crear una nueva.
- Un bloque puede repetirse todos los días o de lunes a viernes; editar o borrar un evento repetido pregunta el alcance (solo este / este y los siguientes / todos), como Google Calendar.

- Los bloques tienen horario (grilla de 6 a 24 h en tramos de 30 min).
- Lo vencido sin marcar se revisa con un check-in (sí / no pude / pasarlo a otro día); mover un bloque no hecho lo recupera.
- Al cerrar cada semana y mes hay un resumen con logros; la vista Balance tiene reportes por semana, mes y año, recomendaciones y edición del objetivo.

- Al crear un bloque se elige directamente la actividad; el cuadrante sale de ella.
- Repetir: cualquier combinación de días de la semana.
- Asistente con IA (Claude): el usuario escribe o dicta qué quiere y recibe una propuesta de cambios que confirma antes de aplicar. Requiere ANTHROPIC_API_KEY en el servidor.

- **El día está 100% asignado.** No existen horas sin asignar: cada minuto despierto es una actividad o es **Libre** (sexta categoría: descanso, ocio sin plan, traslados, casa). Los huecos se completan solos como Libre; lo que no se hizo de una actividad cuenta como Libre vivido.
- **El sueño es el marco, no una actividad.** Horario fijo (uno de lunes a viernes, otro de fin de semana), no se agenda nada encima y **no entra en el balance**: el 100% es el tiempo despierto. En el ritual se marca noche por noche si se respetó y la app propone ajustar el horario si se viene corriendo.
- **Distribución y cumplimiento son conceptos separados**: distribución = cómo repartiste tu tiempo despierto contra el objetivo; cumplimiento = de lo agendado que ya pasó, cuánto hiciste.
- **Trabajo y Libre no se marcan**: son la base del día, como el sueño (Trabajo se respeta en su horario, Libre se vive). Solo Cuerpo, Mente, Alma y Vínculos tienen check y entran en el cumplimiento.
- **Objetivo desde tu semana ideal**: nadie piensa su vida en %, así que se arma en concreto ("Gimnasio, 3 veces por semana, 1 h") y el % sale solo. Trabajo viene de tus horarios y **Libre no se configura: es lo que sobra** (si te pasás, la app te avisa que no te alcanza la semana). Se ve por semana o por mes. Se define en el onboarding, se edita desde Balance y se revisa cada semana en el ritual (paso "Tu objetivo": mantener, igualar a la semana que termina o rearmar la semana ideal).
- **Mensajes que hacen caer la ficha**: en la portada y en cada paso de la configuración aparece una frase corta (un dato o una pregunta) sobre en qué se te va el tiempo; en la semana ideal reacciona a lo que hacés.
- **Arranque**: portada mínima (el balde grande + "Empezar a armar tu vida") y 8 pasos navegables desde la barra de arriba: Inicio, Sueño, Cuerpo, Mente, Alma, Vínculos, Trabajo (horarios) y Tu semana. Trabajo no tiene paso de actividades (es solo trabajo) y Libre tampoco (es lo que sobra).
- **Nombre y concepto**: LifeBucket. Tu vida es un balde de horas; la app te muestra con qué lo estás llenando.
- **Ritual de reprogramación** (domingo 19:00 por defecto, configurable): cómo venís → tu sueño → lo pendiente → cómo está armada la semana → misiones (IA con respaldo por reglas) → listo.
- **Objetivo inteligente**: una sola pregunta de prioridades (qué querés priorizar o venís descuidando) + recomendación (IA o reglas, con Trabajo calculado desde tus horarios). Se puede saltear y quedan los valores sugeridos. Propuesta de ajuste cuando un cuadrante viene bajo varias semanas.
- **Trabajo en el onboarding**: hasta dos trabajos (empleo + emprendimiento, por ejemplo) con días y horario; se crean como bloques que se repiten.
- **Semana base**: después del onboarding (y desde Actividades), primero se cargan rápido las cosas que se repiten (comidas, traslados, gimnasio…) y después se muestran los huecos libres de la semana para llenarlos, con un aviso de modo relleno en el calendario.

- Dos categorías grandes: **Base** (Dormir + Libre) y **Actividades** (los cinco cuadrantes), visibles arriba del balance.
- El sueño se ajusta por día (excepciones puntuales) además del horario de semana y finde.

Decisiones abiertas: canal de notificaciones fuera de la app (push en el celu).

## Brand Commitments

Nombre: LifeBucket. Idioma: español rioplatense.

Dirección visual elegida: limpia y estándar, a la altura de las apps modernas de productividad. La convención es el compromiso: ejecutarla con nivel de detalle alto, sin rarezas.

## Evidence on Hand

Ninguna todavía: sin usuarios, testimonios ni métricas. No inventar.

## Product Principles

1. **Marcar en segundos o no sirve.** Toda confirmación de cumplimiento tiene que poder hacerse con un toque, idealmente desde la notificación.
2. **Volver sin culpa.** Abandonar unos días es parte del uso esperado, no un fracaso. Retomar tiene que ser fácil y no castigar con rachas rotas ni pantallas en rojo.
3. **El balance se ve, no se lee.** El estado de la vida del usuario tiene que entenderse de un vistazo, visualmente, antes que con números o texto.
4. **Bloques, no reuniones.** Hay horarios para ver el tiempo libre, pero nada es rígido: todo se corre arrastrando y lo que no se hizo se recupera otro día.
5. **Ritual, no obligación.** La revisión periódica es un momento propio que el usuario programa, no un reproche de la app.

## Accessibility & Inclusion

Diseñado para usuarios con TDAH: baja carga cognitiva, una decisión por pantalla, pocas opciones visibles a la vez, recompensa visual inmediata al completar, nada de saturación de estímulos ni de alertas culpabilizantes.

## Arranque (versión actual)

Pantalla dividida: a la derecha (arriba en el celular) tu semana en un calendario que se va llenando; a la izquierda, los pasos. Arriba, el balde con el % de tu semana.

**Parte 1 · Tu semana hoy** (tal cual es, no como te gustaría)
1. **Horarios**: pintás franjas sobre las 24 h con un pincel (Dormir, Trabajo, Proyecto, Borrar): una fila para lunes a viernes y otra para el finde. Nombre del trabajo y del proyecto opcionales.
2. **Actividades**: escribís o dictás ("gimnasio 3 veces a la mañana") y se suma con su categoría (Cuerpo, Mente o Alma; Alma incluye lo vincular). Si no la reconoce, pregunta la categoría. Atajos con las más comunes. No hace falta completar las tres.
3. **Resumen**: "¿está todo?". El balde con horas y %, un comentario (IA o reglas) y la comparación en columnas contra una persona típica. Se puede volver a sumar algo.

**Parte 2 · Tu objetivo**
4. **Meta**: cuántas horas por semana querés para Cuerpo, Mente y Alma (al lado de las de hoy). Libre es lo que sobra.
5. **Semana ideal**: el calendario con tu semana de hoy punteada detrás; sumás actividades (escribiendo o tocando el calendario) y ves cuánto te falta para cada meta. Al confirmar, la semana ideal pasa a ser tu rutina y la meta tu objetivo; después empieza el seguimiento (marcar y el ritual del domingo).

- **"Contámelo hablando"**: la app pregunta en voz alta (ElevenLabs, con la voz del navegador como respaldo), escucha y completa la parte 1.

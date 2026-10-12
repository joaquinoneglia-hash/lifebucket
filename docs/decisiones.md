# Decisiones

Registro de decisiones de producto, diseño y técnicas. Una entrada por decisión, la más nueva arriba: fecha, qué se decidió y por qué.

## 2026-10-11 · Bienvenida, guía y ajustes para el celular

- Bienvenida una vez por cuenta (nombre de Google, intro sonora sintetizada) y guía de 10 consejos que resalta cada parte; se puede volver a ver desde el menú de la cuenta.
- En pantallas táctiles la grilla imita a la web: tocar crea (1 h) o abre; arrastrar marca un horario, mueve o estira. Dentro del calendario el dedo no scrollea (touch-action: none); se scrollea desde la columna de horas o fuera del calendario. Se apagó "tirar para recargar" (overscroll-behavior: none) porque recargaba la página al arrastrar.
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

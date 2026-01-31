# Colores: psicología humana y marketing

Este documento explica la paleta de la app desde la **psicología del color** y principios de **marketing/UX** para que el sitio transmita confianza, guste y motive a quedarse.

---

## Por qué importa el color

- Las personas forman una opinión sobre un sitio en **menos de 50 milisegundos**, y el color pesa mucho en esa primera impresión.
- Cambiar solo el color de un botón puede **aumentar conversiones** en porcentajes de dos cifras.
- El color actúa como "narrador no verbal": influye en emociones, decisiones y sensación de confianza sin que el usuario lo racionalice.

Para una app de **asambleas y votación**, necesitamos sobre todo **confianza**, **calma** y **claridad**, sin sensación de agresividad o desconfianza.

---

## Principios aplicados

### 1. Regla 60-30-10

- **60%** – Color dominante (fondo): neutros que no compiten con el contenido. Aquí usamos un gris muy suave con un **ligero calor** (`#fafaf9` en claro, `#0c0a09` en oscuro) para que el entorno se sienta acogedor y no frío o clínico.
- **30%** – Color secundario: superficies (tarjetas, inputs). Blanco o gris muy claro para dar contraste y orden.
- **10%** – Acento: botones principales, enlaces y elementos que quieren "acción". Un solo color (primary) para no dispersar la atención.

### 2. Psicología por color

| Color / Uso | Efecto psicológico | Uso en la app |
|-------------|--------------------|----------------|
| **Azul / Índigo (primary)** | Confianza, calma, profesionalidad (Stripe, Dropbox, LinkedIn). Reduce ansiedad y transmite seguridad. | Botones principales, enlaces, focus, íconos de acción. Ideal para votación y gestión seria. |
| **Verde esmeralda (success)** | Crecimiento, éxito, "todo bien", progreso. Refuerza confirmaciones y resultados positivos. | Toasts de éxito, indicadores de quórum alcanzado, avance de votaciones, botones de "completado". |
| **Rojo suave (error)** | Alerta y "stop", pero sin sensación agresiva si se usa solo donde hace falta. | Errores, validaciones, acciones destructivas (eliminar, revocar). No en fondos ni en elementos que no sean de alerta. |
| **Neutros cálidos** | Sensación de acogida y orden. Un fondo ligeramente cálido (vs. gris puro) hace que el sitio se perciba más amable. | Fondos generales (`--background`), superficies secundarias. |

### 3. Coherencia y retención

- **Paleta reducida**: 2–3 colores principales + neutros. Menos ruido visual y menos esfuerzo mental → más comodidad y más ganas de quedarse.
- **Mismo significado, mismo color**: primary siempre para "acción principal", success para "éxito/progreso", error para "problema/destructivo". Así el usuario aprende rápido y se siente en control.
- **Contraste**: texto sobre fondo con ratio ≥ 4.5:1 (WCAG) para legibilidad y accesibilidad.

---

## Variables CSS y uso en Tailwind

Toda la paleta está centralizada en `app/globals.css` y expuesta en `tailwind.config.ts`:

| Variable / Token | Uso recomendado |
|------------------|------------------|
| `--background` / `bg-background` | Fondo de página (60%). |
| `--foreground` / `text-foreground` | Texto principal. |
| `--color-primary` / `bg-primary`, `text-primary` | Botones principales, enlaces, focus. |
| `primary-hover` | Estado hover de botones/links primary. |
| `primary-light` | Fondos suaves detrás de elementos primary (badges, chips). |
| `--color-success` / `success`, `success-light` | Mensajes de éxito, progreso, indicadores positivos. |
| `--color-error` / `error`, `error-light` | Mensajes de error, botones destructivos. |
| `surface`, `surface-muted` | Tarjetas, inputs, zonas secundarias (30%). |
| `border`, `border-focus` | Bordes y anillo de focus. |

Así, si en el futuro quieres ajustar "confianza" o "calidez", cambias una variable y se refleja en toda la app.

---

## Cómo seguir mejorando

1. **Mantener la regla 60-30-10**: no introducir muchos acentos nuevos; reservar el 10% para primary (y algo de success donde corresponda).
2. **Probar con usuarios**: A/B tests en botones (por ejemplo primary vs. otro tono) para ver qué mejora más la acción deseada.
3. **Revisar contraste**: usar herramientas tipo WebAIM o inspección de DevTools para asegurar 4.5:1 en texto.
4. **Modo oscuro**: las variables ya tienen variantes `prefers-color-scheme: dark`; al añadir pantallas nuevas, usar los mismos tokens para mantener coherencia.

---

## Referencias rápidas

- Psicología del color en UX: [Toptal – Color Psychology](https://www.toptal.com/designers/ux/color-psychology), [UXMatters – Color Psychology](https://www.uxmatters.com/mt/archives/2023/12/color-psychology-in-visual-design-a-practical-guide-to-impacting-user-behavior.php).
- Regla 60-30-10: [UX Planet – 60-30-10 Rule](https://uxplanet.org/the-60-30-10-rule-a-foolproof-way-to-choose-colors-for-your-ui-design-d15625e56d25).
- SaaS y conversión: paletas que priorizan confianza (azul/índigo) y éxito (verde) mejoran engagement y percepción de profesionalidad.

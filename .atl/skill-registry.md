# Skill Registry

**Delegator use only.** Any agent that launches sub-agents reads this registry to resolve compact rules, then injects them directly into sub-agent prompts. Sub-agents do NOT read this registry or individual SKILL.md files.

Generado por `/sdd-init` el 2026-04-06. Re-ejecutar `skill-registry` o `/sdd-init` tras instalar o quitar skills.

## User Skills

| Trigger | Skill | Path |
|---------|-------|------|
| GitHub issue, bug, feature | issue-creation | `C:\Users\Alvaro Contreras\.claude\skills\issue-creation\SKILL.md` |
| PR, pull request, review | branch-pr | `C:\Users\Alvaro Contreras\.claude\skills\branch-pr\SKILL.md` |
| crear skill, Agent Skills spec | skill-creator | `C:\Users\Alvaro Contreras\.claude\skills\skill-creator\SKILL.md` |
| Go tests, teatest, Bubbletea | go-testing | `C:\Users\Alvaro Contreras\.claude\skills\go-testing\SKILL.md` |
| judgment day, dual review, juzgar | judgment-day | `C:\Users\Alvaro Contreras\.claude\skills\judgment-day\SKILL.md` |
| PR merge-ready, CI, conflict loop | babysit | `C:\Users\Alvaro Contreras\.cursor\skills-cursor\babysit\SKILL.md` |
| .cursor/rules, RULE.md, AGENTS.md | create-rule | `C:\Users\Alvaro Contreras\.cursor\skills-cursor\create-rule\SKILL.md` |
| settings.json, editor prefs | update-cursor-settings | `C:\Users\Alvaro Contreras\.cursor\skills-cursor\update-cursor-settings\SKILL.md` |
| crear skill en Cursor | create-skill | `C:\Users\Alvaro Contreras\.cursor\skills-cursor\create-skill\SKILL.md` |
| migrar a skills | migrate-to-skills | `C:\Users\Alvaro Contreras\.cursor\skills-cursor\migrate-to-skills\SKILL.md` |
| subagent | create-subagent | `C:\Users\Alvaro Contreras\.cursor\skills-cursor\create-subagent\SKILL.md` |
| shell specialist | shell | `C:\Users\Alvaro Contreras\.cursor\skills-cursor\shell\SKILL.md` |

> Skills `sdd-*` y `skill-registry` se omiten aquí (flujo SDD / meta).

## Project Conventions (asambleas-app)

| Recurso | Rol |
|---------|-----|
| `.cursor/rules/nextjs.mdc` | App Router, Server/Client Components, loading/error |
| `.cursor/rules/supabase.mdc` | Cliente `lib/supabase`, RLS, errores explícitos |
| `.cursor/rules/typescript.mdc` | Tipado estricto, tipos generados Supabase |
| `.cursor/rules/principios-producto-ux.mdc` | Mobile-first, accesibilidad, flujos claros |
| `.cursor/rules/diseno-moderno-tipografia.mdc` | Tipografía y UI limpia |
| `.cursor/rules/rendimiento-escalabilidad.mdc` | Rendimiento y payloads |
| `.cursor/rules/frontend-responsive-usabilidad.mdc` | Responsive |
| `.cursor/rules/design-ui.mdc` | Diseño UI (si aplica) |
| `.cursor/rules/actualizar-git-al-finalizar.mdc` | Commit/push al cerrar tareas con cambios |

No hay `AGENTS.md` ni `.cursorrules` en la raíz del proyecto.

## Compact Rules

### issue-creation
- Usar plantilla de issue (issues en blanco deshabilitados en flujo ATL).
- Issue nuevo lleva `status:needs-review`; PR solo tras `status:approved` por mantenedor.

### branch-pr
- Cada PR debe enlazar un issue aprobado y una etiqueta `type:*`.
- Checks automáticos deben pasar antes de merge.

### skill-creator
- Seguir Agent Skills spec; frontmatter con name/description/trigger.
- Skills para patrones repetidos o convenciones de proyecto.

### go-testing
- Solo aplica a código Go (este repo es TS/Next); ignorar para asambleas-app salvo otro workspace.

### judgment-day
- Dos revisores adversarios en paralelo; sintetizar, corregir, re-juzgar; máx. 2 iteraciones salvo escalación.

### babysit
- Revisar comentarios del PR antes de cambios; conflictos solo si el intent es claro; CI verde y mergeable.

### create-rule
- Reglas en `.cursor/rules/`; scope por globs cuando aplique; no duplicar guías ya cubiertas.

### update-cursor-settings
- Cambios en `settings.json` del usuario; no romper formato JSON.

### create-skill / migrate-to-skills / create-subagent / shell
- Usar según el skill correspondiente cuando el usuario pida crear skills, migrar, subagentes o ejecución shell especializada.

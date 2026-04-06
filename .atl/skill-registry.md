# Skill Registry

**Delegator use only.** Any agent that launches sub-agents reads this registry to resolve compact rules, then injects them directly into sub-agent prompts. Sub-agents do NOT read this registry or individual SKILL.md files.

**Actualizado:** 2026-04-06 — incluye regla `agent-tareas-grandes-memoria.mdc`.

## User Skills

| Trigger | Skill | Path |
|---------|-------|------|
| GitHub issue, bug, feature | issue-creation | `C:\Users\Alvaro Contreras\.claude\skills\issue-creation\SKILL.md` |
| PR, pull request, review | branch-pr | `C:\Users\Alvaro Contreras\.claude\skills\branch-pr\SKILL.md` |
| crear skill (spec Agent Skills) | skill-creator | `C:\Users\Alvaro Contreras\.claude\skills\skill-creator\SKILL.md` |
| Go tests, teatest, Bubbletea | go-testing | `C:\Users\Alvaro Contreras\.claude\skills\go-testing\SKILL.md` |
| judgment day, dual review, juzgar | judgment-day | `C:\Users\Alvaro Contreras\.claude\skills\judgment-day\SKILL.md` |
| PR merge-ready, CI, conflict loop | babysit | `C:\Users\Alvaro Contreras\.cursor\skills-cursor\babysit\SKILL.md` |
| .cursor/rules, RULE.md, AGENTS.md | create-rule | `C:\Users\Alvaro Contreras\.cursor\skills-cursor\create-rule\SKILL.md` |
| settings.json, editor prefs | update-cursor-settings | `C:\Users\Alvaro Contreras\.cursor\skills-cursor\update-cursor-settings\SKILL.md` |
| crear skill en Cursor, SKILL.md format | create-skill | `C:\Users\Alvaro Contreras\.cursor\skills-cursor\create-skill\SKILL.md` |
| migrar .mdc / commands a skills | migrate-to-skills | `C:\Users\Alvaro Contreras\.cursor\skills-cursor\migrate-to-skills\SKILL.md` |
| subagent, .cursor/agents | create-subagent | `C:\Users\Alvaro Contreras\.cursor\skills-cursor\create-subagent\SKILL.md` |
| invocación /shell literal | shell | `C:\Users\Alvaro Contreras\.cursor\skills-cursor\shell\SKILL.md` |

> Omitidos: `sdd-*`, `_shared`, `skill-registry` (flujo SDD / meta).

## Project Conventions

| File | Path | Notes |
|------|------|-------|
| nextjs.mdc | `.cursor/rules/nextjs.mdc` | App Router, Server/Client Components, loading/error |
| supabase.mdc | `.cursor/rules/supabase.mdc` | Cliente `lib/supabase`, RLS, errores explícitos |
| typescript.mdc | `.cursor/rules/typescript.mdc` | Tipado estricto, tipos generados Supabase |
| principios-producto-ux.mdc | `.cursor/rules/principios-producto-ux.mdc` | Mobile-first, accesibilidad, flujos |
| diseno-moderno-tipografia.mdc | `.cursor/rules/diseno-moderno-tipografia.mdc` | Tipografía y UI |
| rendimiento-escalabilidad.mdc | `.cursor/rules/rendimiento-escalabilidad.mdc` | Rendimiento, payloads |
| frontend-responsive-usabilidad.mdc | `.cursor/rules/frontend-responsive-usabilidad.mdc` | Responsive |
| design-ui.mdc | `.cursor/rules/design-ui.mdc` | Diseño UI |
| actualizar-git-al-finalizar.mdc | `.cursor/rules/actualizar-git-al-finalizar.mdc` | Commit/push al cerrar tareas con cambios |
| agent-tareas-grandes-memoria.mdc | `.cursor/rules/agent-tareas-grandes-memoria.mdc` | Tareas grandes / arquitectura: explorar repo; mem_save en Engram cuando amerite |

No hay `AGENTS.md`, `CLAUDE.md` ni `.cursorrules` en la raíz del repositorio.

## Compact Rules

### issue-creation
- Issues con plantilla ATL; en blanco deshabilitados en ese flujo.
- Nuevo issue → `status:needs-review`; merge/PR según reglas del repo que enlacen issue aprobado.

### branch-pr
- PR enlazado a issue aprobado y etiqueta `type:*` donde aplique el flujo ATL.
- Checks en verde antes de merge.

### skill-creator
- Agent Skills spec: frontmatter `name`, `description`, triggers claros.
- Skills para patrones repetidos o convenciones no obvias.

### go-testing
- Stack Go / Gentleman.Dots; **no aplica** al código TS/Next de asambleas-app salvo que trabajes en otro repo.

### judgment-day
- Dos jueces en paralelo; sintetizar hallazgos, aplicar fixes, re-juzgar; tope típico 2 iteraciones.

### babysit
- Triaje de comentarios del PR; conflictos solo con intención clara; iterar hasta CI verde y mergeable.

### create-rule
- Reglas en `.cursor/rules/*.mdc`; globs y `alwaysApply` según alcance; evitar duplicar reglas ya cubiertas.

### update-cursor-settings
- Editar `settings.json` del usuario con cuidado; validar JSON y no borrar claves ajenas al cambio.

### create-skill
- Skill = directorio con `SKILL.md`; personal `~/.cursor/skills/`, proyecto `.cursor/skills/`; **no** escribir en `~/.cursor/skills-cursor/` (reservado).
- Frontmatter YAML + cuerpo con instrucciones accionables; opcional `reference.md`, `scripts/`.

### migrate-to-skills
- Copiar **verbatim** el cuerpo de reglas/comandos al migrar `.mdc` / `.md` → `.cursor/skills/*/SKILL.md`.
- Candidatos: reglas con `description` sin `globs` y sin `alwaysApply: true`; comandos: todos.

### create-subagent
- Definir `.md` en `.cursor/agents/` (proyecto) o `~/.cursor/agents/` (usuario); frontmatter `name`, `description` + prompt sistema en el cuerpo.

### shell
- Solo con invocación explícita `/shell`: ejecutar el texto siguiente **literal** en terminal; no reescribir el comando; si falta texto, pedir el comando.

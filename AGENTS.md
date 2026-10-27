# Agent guidance

## Scope

This repository owns the ZenStream browser client. The Orchestrator owns catalog data, account authorization, persistence, and media negotiation. Keep browser presentation and local preferences here; make API contract changes in the Orchestrator repository.

## Repository map

- `app/` — Next.js route entry points and route layouts.
- `components/` — page, player, layout, and shared UI components.
- `lib/` — API clients, browser state, authentication helpers, and shared domain logic.
- `test/` — Vitest unit and component tests.
- `public/` — static assets and generated service-worker support files.
- `docs/` — architecture, UI design, and behavior guides.

## Important boundaries

- Browser requests go through the Orchestrator client APIs. Do not add direct provider or database access.
- Private artwork uses the authenticated Orchestrator image routes and a session-bound in-memory capability. Do not add private artwork to a persistent browser or service-worker cache.
- Browser-local sound and playback-behavior preferences remain separate from account preferences; see `docs/playback.md`.
- Audio and video have separate route and player ownership. Read `docs/playback.md` before changing either player or queue behavior.
- Use Lucide icons from `lucide-react` for new or changed controls.
- Before interface changes, read `docs/ui-design.md` and inspect the closest existing screen. Reuse its visual system and navigation patterns, and review the changed flow against that reference.

## Commands

- `pnpm dev` — start the web development server.
- `pnpm format:check` — check supported source and Markdown formatting.
- `pnpm lint` — run ESLint.
- `pnpm test` — run Vitest.
- `pnpm build` — build the Next.js application.

## Documentation conventions

- Use the same README structure across all four repositories: `How it fits together`, `Configuration`, `Quick start`, `Deployment`, `Development checks`, `Developer documentation`, `Troubleshooting`, `Releases`, and `License`, in that order where relevant. Keep a project title and one-sentence summary at the top; place optional screenshots after the overview and first-run or platform-specific steps under the relevant section.
- Use sentence-case headings, short paragraphs, descriptive links, and relative paths within this repository.
- Architecture documents explain ownership, major flows, and source paths. Behavior documents cover one domain and link to implementation and tests. Do not copy every implementation detail into this file.
- Update `docs/ui-design.md` when shared visual or navigation patterns change; keep feature-specific behavior in its focused guide.

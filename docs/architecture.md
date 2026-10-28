# Web architecture

## Scope and ownership

The web application is the browser client for ZenStream. It owns page rendering, browser navigation, and browser-local presentation preferences. The Orchestrator owns catalog and account data, authorization, persistence, image delivery, and playback negotiation. The Android client is implemented in a separate repository.

## Application flow

The root layout in `app/layout.tsx` loads global styles, runtime configuration, progress state, and the `AppRouteShell`. Routes under `app/` compose page-level features from `components/`. Shared request and domain behavior belongs in `lib/` rather than being reimplemented in individual pages.

Authenticated requests flow through the shared request and API helpers in `lib/`. Catalog, account, calendar, notification, playlist, and playback helpers should keep their endpoint-specific parsing and error handling close to the client code that owns them.

## State ownership

- Orchestrator-backed state includes accounts, catalog records, access grants, playback tickets or leases, and persisted account preferences.
- Browser-local state includes web-only playback behavior and sound preferences. Do not move these values into account APIs without an explicit contract change.
- `components/audio/audio-player-provider.tsx` owns the navigation-scoped audio queue above route branches. The video player and SyncPlay have separate ownership and behavior; see [playback](playback.md).

## Private artwork

Catalog artwork and person portraits use `next/image` with the existing Orchestrator image routes. Access uses a session-bound, in-memory `artwork` capability and the content invalidation key. Keep the route, query, and cache behavior aligned with `lib/` and the Orchestrator contract. Do not persist private artwork in the service worker or another long-lived browser cache.

## Repository map

- `app/` — route composition and layouts.
- `components/` — reusable UI and feature components.
- `lib/` — Orchestrator clients, session helpers, domain utilities, and browser-local preferences.
- `locale/` — translation resources and language support.
- `test/` — Vitest coverage for shared logic and user-facing behavior.
- `scripts/` — build support, including service-worker generation.

## Change guidance

For an API change, update the Orchestrator-owned contract first and keep client fixtures in sync. For UI changes, follow [web interface design](ui-design.md). For player, queue, or playback-preference changes, read [video and audio playback](playback.md).

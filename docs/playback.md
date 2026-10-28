# Video and audio playback

## Ownership

Video playback is owned by the video player components and `lib/` playback helpers. Audio playback is owned by the album and artist routes plus `components/audio/audio-player-provider.tsx`, whose queue survives navigation between route branches. Keep these state machines separate.

## Audio behavior

- Audio routes are `/album/:albumId` and `/artist/:artistId`. The provider owns the selected queue, current entry, shuffle/repeat pass, and lyrics prefetch.
- Starting a specifically selected queue entry starts it at zero; selecting the current entry resumes it. Preserve the stable queue entry identity when reordering or changing routes.
- Keep audio out of the video hero, SyncPlay, and full-screen video player.
- Audio sound preferences are browser-local and stored separately from video sound preferences. They do not belong in Orchestrator account preferences.
- Music artwork colors and artist/release credits use the shared helpers in `lib/music.ts` and the existing authenticated artwork routes.

## Video behavior

- Playback negotiation and media readiness determine whether a source is usable. Preference loading is best-effort and must not prevent playback when it fails or is aborted.
- Keep autoplay-next-episode separate from autoplay-browse. The browse setting gates hover previews; it does not authorize automatic episode transitions.
- Preserve the mini-player as a video-only continuation surface. Changes to mini-player persistence or navigation should keep the active source and its negotiated access valid.
- SyncPlay is for video playback. Do not add audio queue state to its protocol.

## Change and verification route

Use the nearest player or audio tests under `test/` as the starting point. Read the relevant provider and helper before changing behavior; update focused tests when the user-visible playback contract changes. Orchestrator owns source negotiation and access contracts.

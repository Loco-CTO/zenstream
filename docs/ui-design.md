# Web interface design

## Design goal

Every new screen and control should feel like part of the existing ZenStream client. A person should be able to identify their location, find the next useful action, understand the result, and return to where they started without learning a new interaction pattern.

## Start from the existing design

Before changing UI, choose the closest existing screen with the same task and inspect its layout and shared components. Use that screen as the comparison throughout the change.

| Concern                             | Existing reference                                                                                                                                            |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Colors, surfaces, radii, font roles | [Global styles](../app/globals.css) and [root layout](../app/layout.tsx)                                                                                      |
| Shared shell and navigation         | [App shell](../components/app-shell.tsx), [navbar](../components/layout/navbar.tsx), and [mobile navigation](../components/layout/mobile-nav.tsx)             |
| Search and return behavior          | [Search overlay](../components/layout/search-overlay.tsx) and [search page](../components/pages/search-page.tsx)                                              |
| Buttons, choices, and feedback      | [Primary action button](../components/ui/primary-action-button.tsx), [dropdown](../components/ui/dropdown.tsx), and [toast](../components/ui/toast.tsx)       |
| Browsing and media details          | [Media card](../components/home/media-card.tsx), [library page](../components/pages/library-page.tsx), and [detail page](../components/pages/detail-page.tsx) |
| Account forms and dialogs           | [Settings page](../components/pages/settings-page.tsx) and [password dialog](../components/account/change-password-modal.tsx)                                 |

Reuse an existing component when it fits. Extend the shared component when a reusable variation is needed. Introducing a new visual system, navigation model, font, or icon family is a separate design change; ordinary feature work should match the current product. Existing code is a visual reference, not proof that its accessibility or behavior is correct.

## Navigation and task flow

- Keep global destinations, labels, relative order, and active-state treatment consistent with the shared navigation. Place actions that affect one item beside that item.
- Use a page for a destination people revisit or link to, tabs for peer views within a destination, a menu for short contextual actions, and a dialog for a bounded task. Avoid nested dialogs and competing navigation bars.
- Preserve browser Back/Forward, meaningful URLs, and normal link behavior. Opening a detail or secondary surface should retain the originating query, filters, and list position where that flow supports returning.
- Make Back, Close, and Cancel do what their labels imply. Closing a temporary surface returns to its caller; it should not unexpectedly send people Home or clear their work.
- Keep common tasks directly discoverable. Secondary actions may use an overflow menu, but essential actions must not depend on hover, remembering a gesture, or guessing an unlabeled icon.
- Use the fewest understandable steps. Do not combine unrelated settings into one screen just to reduce clicks. Follow [playback ownership](playback.md) when navigation intersects active media.

## Layout and information density

- Start with the page title and task context, then the main content and dominant action. Give supporting actions less visual weight and keep them near what they affect.
- Match the nearest screen's content width, edge padding, spacing rhythm, card geometry, and alignment. Reuse its list or grid pattern instead of wrapping every item in a new card.
- Show information needed to decide or act now. Put long descriptions, infrequent settings, and diagnostic detail behind clearly labeled disclosure. Keep critical status and consequences visible.
- Use one label for one concept across pages. Prefer specific actions such as "Save changes" or "Remove from playlist" over vague labels such as "Apply" when the outcome would be unclear.
- Avoid repeated headings, decorative badges, duplicate summaries, and explanatory paragraphs that merely restate the controls. Minimal presentation must still explain an unavailable action or a failed operation.

## Visual language

- Use the existing dark neutral surfaces, Noto Sans typography, CSS variables, and shared Tailwind patterns. Match button height, radius, icon size, stroke, and text weight to the corresponding role in adjacent screens.
- Preserve the existing white primary media-action treatment and the accent roles of the owning component. Do not make every button violet or invent a feature-specific gradient, shadow, font scale, or palette.
- Use Lucide icons from `lucide-react`. Keep the same icon and selected-state treatment for the same action. Add visible text when meaning is ambiguous; tooltips supplement labels.
- Allow long titles and translated labels to wrap appropriately. Use truncation only when the full value remains available in an accessible detail view.
- Use restrained motion to explain transitions. Respect reduced-motion preferences and avoid layout shifts or animation that delays interaction.

## Interaction and feedback

- Provide immediate pressed, selected, pending, and completed feedback. Disable only the action that cannot safely repeat while it is pending; keep navigation and recovery available.
- Keep useful content visible during refresh where safe. Distinguish initial loading, an empty library, no filter matches, permission limits, and a failed request.
- Errors should name the failed task and offer a useful next step. Retain form values after failure and put field errors beside labeled fields; never rely on a disappearing toast for essential recovery.
- Follow the existing form save model. State whether a setting saves immediately or needs Save; expose unsaved changes when leaving could lose work. Use confirmations for consequential destructive actions, not routine navigation.
- Dialogs need a clear title, an obvious exit, sensible initial focus, contained keyboard focus, and focus restoration on close. Do not silently discard edited values through accidental backdrop dismissal.

## Platform behavior and accessibility

- Meet WCAG 2.2 AA for changed UI. Use semantic links, buttons, headings, labels, and status announcements; keep keyboard order aligned with the visual task.
- Make controls keyboard, pointer, and touch usable. Provide visible focus, accessible icon names, and an alternative to dragging. Never expose functionality only on hover.
- Pointer targets must meet the 24 by 24 CSS pixel minimum or an applicable WCAG exception. Prefer larger, well-spaced targets for frequent touch actions; do not shrink the shared button geometry to fit more controls.
- Check narrow mobile widths, short landscape windows, text zoom, and long translations. Menus and dialogs must fit the viewport, with focused controls clear of sticky navigation, safe areas, and persistent players.
- Keep state legible without color alone. Check contrast on artwork, overlays, muted text, disabled controls, and focus indicators.

## Review checklist

Before calling a UI change complete, review the affected flow and record which checks were actually performed:

- [ ] Name the existing screen/component used as the design reference and compare it with the change at the same viewport size.
- [ ] A person unfamiliar with the feature can find the main action from its label and see where they are.
- [ ] Back, Close, browser history, filters, and return position behave predictably.
- [ ] Typography, spacing, colors, icons, and control states match the surrounding client.
- [ ] Loading, empty, error, pending, success, and unavailable states are understandable and recoverable where applicable.
- [ ] Keyboard/focus behavior, touch access, narrow layouts, enlarged text, and persistent-player overlap have been reviewed.

A code build alone does not establish visual or navigation acceptance. If a relevant visual or interaction check was not possible, say which one remains unverified.

## Design references

- [Nielsen Norman Group: usability heuristics](https://www.nngroup.com/articles/ten-usability-heuristics/)
- [W3C: consistent navigation](https://www.w3.org/WAI/WCAG22/Understanding/consistent-navigation.html)
- [W3C: Web Content Accessibility Guidelines 2.2](https://www.w3.org/TR/WCAG22/)
- [W3C: target size minimum](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html)
- [W3C: modal dialog interaction](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/)

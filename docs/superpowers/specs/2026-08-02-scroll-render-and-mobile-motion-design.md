# NIO Radio Scroll Rendering And Mobile Motion Design

## Summary

Repair the mobile home-screen rendering glitch captured in the supplied video and add restrained transitions for the full album directory and the playback queue. The application remains a static React PWA for phone browsers, with no backend or audio-delivery changes.

The video shows a layout feedback loop rather than an isolated text-paint defect. Around 7.90s, 9.63s, and 10.37s, the header, list, and recommendation panel alternate between old and new states while the browser chrome and fixed mini-player remain stable.

## Root Cause

`HomeScreen` sets `scrolled` when `window.scrollY > 180`. The same state currently removes the recommendation panel from the document when `scrolled` becomes true. Removing that panel reduces document height by roughly 250px, which can move the browser scroll position back below the threshold. The next scroll event remounts the panel, producing a repeated `NIO Radio`/`今日推荐` state change and large layout and paint invalidations during inertial scrolling.

The prior CSS change removed two additional mobile compositing triggers, but it did not remove this state/layout feedback loop.

## Goals

- Keep the recommendation panel mounted while the home screen is active so scroll state cannot change document height.
- Keep the existing compact header behavior: show `NIO Radio` near the top, and show `今日推荐` plus the optional continue action after scrolling past the recommendation area.
- Make the full album directory enter from the right when opened from Home and allow the reverse direction when navigating back.
- Make the playback queue backdrop fade in while the sheet rises from the bottom, with a faster reverse exit.
- Apply the same queue dismissal lifecycle to the close button, backdrop, Escape, browser Back, and downward swipe.
- Preserve scroll restoration, playback state, route history, keyboard focus, and the existing 320-430px phone layout.
- Respect `prefers-reduced-motion` with an effectively immediate transition.

## Non-goals

- No new animation dependency.
- No full old/new page snapshot transition or View Transitions API requirement.
- No scroll-triggered decorative reveals or page-load choreography.
- No redesign of colors, copy, catalog fetching, audio caching, or backend behavior.
- No simultaneous rendering of two long catalog lists during a page transition.

## Home Scroll Stability

The recommendation section remains in normal document flow regardless of `scrolled`. The scroll listener only updates header state and is initialized once on mount so a restored non-zero position receives the correct header immediately. The header state must not add or remove content above the list.

The implementation may keep the existing `scrollY > 180` threshold because it is stable once document height is decoupled. It must not conditionally mount or unmount the recommendation section from that state.

## Route Motion

Internal route changes use a small route-transition direction value (`forward`, `back`, or `none`) in addition to the parsed route. The direction is set by the navigation action that initiated the change; an initial render has no animation. A route update that represents the same screen and album, such as adding or removing the queue query, does not replay the page transition.

The visible destination screen receives a stable route key and an entrance class:

- Home to Albums: `forward`, translate from the right by approximately 16px while fading to full opacity over 180ms.
- Albums or Album back to a parent: `back`, translate from the left by approximately 16px over the same duration.
- Search and album detail use the same direction vocabulary so Back remains predictable, but no second long list is kept mounted.

The animation uses `transform` and `opacity` with an ease-out quintic curve. Sticky headers and the fixed mini-player are not independently animated.

The existing route event listeners can receive both `popstate` and `hashchange` for one browser action. Applying a parsed route only when it differs from the current route prevents a duplicate event from resetting the direction or replaying the animation.

Scroll restoration runs before the destination paint where possible, using the existing per-route positions. Queue query changes preserve the underlying screen and its scroll position.

## Playback Queue Motion

Opening the queue mounts the overlay immediately. The backdrop fades from transparent to its current scrim color over 150ms. The sheet rises using `translate3d(-50%, 100%, 0)` to `translate3d(-50%, 0, 0)` over 220ms.

Closing changes the route immediately so browser history and the URL reflect the closed state, but keeps the overlay mounted as a closing presence. The sheet exits over 170ms and the backdrop fades out over 140ms. The presence is removed when the sheet's own animation ends. A roughly 250ms fallback timer handles background tabs or browsers that do not dispatch `animationend`; the timer is cancelled if the queue is reopened.

All close paths call the same dismissal function. When the queue was opened from an in-app history entry, browser Back removes that entry first; a direct queue URL uses the existing replacement behavior. Downward swipe only dismisses after the existing 80px threshold.

Before opening, capture the current active element. On entry, focus the close button. After the exit animation and unmount, restore focus to the queue trigger with `preventScroll: true` when the trigger still exists. Child animation events must not remove the sheet.

## Reduced Motion And Performance

The motion is CSS-only and bounded to transform and opacity. No persistent `will-change`, blur, or filter is added. The existing reduced-motion media query reduces animation and transition durations to an immediate value and keeps the route/queue state changes functional.

## Testing

Follow TDD for each behavior: add a focused failing test, verify the expected failure, implement the smallest change, then rerun the focused and full suites.

Automated coverage must include:

- Scrolling across the threshold leaves the recommendation panel mounted and does not alter the home structure.
- A restored scroll position initializes the correct compact header state.
- Home to Albums gets `forward`; returning gets `back`; duplicate `popstate` plus `hashchange` does not replay or clear the direction.
- Queue opening shows the dialog and opening state; close, backdrop, Escape, browser Back, and swipe all enter the same closing state.
- The queue remains mounted while closing and unmounts after its own animation event or the fallback timer.
- A child animation event cannot unmount the queue; reopening cancels an old fallback timer.
- Queue close restores focus to the queue trigger without changing the saved scroll position.
- Existing route, queue, playback, cache, and rendering regression tests continue to pass.

Browser verification covers the supplied `480x1102` phone-sized viewport plus `320x568` and `390x844`: five fast up/down scroll cycles, Home to Albums and Back, queue open/close through each primary path, reduced-motion mode, no horizontal overflow, no visible title/list ghosting, and no console errors.

## Deployment

After implementation and verification:

1. Run the focused tests, full Vitest suite, lint, production build, dependency audit, and `git diff --check`.
2. Push the source branch to `main` through the existing repository workflow.
3. Run `npm run deploy` to publish `dist` to GitHub Pages.
4. Recheck the live page with a cache-busting URL and the same mobile scroll and interaction flows.

## Acceptance Criteria

- The recommendation panel remains mounted while scrolling and `document.scrollHeight` does not oscillate at the header threshold.
- Five repeated fast scroll cycles on the supplied video-sized viewport never alternate the header and list between old and new layouts in adjacent frames.
- Album-directory navigation has a subtle directional entrance without rendering two long lists.
- Queue opening and closing visibly communicate state, remain responsive, preserve URL/history semantics, and restore focus.
- Reduced-motion users receive immediate state changes.
- All automated and browser checks pass, and the deployed GitHub Pages build contains the new CSS and behavior.

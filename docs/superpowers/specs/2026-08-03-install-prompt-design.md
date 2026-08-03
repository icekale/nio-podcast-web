# In-App PWA Install Button Design

## Goal

Let Chrome desktop visitors install NIO Radio directly from the page with an explicit 安装应用 button, in addition to the address-bar install icon.

## Behavior

- Listen for the Chrome-only `beforeinstallprompt` event. When it fires, prevent the default mini-infobar and store the prompt so a button can show.
- The button appears only when the browser reports the app is installable and it is not already installed.
- Clicking the button calls `prompt()` on the saved event; accepting hides the button, dismissing keeps it available for a later attempt.
- The `appinstalled` event hides the button as a fallback.
- Other browsers (Firefox, Safari) never fire `beforeinstallprompt`, so the button stays hidden and nothing changes for them.

## Placement

- The button renders at the bottom of the desktop sidebar navigation, below 稍后播放.
- Mobile layout is unchanged; mobile users keep the existing browser install affordances and README instructions.

## Files

- `src/App.jsx`: install-prompt state, window listeners, and sidebar button markup.
- `src/App.css`: desktop sidebar install button styles.
- `src/desktop-layout.test.jsx`: event-driven tests.

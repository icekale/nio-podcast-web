# White Noise Directory Subtitle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show the approved poetic subtitle on the white-noise card in the all-albums directory without changing episode data or other album surfaces.

**Architecture:** Store the directory-specific copy on the custom album object and let the existing `AlbumResults` card prefer that optional field. Preserve the current latest-episode, description, and empty fallbacks for every album without the field.

**Tech Stack:** React, Vitest, Testing Library, JavaScript

---

### Task 1: Prefer the white-noise directory subtitle

**Files:**
- Modify: `src/App.test.jsx`
- Modify: `src/customAlbums.js`
- Modify: `src/components/AlbumResults.jsx`

- [ ] **Step 1: Write the failing directory-card test**

Import `CUSTOM_WHITE_NOISE_ALBUM` in `src/App.test.jsx`, render it through `AlbumResults`, and assert that the card's accessible name contains the approved sentence:

```jsx
it('shows a directory-specific subtitle for white noise', () => {
  render(<AlbumResults albums={[CUSTOM_WHITE_NOISE_ALBUM]} onOpenAlbum={() => {}} />);

  expect(screen.getByRole('button', { name: '白噪音让雨声与风声，陪你安静抵达。' })).toBeInTheDocument();
});
```

- [ ] **Step 2: Run the focused test and verify the current behavior fails**

Run: `npm test -- --run src/App.test.jsx -t "shows a directory-specific subtitle for white noise"`

Expected: FAIL because the card's accessible name is currently `白噪音小雨`.

- [ ] **Step 3: Add the directory subtitle to the custom album**

Add the approved copy to `CUSTOM_WHITE_NOISE_ALBUM` in `src/customAlbums.js`:

```js
directorySubtitle: '让雨声与风声，陪你安静抵达。',
```

- [ ] **Step 4: Prefer the optional directory subtitle in album cards**

Update the subtitle expression in `src/components/AlbumResults.jsx`:

```jsx
album.directorySubtitle || album.latestEpisode?.title || album.description || '暂无节目'
```

- [ ] **Step 5: Run the focused test and verify it passes**

Run: `npm test -- --run src/App.test.jsx -t "shows a directory-specific subtitle for white noise"`

Expected: PASS.

- [ ] **Step 6: Verify the project and browser result**

Run:

```bash
npm test -- --run
npm run lint
npm run build
```

Expected: all tests pass, lint exits 0, and the production PWA build completes. On `http://127.0.0.1:5174/#/albums`, the white-noise card shows `让雨声与风声，陪你安静抵达。` while its album page still lists `小雨` as the first episode.

- [ ] **Step 7: Commit the implementation**

```bash
git add src/App.test.jsx src/customAlbums.js src/components/AlbumResults.jsx
git commit -m "fix: show white noise directory subtitle"
```

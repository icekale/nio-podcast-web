# In-App PWA Install Button Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a desktop sidebar 安装应用 button driven by Chrome's `beforeinstallprompt`.

**Architecture:** `App` keeps the deferred prompt and installed state in React, registers window listeners once, and passes an install callback to `DesktopNav`, which renders the button at the bottom of the sidebar only when installable.

**Tech Stack:** React 19, CSS, Vitest, React Testing Library

---

### Task 1: Add the failing event tests

**Files:**
- Modify: `src/desktop-layout.test.jsx`

- [ ] **Step 1: Add the install-prompt tests**

Append to `describe('desktop navigation', ...)`:

```jsx
  it('shows and triggers the install button from beforeinstallprompt', async () => {
    render(<App initialCatalog={catalog} />);
    const nav = screen.getByRole('navigation', { name: '主导航' });
    expect(within(nav).queryByRole('button', { name: '安装应用' })).not.toBeInTheDocument();

    const event = new Event('beforeinstallprompt', { cancelable: true });
    const prompt = vi.fn(() => Promise.resolve());
    event.prompt = prompt;
    event.userChoice = Promise.resolve({ outcome: 'accepted' });
    window.dispatchEvent(event);
    await waitFor(() => expect(within(nav).getByRole('button', { name: '安装应用' })).toBeInTheDocument());

    fireEvent.click(within(nav).getByRole('button', { name: '安装应用' }));
    await waitFor(() => expect(prompt).toHaveBeenCalled());
    await waitFor(() => expect(within(nav).queryByRole('button', { name: '安装应用' })).not.toBeInTheDocument());
  });

  it('hides the install button after appinstalled', async () => {
    render(<App initialCatalog={catalog} />);
    const nav = screen.getByRole('navigation', { name: '主导航' });
    window.dispatchEvent(new Event('beforeinstallprompt', { cancelable: true }));
    await waitFor(() => expect(within(nav).getByRole('button', { name: '安装应用' })).toBeInTheDocument());

    window.dispatchEvent(new Event('appinstalled'));
    await waitFor(() => expect(within(nav).queryByRole('button', { name: '安装应用' })).not.toBeInTheDocument());
  });
```

The prompt handler must store the dispatched event so `prompt` and `userChoice` are reachable from the click.

- [ ] **Step 2: Run the tests and confirm they fail**

Run:

```bash
npm test -- src/desktop-layout.test.jsx -t "install button"
```

Expected: both fail because the button and listeners do not exist.

### Task 2: Implement the install prompt

**Files:**
- Modify: `src/App.jsx`
- Modify: `src/App.css`

- [ ] **Step 1: Add the install state and listeners**

In `App`, add:

```jsx
  const [installPrompt, setInstallPrompt] = useState(null);

  useEffect(() => {
    const handlePrompt = event => {
      event.preventDefault();
      setInstallPrompt(event);
    };
    const handleInstalled = () => setInstallPrompt(null);
    window.addEventListener('beforeinstallprompt', handlePrompt);
    window.addEventListener('appinstalled', handleInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', handlePrompt);
      window.removeEventListener('appinstalled', handleInstalled);
    };
  }, []);

  const promptInstall = useCallback(async () => {
    const pending = installPrompt;
    if (!pending) return;
    await pending.prompt();
    const choice = await pending.userChoice;
    if (choice?.outcome === 'accepted') setInstallPrompt(null);
  }, [installPrompt]);
```

- [ ] **Step 2: Render the sidebar install button**

Add `showInstall` and `onInstall` props to `DesktopNav`, and render below the nav links:

```jsx
      {showInstall ? <button type="button" className="desktop-nav-install" onClick={onInstall}><Download size={17} aria-hidden="true" />安装应用</button> : null}
```

Import `Download` from `lucide-react` and pass `showInstall={Boolean(installPrompt)}` plus `onInstall={promptInstall}` from `App`.

- [ ] **Step 3: Style the button**

Add to the desktop media block:

```css
  .desktop-nav-install {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-2);
    min-height: 2.75rem;
    margin-top: auto;
    padding: 0.65rem var(--space-3);
    border-radius: var(--radius-md);
    background: var(--aqua);
    color: var(--teal-dark);
    font-weight: 650;
  }
  .desktop-nav-install:hover { background: var(--teal); color: var(--accent-ink); }
```

- [ ] **Step 4: Run the desktop tests**

Run:

```bash
npm test -- src/desktop-layout.test.jsx -t "install button"
```

Expected: both pass.

### Task 3: Full verification and commit

**Files:**
- No additional files.

- [ ] **Step 1: Run all repository checks**

Run:

```bash
npm test
npm run lint
npm run build
git diff --check
```

Expected: all tests pass, lint exits `0`, the build completes, and `git diff --check` prints nothing.

- [ ] **Step 2: Commit**

Run:

```bash
git add src/App.jsx src/App.css src/desktop-layout.test.jsx
git commit -m "feat: add in-app PWA install button"
```

### Task 4: Merge, deploy, and verify

**Files:**
- No additional file changes.

- [ ] **Step 1: Fast-forward main and push**

Run:

```bash
git -C /Users/kale/.openclaw/workspace/nio-podcast-web merge --ff-only codex/install-prompt
git -C /Users/kale/.openclaw/workspace/nio-podcast-web push origin main
```

- [ ] **Step 2: Watch the Pages run and verify the live build**

Run:

```bash
gh run list --repo icekale/nio-podcast-web --workflow deploy.yml --branch main --limit 1
```

Expected: deploy succeeds and the live site serves the newest assets.

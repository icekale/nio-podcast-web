export function isOggUrl(url) {
  return /\.og[ga](\?|#|$)/i.test(String(url || ''));
}

export function canPlayAudioUrl(url, media = globalThis.Audio ? new Audio() : null) {
  if (!url) return false;
  if (!isOggUrl(url)) return true;
  const type = media?.canPlayType?.('audio/ogg; codecs="vorbis"') || media?.canPlayType?.('audio/ogg') || '';
  return type !== '';
}

export function unsupportedAudioMessage(url) {
  return isOggUrl(url) ? '此设备不支持该音频格式' : '音频暂时无法播放，请稍后重试';
}

export function applyEpisodeToAudio(audio, episode, { play = false, seekSeconds = null } = {}) {
  if (!audio) return undefined;
  if (!episode?.audioUrl) {
    audio.pause();
    audio.removeAttribute('src');
    audio.load();
    return undefined;
  }
  const already = audio.getAttribute('src') === episode.audioUrl || audio.src === episode.audioUrl;
  if (!already) {
    audio.setAttribute('src', episode.audioUrl);
    audio.src = episode.audioUrl;
    audio.load();
  }
  if (seekSeconds != null) {
    try { audio.currentTime = seekSeconds; } catch { /* metadata may not be ready */ }
  }
  if (play) return audio.play();
  return undefined;
}

export function syncIosStatusBar(doc = document, isDark) {
  const status = doc.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]');
  if (status) status.setAttribute('content', isDark ? 'black-translucent' : 'default');
  const theme = doc.querySelector('meta[name="theme-color"]');
  if (theme) theme.setAttribute('content', isDark ? '#101a27' : '#ffffff');
}

export function lockBodyScroll(doc = document, scrollY = doc.defaultView?.scrollY || 0) {
  const { body, documentElement } = doc;
  const previous = {
    bodyOverflow: body.style.overflow,
    bodyPosition: body.style.position,
    bodyTop: body.style.top,
    bodyWidth: body.style.width,
    htmlOverflow: documentElement.style.overflow,
  };
  body.style.overflow = 'hidden';
  body.style.position = 'fixed';
  body.style.top = `-${scrollY}px`;
  body.style.width = '100%';
  documentElement.style.overflow = 'hidden';
  return () => {
    body.style.overflow = previous.bodyOverflow;
    body.style.position = previous.bodyPosition;
    body.style.top = previous.bodyTop;
    body.style.width = previous.bodyWidth;
    documentElement.style.overflow = previous.htmlOverflow;
    const scrolling = doc.scrollingElement || documentElement;
    scrolling.scrollTop = scrollY;
    body.scrollTop = scrollY;
  };
}

export function shouldShowIosInstall({
  userAgent = globalThis.navigator?.userAgent || '',
  standalone = Boolean(globalThis.navigator?.standalone),
  displayStandalone = globalThis.matchMedia?.('(display-mode: standalone)')?.matches === true,
  dismissed = false,
} = {}) {
  if (dismissed || standalone || displayStandalone) return false;
  return /iPad|iPhone|iPod/.test(userAgent);
}

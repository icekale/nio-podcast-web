import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  applyEpisodeToAudio,
  canPlayAudioUrl,
  lockBodyScroll,
  shouldShowIosInstall,
  syncIosStatusBar,
  unsupportedAudioMessage,
} from './iosSupport';

describe('canPlayAudioUrl', () => {
  it('rejects ogg when the element cannot decode vorbis', () => {
    const media = { canPlayType: type => (type.includes('ogg') ? '' : 'probably') };
    expect(canPlayAudioUrl('https://cdn.example/rain.ogg', media)).toBe(false);
    expect(canPlayAudioUrl('https://cdn.example/show.m4a', media)).toBe(true);
  });

  it('keeps ogg when the browser reports support', () => {
    const media = { canPlayType: () => 'probably' };
    expect(canPlayAudioUrl('https://cdn.example/rain.ogg', media)).toBe(true);
  });

  it('names the format failure for ogg', () => {
    expect(unsupportedAudioMessage('https://cdn.example/rain.ogg')).toBe('此设备不支持该音频格式');
    expect(unsupportedAudioMessage('https://cdn.example/show.m4a')).toBe('音频暂时无法播放，请稍后重试');
  });
});

describe('applyEpisodeToAudio', () => {
  it('sets src and calls play in the same turn', () => {
    const audio = document.createElement('audio');
    const play = vi.spyOn(audio, 'play').mockResolvedValue();
    applyEpisodeToAudio(audio, { audioUrl: 'https://cdn.example/1.m4a' }, { play: true });
    expect(audio.getAttribute('src')).toBe('https://cdn.example/1.m4a');
    expect(play).toHaveBeenCalledTimes(1);
  });

  it('does not reload when the same src is already applied', () => {
    const audio = document.createElement('audio');
    audio.setAttribute('src', 'https://cdn.example/1.m4a');
    const load = vi.spyOn(audio, 'load');
    applyEpisodeToAudio(audio, { audioUrl: 'https://cdn.example/1.m4a' }, { play: true });
    expect(load).not.toHaveBeenCalled();
  });
});

describe('syncIosStatusBar', () => {
  afterEach(() => {
    document.head.innerHTML = '';
  });

  it('uses a translucent bar in dark mode and default in light mode', () => {
    document.head.innerHTML = '<meta name="apple-mobile-web-app-status-bar-style" content="default" />';
    syncIosStatusBar(document, true);
    expect(document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]').content).toBe('black-translucent');
    syncIosStatusBar(document, false);
    expect(document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]').content).toBe('default');
  });

  it('paints the installed theme-color dark in dark mode and white in light mode', () => {
    document.head.innerHTML = '<meta name="theme-color" content="#ffffff" />';
    syncIosStatusBar(document, true);
    expect(document.querySelector('meta[name="theme-color"]').content).toBe('#101a27');
    syncIosStatusBar(document, false);
    expect(document.querySelector('meta[name="theme-color"]').content).toBe('#ffffff');
  });
});

describe('lockBodyScroll', () => {
  afterEach(() => {
    document.body.removeAttribute('style');
    document.documentElement.removeAttribute('style');
  });

  it('pins the body while locked and restores scroll on release', () => {
    const scrolling = document.scrollingElement || document.documentElement;
    scrolling.scrollTop = 0;
    const unlock = lockBodyScroll(document, 120);
    expect(document.body.style.position).toBe('fixed');
    expect(document.body.style.top).toBe('-120px');
    unlock();
    expect(document.body.style.position).toBe('');
    expect(scrolling.scrollTop).toBe(120);
  });
});

describe('shouldShowIosInstall', () => {
  it('shows only on iOS Safari that is not already standalone', () => {
    expect(shouldShowIosInstall({ userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)', standalone: false, displayStandalone: false, dismissed: false })).toBe(true);
    expect(shouldShowIosInstall({ userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)', standalone: true, displayStandalone: false, dismissed: false })).toBe(false);
    expect(shouldShowIosInstall({ userAgent: 'Mozilla/5.0 (Linux; Android 14)', standalone: false, displayStandalone: false, dismissed: false })).toBe(false);
    expect(shouldShowIosInstall({ userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)', standalone: false, displayStandalone: false, dismissed: true })).toBe(false);
  });
});

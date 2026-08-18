import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SearchScreen } from './SearchScreen';

const catalog = {
  albums: [{ id: 1, name: 'NIO 精选', description: '', host: '', imageUrl: '', latestEpisode: { title: '第一集' } }],
};

function stubMatchMedia(fine) {
  window.matchMedia = vi.fn().mockImplementation(query => ({
    matches: query.includes('pointer: fine') ? fine : false,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    onchange: null,
    dispatchEvent: vi.fn(),
  }));
}

describe('SearchScreen focus', () => {
  afterEach(cleanup);

  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('does not autofocus the field on coarse pointers', () => {
    stubMatchMedia(false);
    render(<SearchScreen catalog={catalog} onBack={() => {}} onQueryChange={() => {}} onOpenAlbum={() => {}} />);
    expect(document.activeElement).not.toBe(screen.getByRole('searchbox', { name: '搜索专辑' }));
  });

  it('autofocuses the field on fine pointers', () => {
    stubMatchMedia(true);
    render(<SearchScreen catalog={catalog} onBack={() => {}} onQueryChange={() => {}} onOpenAlbum={() => {}} />);
    expect(document.activeElement).toBe(screen.getByRole('searchbox', { name: '搜索专辑' }));
  });
});

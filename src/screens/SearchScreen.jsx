import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Search, X } from 'lucide-react';
import { sortAlbumsForDirectory } from '../catalog';
import { AlbumResults } from '../components/AlbumResults';
import { CategorySections } from '../components/CategorySections';

export const SearchScreen = memo(function SearchScreen({ catalog, searchQuery = '', onBack, onQueryChange, onOpenAlbum, pinnedFirst = false, favoriteIds, onToggleFavorite }) {
  const [debouncedQuery, setDebouncedQuery] = useState(searchQuery);
  const inputRef = useRef(null);
  const searching = debouncedQuery.trim().length > 0;
  const filtered = useMemo(() => {
    if (!searching) return [];
    const base = pinnedFirst ? sortAlbumsForDirectory(catalog.albums, favoriteIds) : catalog.albums;
    const value = debouncedQuery.trim().toLowerCase();
    return base.filter(album => `${album.name} ${album.description} ${album.host}`.toLowerCase().includes(value));
  }, [catalog.albums, debouncedQuery, pinnedFirst, favoriteIds, searching]);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(searchQuery), 120);
    return () => window.clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    if (window.matchMedia?.('(pointer: fine)')?.matches) inputRef.current?.focus();
  }, []);

  return (
    <div className="screen search-screen">
      <header className="top-bar">
        <button type="button" className="icon-button" aria-label="返回" onClick={onBack}><ArrowLeft size={25} /></button>
        <div className="search-field-wrap"><Search size={18} aria-hidden="true" /><input ref={inputRef} type="search" value={searchQuery} onChange={event => onQueryChange(event.target.value)} aria-label="搜索专辑" placeholder="搜索专辑" /></div>
        {searchQuery ? <button type="button" className="icon-button" aria-label="清空搜索" onClick={() => onQueryChange('')}><X size={20} /></button> : <span className="icon-button-spacer" />}
      </header>
      <section className="search-results">
        <div className="section-heading-row"><h1>全部专辑</h1><span key={searching ? filtered.length : catalog.albums.length} className="section-count" aria-live="polite">{searching ? filtered.length : catalog.albums.length}</span></div>
        {searching ? (
          <>
            <AlbumResults albums={filtered} onOpenAlbum={onOpenAlbum} grid favoriteIds={favoriteIds} onToggleFavorite={onToggleFavorite} />
            {!filtered.length ? <div className="empty-state">没有找到匹配的专辑</div> : null}
          </>
        ) : (
          <CategorySections albums={catalog.albums} onOpenAlbum={onOpenAlbum} favoriteIds={favoriteIds} onToggleFavorite={onToggleFavorite} />
        )}
      </section>
    </div>
  );
});

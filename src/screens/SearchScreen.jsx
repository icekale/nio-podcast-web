import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Search, X } from 'lucide-react';
import { sortAlbumsForDirectory } from '../catalog';
import { AlbumResults } from '../components/AlbumResults';

export const SearchScreen = memo(function SearchScreen({ catalog, searchQuery = '', onBack, onQueryChange, onOpenAlbum, pinnedFirst = false, favoriteIds, onToggleFavorite }) {
  const [query, setQuery] = useState(searchQuery);
  const [debouncedQuery, setDebouncedQuery] = useState(searchQuery);
  const inputRef = useRef(null);
  const filtered = useMemo(() => {
    const base = pinnedFirst ? sortAlbumsForDirectory(catalog.albums, favoriteIds) : catalog.albums;
    const value = debouncedQuery.trim().toLowerCase();
    if (!value) return base;
    return base.filter(album => `${album.name} ${album.description} ${album.host}`.toLowerCase().includes(value));
  }, [catalog.albums, debouncedQuery, pinnedFirst, favoriteIds]);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(query), 120);
    return () => window.clearTimeout(timer);
  }, [query]);

  useEffect(() => setQuery(searchQuery), [searchQuery]);

  useEffect(() => inputRef.current?.focus(), []);

  return (
    <div className="screen search-screen">
      <header className="top-bar">
        <button type="button" className="icon-button" aria-label="返回" onClick={onBack}><ArrowLeft size={25} /></button>
        <div className="search-field-wrap"><Search size={18} aria-hidden="true" /><input ref={inputRef} type="search" value={query} onChange={event => { setQuery(event.target.value); onQueryChange(event.target.value); }} aria-label="搜索专辑" placeholder="搜索专辑" /></div>
        {query ? <button type="button" className="icon-button" aria-label="清空搜索" onClick={() => { setQuery(''); onQueryChange(''); }}><X size={20} /></button> : <span className="icon-button-spacer" />}
      </header>
      <section className="search-results">
        <div className="section-heading-row"><h1>全部专辑</h1><span key={filtered.length} className="section-count" aria-live="polite">{filtered.length}</span></div>
        <AlbumResults albums={filtered} onOpenAlbum={onOpenAlbum} grid favoriteIds={favoriteIds} onToggleFavorite={onToggleFavorite} />
        {!filtered.length ? <div className="empty-state">没有找到匹配的专辑</div> : null}
      </section>
    </div>
  );
});

import { memo, useMemo, useState } from 'react';
import { ArrowLeft, ChevronRight, Search } from 'lucide-react';
import { groupAlbumsByCategory } from '../catalog';
import { AlbumResults } from '../components/AlbumResults';

export const AlbumsScreen = memo(function AlbumsScreen({ catalog, onBack, onSearch, onOpenAlbum, favoriteIds, onToggleFavorite, starAction }) {
  const [expandedCategory, setExpandedCategory] = useState(null);
  const { groups, rest } = useMemo(() => groupAlbumsByCategory(catalog.albums, favoriteIds), [catalog.albums, favoriteIds]);

  return (
    <div className="screen albums-screen">
      <header className="top-bar">
        <button type="button" className="icon-button" aria-label="返回主页" onClick={onBack}><ArrowLeft size={25} /></button>
        <span className="top-title">全部专辑</span>
        <button type="button" className="icon-button" aria-label="搜索" onClick={onSearch}><Search size={22} /></button>
      </header>
      <section className="search-results" aria-labelledby="albums-title">
        <div className="section-heading-row"><h1 id="albums-title">全部专辑</h1><span className="section-count">{catalog.albums.length}</span></div>
        {groups.map(group => (
          <section key={group.id} className="category-section" aria-labelledby={`category-${group.id}`}>
            <button
              type="button"
              className="category-heading"
              id={`category-${group.id}`}
              aria-expanded={expandedCategory === group.id}
              onClick={() => setExpandedCategory(expandedCategory === group.id ? null : group.id)}
            >
              <span className="category-label">{group.label}</span>
              <span className="category-count">{group.albums.length}</span>
              <ChevronRight size={19} aria-hidden="true" />
            </button>
            <AlbumResults albums={expandedCategory === group.id || starAction ? group.albums : group.albums.slice(0, 12)} onOpenAlbum={onOpenAlbum} grid={expandedCategory === group.id || starAction} rail={expandedCategory !== group.id} favoriteIds={favoriteIds} onToggleFavorite={onToggleFavorite} starAction={starAction} />
          </section>
        ))}
        {rest.length ? (
          <section className="category-section" aria-labelledby="category-more">
            <h2 className="category-heading" id="category-more"><span className="category-label">更多专辑</span><span className="category-count">{rest.length}</span></h2>
            <AlbumResults albums={rest} onOpenAlbum={onOpenAlbum} grid favoriteIds={favoriteIds} onToggleFavorite={onToggleFavorite} starAction={starAction} />
          </section>
        ) : null}
        {!catalog.albums.length ? <div className="empty-state">暂无可用专辑</div> : null}
      </section>
    </div>
  );
});

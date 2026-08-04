import { memo, useMemo } from 'react';
import { ArrowLeft, Search } from 'lucide-react';
import { sortAlbumsForDirectory } from '../catalog';
import { AlbumResults } from '../components/AlbumResults';

export const AlbumsScreen = memo(function AlbumsScreen({ catalog, onBack, onSearch, onOpenAlbum }) {
  const orderedAlbums = useMemo(() => sortAlbumsForDirectory(catalog.albums), [catalog.albums]);
  return (
    <div className="screen albums-screen">
      <header className="top-bar">
        <button type="button" className="icon-button" aria-label="返回主页" onClick={onBack}><ArrowLeft size={25} /></button>
        <span className="top-title">全部专辑</span>
        <button type="button" className="icon-button" aria-label="搜索" onClick={onSearch}><Search size={22} /></button>
      </header>
      <section className="search-results" aria-labelledby="albums-title">
        <div className="section-heading-row"><h1 id="albums-title">全部专辑</h1><span className="section-count">{catalog.albums.length}</span></div>
        <AlbumResults albums={orderedAlbums} onOpenAlbum={onOpenAlbum} grid />
        {!catalog.albums.length ? <div className="empty-state">暂无可用专辑</div> : null}
      </section>
    </div>
  );
});


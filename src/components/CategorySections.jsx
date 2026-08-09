import { memo, useMemo, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { groupAlbumsByCategory } from '../catalog';
import { AlbumResults } from './AlbumResults';

export const CategorySections = memo(function CategorySections({ albums, onOpenAlbum, favoriteIds, onToggleFavorite, starAction = false }) {
  const [expandedCategory, setExpandedCategory] = useState(null);
  const { groups, rest } = useMemo(() => groupAlbumsByCategory(albums, favoriteIds), [albums, favoriteIds]);

  return (
    <>
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
          <AlbumResults
            albums={expandedCategory === group.id || starAction ? group.albums : group.albums.slice(0, 12)}
            onOpenAlbum={onOpenAlbum}
            grid={expandedCategory === group.id || starAction}
            rail={expandedCategory !== group.id}
            favoriteIds={favoriteIds}
            onToggleFavorite={onToggleFavorite}
            starAction={starAction}
          />
        </section>
      ))}
      {rest.length ? (
        <section className="category-section" aria-labelledby="category-more">
          <h2 className="category-heading" id="category-more"><span className="category-label">更多专辑</span><span className="category-count">{rest.length}</span></h2>
          <AlbumResults albums={rest} onOpenAlbum={onOpenAlbum} grid favoriteIds={favoriteIds} onToggleFavorite={onToggleFavorite} starAction={starAction} />
        </section>
      ) : null}
    </>
  );
});

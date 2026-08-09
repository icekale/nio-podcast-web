import { memo, useMemo, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { groupAlbumsByCategory } from '../catalog';
import { AlbumResults } from './AlbumResults';

const SECTION_LIMIT = 12;
const REST_LIMIT = 12;

export const CategorySections = memo(function CategorySections({ albums, onOpenAlbum, favoriteIds, onToggleFavorite }) {
  const [expandedCategory, setExpandedCategory] = useState(null);
  const [expandedRest, setExpandedRest] = useState(false);
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
            albums={expandedCategory === group.id ? group.albums : group.albums.slice(0, SECTION_LIMIT)}
            onOpenAlbum={onOpenAlbum}
            grid
            favoriteIds={favoriteIds}
            onToggleFavorite={onToggleFavorite}
          />
        </section>
      ))}
      {rest.length ? (
        <section className="category-section" aria-labelledby="category-more">
          <button
            type="button"
            className="category-heading"
            id="category-more"
            aria-expanded={expandedRest}
            onClick={() => setExpandedRest(previous => !previous)}
          >
            <span className="category-label">更多专辑</span>
            <span className="category-count">{rest.length}</span>
            <ChevronRight size={19} aria-hidden="true" />
          </button>
          <AlbumResults albums={expandedRest ? rest : rest.slice(0, REST_LIMIT)} onOpenAlbum={onOpenAlbum} grid favoriteIds={favoriteIds} onToggleFavorite={onToggleFavorite} />
        </section>
      ) : null}
    </>
  );
});

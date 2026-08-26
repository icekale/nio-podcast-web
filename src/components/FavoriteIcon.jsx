import { Heart } from 'lucide';
import { MorphIcon } from 'morphicons/react';
import { FILLED_HEART } from '../favoriteIcon';

export function FavoriteIcon({ favorited, size = 16 }) {
  return (
    <MorphIcon
      className="favorite-morph-icon"
      icon={favorited ? FILLED_HEART : Heart}
      reducedMotion="user"
      size={size}
      fill="currentColor"
      fillOpacity={favorited ? 1 : 0}
      aria-hidden="true"
    />
  );
}

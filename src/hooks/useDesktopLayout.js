import { useEffect, useState } from 'react';

export function useDesktopLayout() {
  const [desktop, setDesktop] = useState(() => (
    typeof window !== 'undefined' && window.matchMedia?.('(min-width: 1024px)')?.matches === true
  ));
  useEffect(() => {
    const media = typeof window !== 'undefined' ? window.matchMedia?.('(min-width: 1024px)') : null;
    if (!media) return undefined;
    const update = () => setDesktop(media.matches);
    update();
    media.addEventListener?.('change', update);
    return () => media.removeEventListener?.('change', update);
  }, []);
  return desktop;
}


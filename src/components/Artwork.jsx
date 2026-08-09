import { useState } from 'react';
import { Music2 } from 'lucide-react';

export function Artwork({ src, alt = '', className = '' }) {
  const [failed, setFailed] = useState(false);
  if (src && !failed) {
    return <img className={`artwork ${className}`} src={src} alt={alt} loading="lazy" decoding="async" onError={() => setFailed(true)} />;
  }
  return <span className={`artwork artwork-empty ${className}`} aria-hidden="true"><Music2 size={22} strokeWidth={1.7} /></span>;
}


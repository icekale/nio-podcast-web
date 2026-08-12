import { useState } from 'react';
import { Music2 } from 'lucide-react';

export function Artwork({ src, darkSrc, alt = '', className = '' }) {
  const [failedSrc, setFailedSrc] = useState(null);
  if (src && failedSrc !== src) {
    return (
      <picture className={`artwork ${className}`}>
        {darkSrc ? <source media="(prefers-color-scheme: dark)" srcSet={darkSrc} /> : null}
        <img className="artwork-media" src={src} alt={alt} loading="lazy" decoding="async" onError={() => setFailedSrc(src)} />
      </picture>
    );
  }
  return <span className={`artwork artwork-empty ${className}`} aria-hidden="true"><Music2 size={22} strokeWidth={1.7} /></span>;
}

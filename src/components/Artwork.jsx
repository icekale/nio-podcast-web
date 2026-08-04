import { Music2 } from 'lucide-react';

export function Artwork({ src, alt = '', className = '' }) {
  if (src) return <img className={`artwork ${className}`} src={src} alt={alt} loading="lazy" decoding="async" />;
  return <span className={`artwork artwork-empty ${className}`} aria-hidden="true"><Music2 size={22} strokeWidth={1.7} /></span>;
}


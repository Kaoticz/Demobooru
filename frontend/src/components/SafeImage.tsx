import { useState } from 'react';

interface SafeImageProps {
  src: string;
  alt: string;
  className?: string;
}

/** An <img> that degrades to a placeholder instead of a broken layout
 *  when the underlying file is missing. */
export default function SafeImage({ src, alt, className }: SafeImageProps) {
  const [broken, setBroken] = useState(false);

  if (broken) {
    return (
      <div className="img-broken" title={alt}>
        <span>image unavailable</span>
      </div>
    );
  }
  return (
    <img
      src={src}
      alt={alt}
      className={className}
      loading="lazy"
      onError={() => setBroken(true)}
    />
  );
}

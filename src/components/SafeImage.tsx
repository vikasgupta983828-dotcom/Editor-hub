import React, { useEffect, useState } from 'react';
import { ImageOff } from 'lucide-react';

interface AvatarImageProps {
  src?: string | null;
  alt: string;
  fallbackInitial?: string;
  className?: string;
  fallbackClassName?: string;
}

export const AvatarImage: React.FC<AvatarImageProps> = ({
  src,
  alt,
  fallbackInitial,
  className = 'w-10 h-10 rounded-lg object-cover shrink-0',
  fallbackClassName = 'w-10 h-10 rounded-lg bg-violet-100 text-violet-700 flex items-center justify-center font-semibold shrink-0',
}) => {
  const [failed, setFailed] = useState(false);
  const cleanSrc = typeof src === 'string' ? src.trim() : '';

  useEffect(() => {
    setFailed(false);
  }, [cleanSrc]);

  if (!cleanSrc || failed) {
    const letter = (fallbackInitial || alt || 'U').trim().charAt(0).toUpperCase() || 'U';
    return (
      <div className={fallbackClassName} aria-label={alt}>
        {letter}
      </div>
    );
  }

  return (
    <img
      src={cleanSrc}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={className}
    />
  );
};

interface SafeImageProps {
  src?: string | null;
  alt: string;
  className?: string;
  fallbackClassName?: string;
  fallbackTitle?: string;
}

export const SafeImage: React.FC<SafeImageProps> = ({
  src,
  alt,
  className = 'w-full h-full object-cover',
  fallbackClassName = 'w-full h-full flex flex-col items-center justify-center gap-2 bg-gradient-to-br from-slate-100 via-slate-50 to-violet-50 text-slate-500 p-4 text-center',
  fallbackTitle,
}) => {
  const [failed, setFailed] = useState(false);
  const cleanSrc = typeof src === 'string' ? src.trim() : '';

  useEffect(() => {
    setFailed(false);
  }, [cleanSrc]);

  if (!cleanSrc || failed) {
    return (
      <div className={fallbackClassName} role="img" aria-label={alt}>
        <ImageOff className="w-6 h-6 text-slate-400" />
        <span className="text-xs font-medium text-slate-600 line-clamp-2 max-w-[220px]">
          {fallbackTitle || alt || 'Preview unavailable'}
        </span>
      </div>
    );
  }

  return (
    <img
      src={cleanSrc}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={className}
    />
  );
};

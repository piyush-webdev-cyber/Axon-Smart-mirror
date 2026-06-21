/** Lazy-loaded photo thumbnail for gallery grid. */

import { cn } from "@/utils/cn";
import type { Photo } from "@/types/photo";

interface PhotoThumbnailProps {
  photo: Photo;
  className?: string;
  onClick?: () => void;
}

export function PhotoThumbnail({ photo, className, onClick }: PhotoThumbnailProps) {
  const src = photo.thumbnailUrl || photo.imageUrl;

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group relative aspect-square overflow-hidden rounded-lg bg-surface transition-all",
        "hover:ring-2 hover:ring-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
        className,
      )}
    >
      {src ? (
        <img
          src={src}
          alt={photo.caption || "Photo"}
          loading="lazy"
          decoding="async"
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-text-secondary">
          <span className="text-4xl">📷</span>
        </div>
      )}

      {photo.caption && (
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-2 text-caption text-foreground opacity-0 transition-opacity group-hover:opacity-100">
          {photo.caption}
        </div>
      )}
    </button>
  );
}

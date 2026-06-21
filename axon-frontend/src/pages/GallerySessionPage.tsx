/** Mobile gallery session page — public access via QR token. */

import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Download, Share2, X } from "lucide-react";
import { PhotoThumbnail } from "@/features/gallery/PhotoThumbnail";
import { galleryApi } from "@/services/photoApi";
import type { Photo } from "@/types/photo";
import { cn } from "@/utils/cn";

export default function GallerySessionPage() {
  const { token } = useParams<{ token: string }>();
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadSession = useCallback(async () => {
    if (!token) return;
    try {
      const response = await galleryApi.getSessionPhotos(token);
      setPhotos(response.photos);
      setExpiresAt(response.expiresAt);
      setIsLoading(false);
    } catch {
      setError("This gallery session is invalid or has expired.");
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void loadSession();
  }, [loadSession]);

  const downloadPhoto = (photo: Photo) => {
    if (!photo.imageUrl) return;
    const link = document.createElement("a");
    link.href = photo.imageUrl;
    link.download = photo.fileName || `photo_${photo.id}.jpg`;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.click();
  };

  const sharePhoto = async (photo: Photo) => {
    if (!photo.imageUrl) return;
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Axon Photo",
          url: photo.imageUrl,
        });
      } catch {
        /* user cancelled */
      }
    } else {
      await navigator.clipboard.writeText(photo.imageUrl);
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <p className="text-body text-glow">Loading your photos...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="text-center">
          <p className="mb-2 text-body text-error">{error}</p>
          <p className="text-caption text-content-muted">
            Ask Nexa on your mirror to show your photos again.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-8">
      <header className="glass-surface sticky top-0 z-10 px-4 py-4 sm:px-6">
        <h1 className="text-subheading font-semibold">Your Photos</h1>
        <p className="text-caption text-content-muted">
          Axon Smart Mirror ·{" "}
          {expiresAt
            ? `Expires ${new Date(expiresAt).toLocaleTimeString()}`
            : "Temporary session"}
        </p>
      </header>

      {photos.length === 0 ? (
        <div className="flex min-h-[50vh] items-center justify-center px-4">
          <p className="text-body text-text-secondary">No photos in this gallery yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-3 sm:gap-4 sm:p-6">
          {photos.map((photo) => (
            <PhotoThumbnail
              key={photo.id}
              photo={photo}
              onClick={() => setSelectedPhoto(photo)}
            />
          ))}
        </div>
      )}

      {selectedPhoto && (
        <div className="fixed inset-0 z-50 flex flex-col bg-black">
          <div className="flex items-center justify-between px-4 py-3">
            <button
              type="button"
              onClick={() => setSelectedPhoto(null)}
              className="text-foreground"
              aria-label="Close"
            >
              <X className="size-6" />
            </button>
            <div className="flex gap-4">
              <button
                type="button"
                onClick={() => void sharePhoto(selectedPhoto)}
                aria-label="Share"
              >
                <Share2 className="size-5 text-foreground" />
              </button>
              <button
                type="button"
                onClick={() => downloadPhoto(selectedPhoto)}
                aria-label="Download"
              >
                <Download className="size-5 text-foreground" />
              </button>
            </div>
          </div>

          <div className="flex flex-1 items-center justify-center px-2">
            {selectedPhoto.imageUrl ? (
              <img
                src={selectedPhoto.imageUrl}
                alt={selectedPhoto.caption || "Photo"}
                className="max-h-full max-w-full object-contain"
              />
            ) : null}
          </div>

          <div className="px-4 py-4 text-center">
            <button
              type="button"
              onClick={() => downloadPhoto(selectedPhoto)}
              className={cn(
                "w-full rounded-lg bg-primary py-3 text-body font-semibold text-black",
              )}
            >
              Download Photo
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/** Gallery page — grid, viewer modal, QR session, voice delete. */

import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import { Download, Trash2, X } from "lucide-react";
import { PhotoThumbnail } from "@/features/gallery/PhotoThumbnail";
import { WS_EVENTS } from "@/constants/wsEvents";
import { ROUTES } from "@/constants/routes";
import { galleryApi, photoApi } from "@/services/photoApi";
import { websocketClient } from "@/services/websocketClient";
import { useAppStore } from "@/store";
import type { GallerySessionResponse, Photo } from "@/types/photo";
import { cn } from "@/utils/cn";
import { env } from "@/utils/env";
import {
  buildGallerySessionUrl,
  isLocalhostOrigin,
} from "@/utils/gallerySessionUrl";

const PAGE_SIZE = 20;

export default function GalleryPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const showQrOnLoad = searchParams.get("qr") === "1";

  const galleryQrTick = useAppStore((s) => s.galleryQrTick);
  const deletePhotoTick = useAppStore((s) => s.deletePhotoTick);

  const [photos, setPhotos] = useState<Photo[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);
  const [session, setSession] = useState<GallerySessionResponse | null>(null);
  const [showSessionQr, setShowSessionQr] = useState(showQrOnLoad);
  const selectedRef = useRef<Photo | null>(null);
  const lastGalleryQrTickRef = useRef(0);
  const lastDeleteTickRef = useRef(0);

  selectedRef.current = selectedPhoto;

  const loadPhotos = useCallback(async (pageNum: number, append: boolean) => {
    try {
      setError(null);
      const response = await photoApi.listPhotos(pageNum, PAGE_SIZE);
      setPhotos((prev) => (append ? [...prev, ...response.photos] : response.photos));
      setHasMore(response.hasMore);
      setIsLoading(false);
    } catch {
      setError("Failed to load photos");
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadPhotos(1, false);
  }, [loadPhotos]);

  const createSession = useCallback(async () => {
    try {
      const data = await galleryApi.createSession();
      setSession(data);
      setShowSessionQr(true);
      websocketClient.send(WS_EVENTS.galleryOpened, { token: data.token });
    } catch {
      setError("Failed to create gallery session");
    }
  }, []);

  useEffect(() => {
    if (showQrOnLoad) {
      void createSession();
    }
  }, [showQrOnLoad, createSession]);

  useEffect(() => {
    if (galleryQrTick > lastGalleryQrTickRef.current) {
      lastGalleryQrTickRef.current = galleryQrTick;
      void createSession();
    }
  }, [galleryQrTick, createSession]);

  useEffect(() => {
    const refresh = () => void loadPhotos(1, false);
    const unsubCreated = websocketClient.subscribe(WS_EVENTS.photoCreated, refresh);
    const unsubUpload = websocketClient.subscribe(WS_EVENTS.photoUploadCompleted, refresh);
    const unsubDeleted = websocketClient.subscribe(WS_EVENTS.photoDeleted, refresh);
    return () => {
      unsubCreated();
      unsubUpload();
      unsubDeleted();
    };
  }, [loadPhotos]);

  const handleDelete = useCallback(
    async (photoId: string) => {
      try {
        await photoApi.deletePhoto(photoId);
        setPhotos((prev) => prev.filter((p) => p.id !== photoId));
        setSelectedPhoto(null);
      } catch {
        setError("Failed to delete photo");
      }
    },
    [],
  );

  useEffect(() => {
    if (deletePhotoTick <= lastDeleteTickRef.current) return;
    lastDeleteTickRef.current = deletePhotoTick;
    const target = selectedRef.current ?? photos[0];
    if (target) void handleDelete(target.id);
  }, [deletePhotoTick, handleDelete, photos]);

  const loadMore = () => {
    const next = page + 1;
    setPage(next);
    void loadPhotos(next, true);
  };

  const closeSessionQr = () => {
    setShowSessionQr(false);
    websocketClient.send(WS_EVENTS.galleryClosed, {});
  };

  const downloadPhoto = (photo: Photo) => {
    if (!photo.imageUrl) return;
    const link = document.createElement("a");
    link.href = photo.imageUrl;
    link.download = photo.fileName || `photo_${photo.id}.jpg`;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.click();
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <p className="text-subheading text-glow">Loading gallery...</p>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-background pb-8">
      <div className="glass-surface sticky top-0 z-10 flex items-center justify-between px-6 py-4">
        <h1 className="text-subheading font-semibold">Gallery</h1>
        <div className="flex gap-4">
          <button
            type="button"
            onClick={() => void createSession()}
            className="text-body text-primary transition-colors hover:text-primary/80"
          >
            Phone Access
          </button>
          <button
            type="button"
            onClick={() => navigate(ROUTES.camera)}
            className="text-body text-primary transition-colors hover:text-primary/80"
          >
            Take Photo
          </button>
          <button
            type="button"
            onClick={() => navigate(ROUTES.home)}
            className="text-body text-text-secondary transition-colors hover:text-foreground"
          >
            Close
          </button>
        </div>
      </div>

      {error && (
        <div className="mx-6 mt-4 rounded-lg bg-error/10 px-4 py-3 text-body text-error">
          {error}
        </div>
      )}

      {showSessionQr && session && (
        <div className="mx-6 mt-6 flex flex-col items-center rounded-xl glass-surface p-6 ring-glow animate-fade-in">
          <div className="mb-4 flex w-full items-center justify-between">
            <div>
              <h2 className="text-body font-semibold text-foreground">Scan to view on phone</h2>
              <p className="text-caption text-content-muted">Session expires in 15 minutes</p>
              {isLocalhostOrigin() && !env.publicMirrorUrl && (
                <p className="mt-1 text-caption text-warning">
                  Set VITE_PUBLIC_MIRROR_URL in .env to your PC LAN IP (run ipconfig → IPv4,
                  e.g. http://192.168.31.75:5173). Phone and PC must be on the same Wi‑Fi.
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={closeSessionQr}
              aria-label="Close QR"
              className="text-text-secondary hover:text-foreground"
            >
              <X className="size-5" />
            </button>
          </div>
          <div className="rounded-xl bg-white p-4">
            <QRCodeSVG
              value={buildGallerySessionUrl(session.token)}
              size={200}
              level="M"
            />
          </div>
          <p className="mt-3 break-all text-center text-caption text-content-muted">
            {buildGallerySessionUrl(session.token)}
          </p>
        </div>
      )}

      {photos.length === 0 ? (
        <div className="flex min-h-[40vh] items-center justify-center">
          <div className="text-center">
            <p className="mb-4 text-heading text-text-secondary">No photos yet</p>
            <button
              type="button"
              onClick={() => navigate(ROUTES.camera)}
              className="glass-surface px-6 py-3 text-body font-medium text-primary ring-glow transition-all hover:ring-glow-strong"
            >
              Take Your First Photo
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 p-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {photos.map((photo) => (
              <PhotoThumbnail
                key={photo.id}
                photo={photo}
                onClick={() => setSelectedPhoto(photo)}
              />
            ))}
          </div>

          {hasMore && (
            <div className="flex justify-center px-6">
              <button
                type="button"
                onClick={loadMore}
                className="glass-surface px-6 py-3 text-body font-medium text-primary ring-glow transition-all hover:ring-glow-strong"
              >
                Load More
              </button>
            </div>
          )}
        </>
      )}

      {selectedPhoto && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
          onClick={() => setSelectedPhoto(null)}
          role="presentation"
        >
          <div
            className="glass-surface relative max-h-[90vh] w-full max-w-4xl overflow-auto"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal
          >
            <button
              type="button"
              onClick={() => setSelectedPhoto(null)}
              className="absolute right-4 top-4 z-10 text-text-secondary hover:text-foreground"
              aria-label="Close"
            >
              <X className="size-6" />
            </button>

            <div className="flex items-center justify-center bg-black">
              {selectedPhoto.imageUrl ? (
                <img
                  src={selectedPhoto.imageUrl}
                  alt={selectedPhoto.caption || "Photo"}
                  className="max-h-[60vh] w-full object-contain"
                />
              ) : (
                <div className="flex h-96 w-full items-center justify-center text-6xl">📷</div>
              )}
            </div>

            <div className="p-6">
              {selectedPhoto.caption && (
                <p className="mb-2 text-body text-foreground">{selectedPhoto.caption}</p>
              )}
              <p className="mb-6 text-caption text-content-muted">
                {new Date(selectedPhoto.createdAt).toLocaleString()}
              </p>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => downloadPhoto(selectedPhoto)}
                  className={cn(
                    "flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3",
                    "text-body font-semibold text-black transition-all hover:bg-primary/90",
                  )}
                >
                  <Download className="size-4" />
                  Download
                </button>
                <button
                  type="button"
                  onClick={() => void handleDelete(selectedPhoto.id)}
                  className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-error/20 px-4 py-3 text-body font-semibold text-error transition-all hover:bg-error/30"
                >
                  <Trash2 className="size-4" />
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

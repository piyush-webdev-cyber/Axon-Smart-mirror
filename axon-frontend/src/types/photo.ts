/** Photo types. */

export interface Photo {
  id: string;
  userId: string;
  storagePath: string;
  thumbnailPath: string | null;
  fileName: string | null;
  fileSize: number | null;
  width: number | null;
  height: number | null;
  caption: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  thumbnailUrl: string | null;
  imageUrl: string | null;
}

export interface PhotoListResponse {
  photos: Photo[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

export interface PhotoShareResponse {
  photoId: string;
  shareUrl: string;
  expiresAt: string;
}

export interface GallerySessionResponse {
  token: string;
  expiresAt: string;
  sessionUrl: string;
}

export interface GallerySessionPhotosResponse {
  photos: Photo[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
  expiresAt: string;
}

/** Map backend camelCase JSON to Photo (handles both casings). */
export function normalizePhoto(raw: Record<string, unknown>): Photo {
  return {
    id: String(raw.id),
    userId: String(raw.userId ?? raw.user_id),
    storagePath: String(raw.storagePath ?? raw.storage_path),
    thumbnailPath: (raw.thumbnailPath ?? raw.thumbnail_path ?? null) as string | null,
    fileName: (raw.fileName ?? raw.file_name ?? null) as string | null,
    fileSize: (raw.fileSize ?? raw.file_size ?? null) as number | null,
    width: (raw.width ?? null) as number | null,
    height: (raw.height ?? null) as number | null,
    caption: (raw.caption ?? null) as string | null,
    metadata: (raw.metadata as Record<string, unknown>) ?? {},
    createdAt: String(raw.createdAt ?? raw.created_at),
    thumbnailUrl: (raw.thumbnailUrl ?? raw.thumbnail_url ?? null) as string | null,
    imageUrl: (raw.imageUrl ?? raw.image_url ?? null) as string | null,
  };
}

export function normalizePhotoList(raw: Record<string, unknown>): PhotoListResponse {
  const photos = Array.isArray(raw.photos)
    ? raw.photos.map((item) => normalizePhoto(item as Record<string, unknown>))
    : [];
  return {
    photos,
    total: Number(raw.total ?? 0),
    page: Number(raw.page ?? 1),
    pageSize: Number(raw.pageSize ?? raw.page_size ?? 20),
    hasMore: Boolean(raw.hasMore ?? raw.has_more),
  };
}

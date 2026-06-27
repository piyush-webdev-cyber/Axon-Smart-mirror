/** Photo and gallery API client. */

import type {
  GallerySessionPhotosResponse,
  GallerySessionResponse,
  Photo,
  PhotoListResponse,
  PhotoShareResponse,
} from "@/types/photo";
import { normalizePhoto, normalizePhotoList } from "@/types/photo";
import { getAuthHeaders } from "@/utils/authToken";
import { restApiBase } from "@/utils/restApiBase";

function parseApiError(body: unknown, fallback: string): string {
  if (typeof body === "object" && body !== null) {
    const envelope = body as {
      error?: { message?: string };
      detail?: string | unknown;
    };
    if (envelope.error?.message) return envelope.error.message;
    if (typeof envelope.detail === "string") return envelope.detail;
  }
  return fallback;
}

async function parseJson<T>(response: Response, fallbackError: string): Promise<T> {
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(parseApiError(error, fallbackError));
  }
  return response.json() as Promise<T>;
}

export const photoApi = {
  async uploadPhoto(file: File, caption: string | null): Promise<Photo> {
    const formData = new FormData();
    formData.append("file", file);
    if (caption) formData.append("caption", caption);

    const headers = await getAuthHeaders();
    const apiBase = restApiBase();
    const response = await fetch(`${apiBase}/photos`, {
      method: "POST",
      headers,
      body: formData,
    });

    const raw = await parseJson<Record<string, unknown>>(response, "Failed to upload photo");
    return normalizePhoto(raw);
  },

  async listPhotos(page: number, pageSize: number): Promise<PhotoListResponse> {
    const params = new URLSearchParams({
      page: page.toString(),
      page_size: pageSize.toString(),
    });

    const headers = await getAuthHeaders();
    const response = await fetch(`${restApiBase()}/photos?${params}`, { headers });
    const raw = await parseJson<Record<string, unknown>>(response, "Failed to list photos");
    return normalizePhotoList(raw);
  },

  async getPhoto(photoId: string): Promise<Photo> {
    const headers = await getAuthHeaders();
    const response = await fetch(`${restApiBase()}/photos/${photoId}`, { headers });
    const raw = await parseJson<Record<string, unknown>>(response, "Failed to get photo");
    return normalizePhoto(raw);
  },

  async deletePhoto(photoId: string): Promise<Photo> {
    const headers = await getAuthHeaders();
    const response = await fetch(`${restApiBase()}/photos/${photoId}`, {
      method: "DELETE",
      headers,
    });
    const raw = await parseJson<Record<string, unknown>>(response, "Failed to delete photo");
    return normalizePhoto(raw);
  },

  async createShareUrl(photoId: string): Promise<PhotoShareResponse> {
    const headers = await getAuthHeaders();
    const response = await fetch(`${restApiBase()}/photos/${photoId}/share`, {
      method: "POST",
      headers,
    });
    return parseJson<PhotoShareResponse>(response, "Failed to create share URL");
  },
};

export const galleryApi = {
  async createSession(): Promise<GallerySessionResponse> {
    const headers = await getAuthHeaders();
    const response = await fetch(`${restApiBase()}/gallery/sessions`, {
      method: "POST",
      headers: {
        ...headers,
        "Content-Type": "application/json",
      },
    });
    return parseJson<GallerySessionResponse>(response, "Failed to create gallery session");
  },

  async getSessionPhotos(
    token: string,
    page = 1,
    pageSize = 50,
  ): Promise<GallerySessionPhotosResponse> {
    const params = new URLSearchParams({
      page: page.toString(),
      page_size: pageSize.toString(),
    });
    const response = await fetch(
      `${restApiBase()}/gallery/sessions/${token}/photos?${params}`,
    );
    const raw = await parseJson<Record<string, unknown>>(response, "Failed to load session photos");
    return {
      ...normalizePhotoList(raw),
      expiresAt: String(raw.expiresAt ?? raw.expires_at),
    };
  },
};

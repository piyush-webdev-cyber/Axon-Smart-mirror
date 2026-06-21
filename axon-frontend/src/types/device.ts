/** Device linking types. */

export interface DeviceCode {
  id: string;
  code: string;
  status: "pending" | "linked" | "expired";
  expires_at: string;
  created_at: string;
}

export interface DeviceStatus {
  status: "pending" | "linked" | "expired";
  user_id: string | null;
  display_name: string | null;
  avatar_url: string | null;
  email?: string | null;
  mirror_token?: string | null;
}

export interface DeviceLinkResponse {
  success: boolean;
  message: string;
  user_id: string | null;
  display_name: string | null;
  email?: string | null;
  mirror_token?: string | null;
}

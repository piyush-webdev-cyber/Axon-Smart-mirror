import type { ThemeName } from "@/constants/themes";

export interface UserProfile {
  id: string;
  displayName: string | null;
  avatarUrl: string | null;
  email: string | null;
  createdAt: string;
}

export interface UserSettings {
  id: string;
  userId: string;
  theme: ThemeName;
  preferences: UserPreferences;
}

export interface UserPreferences {
  locale: string;
  temperatureUnit: "celsius" | "fahrenheit";
  clockFormat: "12h" | "24h";
  weatherLocation: string;
}

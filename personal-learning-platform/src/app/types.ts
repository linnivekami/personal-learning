export interface Configuration {
  development: boolean;
  releaseStage?: string;
  identityMode: string;
  services: Record<string, boolean>;
  vapidPublicKey: string | null;
  sandboxOrigin: string | null;
  pathlineUrl: string | null;
  pathlineConfigured?: boolean;
}
export interface Profile {
  timezone: string;
  name: string;
  preferences: Record<string, unknown>;
}
export interface PathlineLink {
  linked: boolean;
  school: string | null;
  verified: boolean;
}
export interface AppNotification {
  id: string;
  title: string;
  body: string;
  isRead: number;
  url: string;
}

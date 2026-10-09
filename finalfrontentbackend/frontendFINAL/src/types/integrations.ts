/** Mirrors backendFINAL/app/modules/integrations/schemas.py and the integration result models. */

export interface IntegrationStatus {
  openai: boolean;
  gemini: boolean;
  anthropic: boolean;
  grok: boolean;
  github: boolean;
  maps: boolean;
  email: boolean;
  slack: boolean;
  discord: boolean;
}

export type AIProvider = "openai" | "gemini" | "anthropic" | "grok";

export interface GitHubRepository {
  id: number;
  name: string;
  full_name: string;
  owner: { login: string; html_url: string };
  private: boolean;
  html_url: string;
  description: string | null;
  language: string | null;
  topics: string[];
  stargazers_count: number;
  forks_count: number;
  open_issues_count: number;
  default_branch: string;
  archived: boolean;
  updated_at: string;
}

export interface GitHubSearchParams {
  q: string;
  sort?: "stars" | "forks" | "help-wanted-issues" | "updated";
  per_page?: number;
  page?: number;
}

export interface GitHubSearchResult {
  total_count: number;
  incomplete_results: boolean;
  items: GitHubRepository[];
}

export interface GeocodeResult {
  name: string;
  latitude: number;
  longitude: number;
  kind: string | null;
}

export interface TestEmailInput {
  subject: string;
  html: string;
}

export interface EmailResult {
  id: string;
  provider: string;
}

export interface NotificationInput {
  channel: "slack" | "discord";
  text: string;
}

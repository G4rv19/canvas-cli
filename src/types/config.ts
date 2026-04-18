export interface CanvasConfig {
  domain: string;
  auth:
    | { type: 'token'; token: string }
    | { type: 'cookie'; cookie: string; csrfToken: string };
}

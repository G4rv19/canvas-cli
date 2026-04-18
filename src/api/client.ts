import chalk from 'chalk';
import type { CanvasConfig } from '../types/config.js';

export class CanvasApiError extends Error {
  constructor(
    public status: number,
    public body: string
  ) {
    super(`Canvas API error ${status}: ${body}`);
    this.name = 'CanvasApiError';
  }
}

export class CanvasClient {
  private baseUrl: string;
  private headers: Record<string, string>;

  constructor(config: CanvasConfig) {
    const cleanDomain = config.domain.replace(/^https?:\/\//, '').replace(/\/$/, '');
    this.baseUrl = `https://${cleanDomain}/api/v1`;

    if (config.auth.type === 'token') {
      this.headers = {
        Authorization: `Bearer ${config.auth.token}`,
        Accept: 'application/json',
      };
    } else {
      this.headers = {
        Cookie: config.auth.cookie,
        'X-CSRF-Token': config.auth.csrfToken,
        'X-Requested-With': 'XMLHttpRequest',
        Accept: 'application/json',
      };
    }
  }

  async fetch<T>(path: string, params?: Record<string, string | string[]>): Promise<T> {
    const url = this.buildUrl(path, params);
    const response = await this.fetchWithRetry(url);
    // Canvas redirects to SSO login when session expires (302)
    if (response.status >= 300 && response.status < 400) {
      throw new CanvasApiError(401, 'Session expired — redirected to login.');
    }
    if (!response.ok) {
      const body = await response.text();
      throw new CanvasApiError(response.status, body);
    }
    return (await response.json()) as T;
  }

  async fetchAll<T>(path: string, params?: Record<string, string | string[]>): Promise<T[]> {
    const mergedParams = { ...params, per_page: '100' };
    let url: string | null = this.buildUrl(path, mergedParams);
    const results: T[] = [];

    while (url) {
      const response = await this.fetchWithRetry(url);
      if (response.status >= 300 && response.status < 400) {
        throw new CanvasApiError(401, 'Session expired — redirected to login.');
      }
      if (!response.ok) {
        const body = await response.text();
        throw new CanvasApiError(response.status, body);
      }
      const data = (await response.json()) as T[];
      results.push(...data);
      url = this.getNextUrl(response.headers.get('link'));
    }

    return results;
  }

  private buildUrl(path: string, params?: Record<string, string | string[]>): string {
    const url = new URL(path.startsWith('http') ? path : `${this.baseUrl}${path}`);
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        if (value === undefined || value === null) continue;
        if (Array.isArray(value)) {
          for (const v of value) {
            url.searchParams.append(key, v);
          }
        } else {
          url.searchParams.set(key, value);
        }
      }
    }
    return url.toString();
  }

  private getNextUrl(linkHeader: string | null): string | null {
    if (!linkHeader) return null;
    const parts = linkHeader.split(',');
    for (const part of parts) {
      const match = part.match(/<([^>]+)>;\s*rel="next"/);
      if (match) return match[1];
    }
    return null;
  }

  private async fetchWithRetry(url: string, attempt = 0): Promise<Response> {
    const response = await globalThis.fetch(url, {
      headers: this.headers,
      redirect: 'manual',
    });

    if (response.status === 403 && attempt < 3) {
      const remaining = response.headers.get('x-rate-limit-remaining');
      if (remaining && parseFloat(remaining) <= 0) {
        const delay = Math.min(1000 * Math.pow(2, attempt) + Math.random() * 500, 30000);
        console.error(chalk.yellow(`Rate limited. Retrying in ${(delay / 1000).toFixed(1)}s...`));
        await new Promise((resolve) => setTimeout(resolve, delay));
        return this.fetchWithRetry(url, attempt + 1);
      }
    }

    if (response.status === 429 && attempt < 3) {
      const retryAfter = response.headers.get('retry-after');
      const delay = retryAfter
        ? parseFloat(retryAfter) * 1000
        : Math.min(1000 * Math.pow(2, attempt) + Math.random() * 500, 30000);
      console.error(chalk.yellow(`Rate limited. Retrying in ${(delay / 1000).toFixed(1)}s...`));
      await new Promise((resolve) => setTimeout(resolve, delay));
      return this.fetchWithRetry(url, attempt + 1);
    }

    return response;
  }
}

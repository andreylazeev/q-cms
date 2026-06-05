/**
 * @q-cms/cli — minimal HTTP client.
 *
 * Used by CLI commands to call the Q-CMS API without pulling in
 * the full `@q-cms/sdk` (which requires bundled types). For
 * programmatic usage prefer the SDK.
 */

import type { QcmsUserConfig } from './config.ts';

export interface HttpClientOptions {
  readonly baseUrl: string;
  readonly token?: string;
  readonly timeout?: number;
  readonly retries?: number;
  readonly fetchImpl?: typeof fetch;
}

export class HttpError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body: unknown,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

export class HttpTimeoutError extends Error {
  constructor(readonly timeout: number) {
    super(`Request timed out after ${timeout}ms`);
    this.name = 'HttpTimeoutError';
  }
}

/** Build a configured client from a saved profile. */
export function clientFromProfile(
  profile: QcmsUserConfig,
  options: Pick<HttpClientOptions, 'fetchImpl' | 'timeout' | 'retries'> = {},
): HttpClient {
  return new HttpClient({
    baseUrl: profile.baseUrl,
    token: profile.token,
    ...options,
  });
}

export class HttpClient {
  readonly #baseUrl: string;
  readonly #token: string | undefined;
  readonly #timeout: number;
  readonly #retries: number;
  readonly #fetch: typeof fetch;

  constructor(options: HttpClientOptions) {
    // strip trailing slash
    this.#baseUrl = options.baseUrl.replace(/\/$/, '');
    this.#token = options.token;
    this.#timeout = options.timeout ?? 30_000;
    this.#retries = options.retries ?? 3;
    this.#fetch = options.fetchImpl ?? globalThis.fetch;
  }

  async get<T>(path: string, query: Record<string, unknown> = {}): Promise<T> {
    return this.request<T>('GET', path, { query });
  }

  async post<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>('POST', path, { body });
  }

  async patch<T>(path: string, body: unknown): Promise<T> {
    return this.request<T>('PATCH', path, { body });
  }

  async put<T>(path: string, body: unknown): Promise<T> {
    return this.request<T>('PUT', path, { body });
  }

  async delete<T = void>(path: string): Promise<T> {
    return this.request<T>('DELETE', path);
  }

  async request<T>(
    method: string,
    path: string,
    options: { body?: unknown; query?: Record<string, unknown> } = {},
  ): Promise<T> {
    const url = this.#buildUrl(path, options.query);
    const init: RequestInit = {
      method,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'q-cms-cli/0.1.0',
        ...(this.#token ? { Authorization: `Bearer ${this.#token}` } : {}),
      },
      ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
    };

    let lastError: Error | undefined;
    for (let attempt = 0; attempt <= this.#retries; attempt++) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.#timeout);
      try {
        const res = await this.#fetch(url, { ...init, signal: controller.signal });
        clearTimeout(timeout);

        if (res.status >= 500 && attempt < this.#retries) {
          lastError = new HttpError(`Server error ${res.status}`, res.status, await this.#safeJson(res));
          await this.#backoff(attempt);
          continue;
        }

        if (!res.ok) {
          throw new HttpError(
            `HTTP ${res.status} ${res.statusText}: ${method} ${path}`,
            res.status,
            await this.#safeJson(res),
          );
        }

        if (res.status === 204) return undefined as T;
        return (await res.json()) as T;
      } catch (err) {
        clearTimeout(timeout);
        if (err instanceof HttpError) throw err;
        if ((err as Error).name === 'AbortError') {
          lastError = new HttpTimeoutError(this.#timeout);
        } else {
          lastError = err as Error;
        }
        if (attempt < this.#retries) {
          await this.#backoff(attempt);
          continue;
        }
        throw lastError;
      }
    }
    throw lastError ?? new Error('Request failed');
  }

  #buildUrl(path: string, query?: Record<string, unknown>): string {
    const fullPath = path.startsWith('/') ? path : `/${path}`;
    let url = `${this.#baseUrl}${fullPath}`;
    if (query && Object.keys(query).length > 0) {
      const params = new URLSearchParams();
      for (const [k, v] of Object.entries(query)) {
        if (v === undefined || v === null) continue;
        if (Array.isArray(v)) {
          for (const item of v) params.append(k, String(item));
        } else {
          params.set(k, String(v));
        }
      }
      const qs = params.toString();
      if (qs) url += `?${qs}`;
    }
    return url;
  }

  async #safeJson(res: Response): Promise<unknown> {
    try {
      return await res.json();
    } catch {
      return await res.text().catch(() => null);
    }
  }

  async #backoff(attempt: number): Promise<void> {
    const base = Math.min(1000 * 2 ** attempt, 10_000);
    const jitter = Math.random() * base * 0.3;
    await new Promise((r) => setTimeout(r, base + jitter));
  }
}

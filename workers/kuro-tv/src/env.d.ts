/**
 * Ambient type definitions for Cloudflare Workers & R2 storage
 */

interface R2ObjectBody {
  body: ReadableStream;
  httpEtag: string;
  range?: unknown;
  writeHttpMetadata(headers: Headers): void;
}

interface R2Bucket {
  get(key: string, options?: { range?: Headers; onlyIf?: Headers }): Promise<R2ObjectBody | null>;
  put(key: string, value: ReadableStream | ArrayBuffer | string, options?: unknown): Promise<unknown>;
}

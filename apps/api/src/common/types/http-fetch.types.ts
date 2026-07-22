/**
 * @file http-fetch.types.ts
 * @module Common/Types
 *
 * Minimal structural type for the global `fetch` response.
 *
 * Which lib declares `fetch`/`Response` differs between toolchains: the local
 * @types/node supplies them, while the deployment platform's TypeScript
 * resolved a set where `Response` had none of the members we use — the same
 * source compiled locally and failed in CI. Depending on a locally-declared
 * shape removes that ambient dependency entirely, so outbound HTTP typechecks
 * identically everywhere.
 */

/** The subset of the fetch Response contract this codebase actually uses. */
export interface HttpFetchResponse {
  ok: boolean;
  status: number;
  text(): Promise<string>;
  json(): Promise<unknown>;
}

/** `fetch` narrowed to the response shape above. */
export async function httpFetch(input: string, init?: unknown): Promise<HttpFetchResponse> {
  return (await (globalThis as unknown as {
    fetch: (i: string, n?: unknown) => Promise<unknown>;
  }).fetch(input, init)) as HttpFetchResponse;
}

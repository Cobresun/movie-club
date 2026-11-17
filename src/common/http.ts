/**
 * The app's HTTP client: `fetch`, with the two things every caller wants on
 * top of it — a JSON body in and out, and a thrown error for a response that
 * is not a success.
 */

/** A request that did not succeed. `response` is absent when no answer came back at all. */
export class HttpError<T = unknown> extends Error {
  readonly response?: { status: number; data: T };

  constructor(message: string, response?: { status: number; data: T }) {
    super(message);
    this.name = "HttpError";
    this.response = response;
  }
}

/** Narrows to an {@link HttpError}; `T` names the error body the caller expects to read. */
export function isHttpError<T = unknown>(error: unknown): error is HttpError<T> {
  return error instanceof HttpError;
}

interface RequestOptions {
  signal?: AbortSignal;
  /** Appended to the URL as its query string. */
  params?: Record<string, string>;
}

// A body that is not JSON (an empty 200 from a mutation, an HTML error page
// from the CDN) is handed back as the text it was.
function parseBody(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

async function request<T>(
  method: string,
  url: string,
  body: unknown,
  { signal, params }: RequestOptions = {},
): Promise<{ data: T }> {
  const isForm = body instanceof FormData;
  // Resolved against the page: `fetch` outside a browser has no base URL of
  // its own to resolve "/api/…" against.
  const target = new URL(url, window.location.href);
  for (const [name, value] of Object.entries(params ?? {})) {
    target.searchParams.append(name, value);
  }

  let response: Response;
  try {
    response = await fetch(target, {
      method,
      signal,
      // A form sets its own multipart content type, boundary included.
      headers: body === undefined || isForm ? undefined : { "Content-Type": "application/json" },
      body: body === undefined || isForm ? body : JSON.stringify(body),
    });
  } catch (error) {
    if (signal?.aborted === true) throw error;
    throw new HttpError("Network Error");
  }

  const data = parseBody(await response.text());
  if (!response.ok) {
    throw new HttpError(`Request failed with status code ${response.status}`, {
      status: response.status,
      data,
    });
  }
  // The response's shape is the caller's contract with the endpoint (the type
  // its handler passes to `ok<T>()`); nothing here can check it.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  return { data: data as T };
}

export const http = {
  get: <T = unknown>(url: string, options?: RequestOptions) =>
    request<T>("GET", url, undefined, options),
  post: <T = unknown>(url: string, body?: unknown, options?: RequestOptions) =>
    request<T>("POST", url, body, options),
  put: <T = unknown>(url: string, body?: unknown, options?: RequestOptions) =>
    request<T>("PUT", url, body, options),
  delete: <T = unknown>(url: string, options?: RequestOptions) =>
    request<T>("DELETE", url, undefined, options),
};

export type HttpClient = typeof http;

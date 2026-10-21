import type { Member, MemberInput, MemberListQuery } from '../types/member';

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  /** Per-field messages from a 400 `validation_error` (dotted keys such as `guardian.name`). */
  readonly fieldErrors: Record<string, string>;

  constructor(status: number, code: string, message: string, fieldErrors: Record<string, string> = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.fieldErrors = fieldErrors;
  }
}

function buildListUrl({ search, status }: MemberListQuery): string {
  const params = new URLSearchParams();
  if (search.trim()) params.set('search', search.trim());
  if (status !== 'all') params.set('status', status);
  const query = params.toString();
  return query ? `/api/members?${query}` : '/api/members';
}

function readFieldErrors(body: object): Record<string, string> {
  const raw = 'fieldErrors' in body ? body.fieldErrors : undefined;
  if (!raw || typeof raw !== 'object') return {};
  return Object.fromEntries(
    Object.entries(raw).filter((entry): entry is [string, string] => typeof entry[1] === 'string'),
  );
}

// Backend error contract: `{ error, message }` (see backend/src/middlewares/error-handler.ts).
async function toApiError(response: Response): Promise<ApiError> {
  try {
    const body: unknown = await response.json();
    if (body && typeof body === 'object' && 'error' in body && 'message' in body) {
      const { error, message } = body as { error: unknown; message: unknown };
      if (typeof error === 'string' && typeof message === 'string') {
        return new ApiError(response.status, error, message, readFieldErrors(body));
      }
    }
  } catch {
    // Not JSON (e.g. a proxy error page): fall through to the generic error.
  }
  return new ApiError(response.status, 'unknown_error', `Request failed (${response.status})`);
}

export async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  if (!response.ok) throw await toApiError(response);
  return (await response.json()) as T;
}

export function sendJson(method: 'POST' | 'PUT', body?: unknown): RequestInit {
  return body === undefined
    ? { method }
    : { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
}

function memberUrl(id: string, action = ''): string {
  return `/api/members/${encodeURIComponent(id)}${action}`;
}

export function fetchMembers(query: MemberListQuery, signal?: AbortSignal): Promise<Member[]> {
  return request<Member[]>(buildListUrl(query), { signal });
}

export function getMember(id: string, signal?: AbortSignal): Promise<Member> {
  return request<Member>(memberUrl(id), { signal });
}

export function createMember(input: MemberInput): Promise<Member> {
  return request<Member>('/api/members', sendJson('POST', input));
}

export function updateMember(id: string, input: MemberInput): Promise<Member> {
  return request<Member>(memberUrl(id), sendJson('PUT', input));
}

export function deactivateMember(id: string, reason: string): Promise<Member> {
  return request<Member>(memberUrl(id, '/deactivate'), sendJson('POST', { reason }));
}

export function reactivateMember(id: string): Promise<Member> {
  return request<Member>(memberUrl(id, '/reactivate'), sendJson('POST'));
}

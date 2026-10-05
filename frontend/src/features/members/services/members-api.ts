import type { Member, MemberListQuery } from '../types/member';

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

function buildListUrl({ search, status }: MemberListQuery): string {
  const params = new URLSearchParams();
  if (search.trim()) params.set('search', search.trim());
  if (status !== 'all') params.set('status', status);
  const query = params.toString();
  return query ? `/api/members?${query}` : '/api/members';
}

// Backend error contract: `{ error, message }` (see backend/src/middlewares/error-handler.ts).
async function toApiError(response: Response): Promise<ApiError> {
  try {
    const body: unknown = await response.json();
    if (body && typeof body === 'object' && 'error' in body && 'message' in body) {
      const { error, message } = body as { error: unknown; message: unknown };
      if (typeof error === 'string' && typeof message === 'string') {
        return new ApiError(response.status, error, message);
      }
    }
  } catch {
    // Not JSON (e.g. a proxy error page): fall through to the generic error.
  }
  return new ApiError(response.status, 'unknown_error', `Request failed (${response.status})`);
}

export async function fetchMembers(query: MemberListQuery, signal?: AbortSignal): Promise<Member[]> {
  const response = await fetch(buildListUrl(query), { signal });
  if (!response.ok) throw await toApiError(response);
  return (await response.json()) as Member[];
}

import { afterEach, describe, expect, it, vi } from 'vitest';
import { jsonResponse } from '../../members/test/fixtures';
import { buildDiscipline } from '../test/fixtures';
import {
  ApiError,
  createDiscipline,
  deactivateDiscipline,
  fetchDisciplines,
  reactivateDiscipline,
  updateDiscipline,
} from './disciplines-api';

const fetchMock = vi.fn<typeof fetch>();

function stubFetch(response: Response) {
  fetchMock.mockResolvedValueOnce(response);
  vi.stubGlobal('fetch', fetchMock);
}

afterEach(() => {
  fetchMock.mockReset();
  vi.unstubAllGlobals();
});

describe('fetchDisciplines', () => {
  it('requests /api/disciplines with encoded search and status', async () => {
    stubFetch(jsonResponse([]));

    await fetchDisciplines({ search: 'vóley 2', status: 'inactive' });

    expect(fetchMock.mock.calls[0][0]).toBe('/api/disciplines?search=v%C3%B3ley+2&status=inactive');
  });

  it('omits empty search and the "all" status', async () => {
    stubFetch(jsonResponse([]));

    await fetchDisciplines({ search: '  ', status: 'all' });

    expect(fetchMock.mock.calls[0][0]).toBe('/api/disciplines');
  });

  it('returns the parsed disciplines', async () => {
    const disciplines = [buildDiscipline()];
    stubFetch(jsonResponse(disciplines));

    await expect(fetchDisciplines({ search: '', status: 'all' })).resolves.toEqual(disciplines);
  });

  it('throws an ApiError carrying status, code and field errors', async () => {
    stubFetch(
      jsonResponse({ error: 'validation_error', message: 'Invalid', fieldErrors: { name: 'Name is required' } }, 400),
    );

    const error = await fetchDisciplines({ search: '', status: 'all' }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 400, code: 'validation_error', fieldErrors: { name: 'Name is required' } });
  });
});

describe('mutations', () => {
  const input = { name: 'Vóley', teacherName: 'Ana Gómez' };

  it('creates with a JSON POST', async () => {
    stubFetch(jsonResponse(buildDiscipline(input), 201));

    await createDiscipline(input);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/disciplines');
    expect(init).toMatchObject({ method: 'POST', body: JSON.stringify(input) });
  });

  it('updates with a JSON PUT to the encoded id', async () => {
    stubFetch(jsonResponse(buildDiscipline(input)));

    await updateDiscipline('disc/1', input);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/disciplines/disc%2F1');
    expect(init).toMatchObject({ method: 'PUT', body: JSON.stringify(input) });
  });

  it('posts to the deactivate and reactivate actions without a body', async () => {
    stubFetch(jsonResponse(buildDiscipline({ status: 'inactive' })));
    await deactivateDiscipline('disc-1');
    stubFetch(jsonResponse(buildDiscipline()));
    await reactivateDiscipline('disc-1');

    expect(fetchMock.mock.calls[0]).toEqual(['/api/disciplines/disc-1/deactivate', { method: 'POST' }]);
    expect(fetchMock.mock.calls[1]).toEqual(['/api/disciplines/disc-1/reactivate', { method: 'POST' }]);
  });

  it('surfaces a 409 conflict as an ApiError', async () => {
    stubFetch(jsonResponse({ error: 'conflict', message: 'A discipline with this name already exists' }, 409));

    await expect(createDiscipline(input)).rejects.toMatchObject({ status: 409, code: 'conflict' });
  });
});

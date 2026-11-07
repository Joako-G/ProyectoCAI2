import { describe, expect, it } from 'vitest';
import { accessHeadline, describeRecognizeError } from './access-format';
import { ApiError } from '../../members/services/members-api';

describe('face recognition copy', () => {
  it('says a face nobody matched is not recognized and asks for the DNI', () => {
    expect(accessHeadline({ result: 'red', reason: 'not_recognized' })).toBe('No reconocido — ingrese el DNI');
  });

  it('says the recognition is unavailable on a 503 and points to the DNI', () => {
    expect(describeRecognizeError(new ApiError(503, 'faces_unavailable', 'x'))).toBe('Reconocimiento facial no disponible — use el DNI');
  });

  it('keeps other failures short and points to the DNI', () => {
    expect(describeRecognizeError(new ApiError(500, 'x', 'x'))).toBe('No se pudo reconocer la cara. Use el DNI.');
    expect(describeRecognizeError(new ApiError(403, 'forbidden', 'x'))).toBe('No tiene permiso para usar el reconocimiento facial.');
  });
});

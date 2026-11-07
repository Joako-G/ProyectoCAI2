export type CameraErrorCode = 'unsupported' | 'denied' | 'not_found' | 'unknown';

/** Why the camera could not be opened, reduced to the cases the staff can act on. */
export class CameraError extends Error {
  readonly code: CameraErrorCode;

  constructor(code: CameraErrorCode) {
    super(`Camera unavailable: ${code}`);
    this.name = 'CameraError';
    this.code = code;
  }
}

function classify(error: unknown): CameraErrorCode {
  const name = error instanceof DOMException || error instanceof Error ? error.name : '';
  if (name === 'NotAllowedError' || name === 'SecurityError') return 'denied';
  if (name === 'NotFoundError' || name === 'OverconstrainedError' || name === 'NotReadableError') return 'not_found';
  return 'unknown';
}

/** Opens the front camera. The browser only allows it on localhost or HTTPS, where `mediaDevices` exists. */
export async function openCamera(): Promise<MediaStream> {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) throw new CameraError('unsupported');
  try {
    return await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } }, audio: false });
  } catch (error) {
    throw new CameraError(classify(error));
  }
}

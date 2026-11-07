import { NETWORK_ERROR_MESSAGE } from '../../members/hooks/useMemberDetail';
import { ApiError } from '../../members/services/members-api';
import { CameraError } from '../services/camera';

export const FACES_UNAVAILABLE_MESSAGE = 'El reconocimiento facial no está disponible en este momento.';
export const MODELS_ERROR_MESSAGE = 'No se pudieron cargar los modelos de reconocimiento facial.';

/** Spanish copy for a camera that could not be opened. */
export function describeCameraError(error: unknown): string {
  if (error instanceof CameraError) {
    if (error.code === 'denied') return 'Se denegó el permiso de la cámara. Habilítelo en el navegador.';
    if (error.code === 'not_found') return 'No se encontró ninguna cámara en este equipo.';
    if (error.code === 'unsupported') return 'Este navegador no permite usar la cámara. Use localhost o HTTPS.';
  }
  return 'No se pudo abrir la cámara.';
}

/** Spanish copy for a failed face request; backend messages are English and are never shown. */
export function describeFaceApiError(error: unknown): string {
  if (!(error instanceof ApiError)) return NETWORK_ERROR_MESSAGE;
  if (error.status === 503) return FACES_UNAVAILABLE_MESSAGE;
  if (error.status === 403) return 'No tiene permiso para gestionar el reconocimiento facial.';
  if (error.status === 409) return 'El socio está inactivo: no se puede registrar su cara.';
  if (error.status === 404) return 'No hay una cara registrada para este socio.';
  return 'No se pudo completar la operación. Intente de nuevo.';
}

export const NO_FACE_MESSAGE = 'No se detectó ninguna cara. Mire a la cámara e intente de nuevo.';
export const MANY_FACES_MESSAGE = 'Hay más de una cara en la imagen. Debe verse una sola persona.';

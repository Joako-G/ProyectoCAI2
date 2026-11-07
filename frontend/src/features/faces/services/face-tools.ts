import type { FaceDetector } from '../types/face';
import { openCamera } from './camera';

/**
 * The only door to the camera and the models. Screens and hooks go through it, so tests replace this one module
 * with fakes and never need a camera or the real models. The heavy library loads here, on demand.
 */
export const faceTools = {
  openCamera,
  loadDetector: async (): Promise<FaceDetector> => (await import('./face-engine')).createFaceDetector(),
};

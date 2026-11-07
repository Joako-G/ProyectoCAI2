import * as faceapi from '@vladmandic/face-api';
import type { FaceDetector } from '../types/face';

// Served by the frontend itself (copied from the package by scripts/copy-face-models.mjs), so the club needs no internet.
const MODEL_URL = '/models/face';

/** HAVE_CURRENT_DATA: the video has a frame to look at. */
const HAVE_CURRENT_DATA = 2;

/**
 * The real detector: tiny face detector, 68-point landmarks and the 128-number recognition net, all in the browser.
 * Only this file imports face-api, and face-tools loads it on demand, so other screens never pay for it.
 * Nothing here leaves the browser: the video frame is read in memory and only the descriptor is returned.
 */
export async function createFaceDetector(): Promise<FaceDetector> {
  await Promise.all([
    faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
    faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
    faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
  ]);
  const options = new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.5 });

  return {
    async detect(video) {
      if (video.readyState < HAVE_CURRENT_DATA) return { kind: 'none' };
      // Counting faces is cheap; the descriptor is computed only when exactly one is in view.
      const found = await faceapi.detectAllFaces(video, options);
      if (found.length === 0) return { kind: 'none' };
      if (found.length > 1) return { kind: 'many' };
      const single = await faceapi.detectSingleFace(video, options).withFaceLandmarks().withFaceDescriptor();
      return single ? { kind: 'one', descriptor: Array.from(single.descriptor) } : { kind: 'none' };
    },
  };
}

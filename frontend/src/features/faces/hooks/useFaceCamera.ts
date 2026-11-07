import { useCallback, useEffect, useRef, useState } from 'react';
import { faceTools } from '../services/face-tools';
import type { FaceDetector, FaceScan } from '../types/face';
import { describeCameraError, MODELS_ERROR_MESSAGE } from '../utils/face-messages';

export type FaceCameraState =
  | { phase: 'idle' }
  | { phase: 'starting' }
  | { phase: 'ready' }
  | { phase: 'error'; message: string };

const stopStream = (stream: MediaStream | null | undefined) => stream?.getTracks().forEach((track) => track.stop());

/**
 * Owns the camera stream and the detector for one screen. Nothing starts until `start()`, which is when the
 * library and models load. The stream is always released on `stop()` and on unmount, so the camera light goes off.
 * Render the `videoRef` element while the phase is `starting` or `ready`.
 */
export function useFaceCamera() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectorRef = useRef<FaceDetector | null>(null);
  // Bumped by every start and stop, so a start that finishes after a stop knows it is stale and releases its stream.
  const generation = useRef(0);
  const [state, setState] = useState<FaceCameraState>({ phase: 'idle' });

  const release = useCallback(() => {
    generation.current += 1;
    stopStream(streamRef.current);
    streamRef.current = null;
    detectorRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  const stop = useCallback(() => {
    release();
    setState({ phase: 'idle' });
  }, [release]);

  const start = useCallback(async () => {
    release();
    const mine = generation.current;
    setState({ phase: 'starting' });
    // Both run together: the camera prompt and the model download overlap.
    const [camera, detector] = await Promise.allSettled([faceTools.openCamera(), faceTools.loadDetector()]);
    const openedStream = camera.status === 'fulfilled' ? camera.value : null;
    if (mine !== generation.current) {
      stopStream(openedStream);
      return;
    }
    if (camera.status === 'rejected') {
      setState({ phase: 'error', message: describeCameraError(camera.reason) });
      return;
    }
    if (detector.status === 'rejected') {
      stopStream(openedStream);
      setState({ phase: 'error', message: MODELS_ERROR_MESSAGE });
      return;
    }
    streamRef.current = camera.value;
    detectorRef.current = detector.value;
    if (videoRef.current) videoRef.current.srcObject = camera.value;
    setState({ phase: 'ready' });
  }, [release]);

  // Leaving the screen releases the camera without touching state.
  useEffect(() => release, [release]);

  /** One look at the current frame; undefined when the camera is not ready. */
  const scan = useCallback(async (): Promise<FaceScan | undefined> => {
    const video = videoRef.current;
    const detector = detectorRef.current;
    return video && detector ? detector.detect(video) : undefined;
  }, []);

  return { videoRef, state, start, stop, scan };
}

export type FaceCamera = ReturnType<typeof useFaceCamera>;

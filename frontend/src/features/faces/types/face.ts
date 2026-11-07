/** What one look at the camera frame found. A descriptor exists only when exactly one face is in view. */
export type FaceScan = { kind: 'none' } | { kind: 'many' } | { kind: 'one'; descriptor: number[] };

/** Finds faces in a playing video element. The real one runs face-api in the browser; tests fake it. */
export interface FaceDetector {
  detect(video: HTMLVideoElement): Promise<FaceScan>;
}

export interface FaceStatus {
  enrolled: boolean;
  enrolledAt?: string;
}

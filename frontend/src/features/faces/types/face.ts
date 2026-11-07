/** A face box as fractions (0 to 1) of the video frame, so it does not depend on the camera resolution. */
export interface RelativeBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * What one cheap look at the camera frame measured. Optional facts are unknown when the detector could not
 * measure them; an unknown fact never blocks a capture. There is no descriptor here: that is computed on demand.
 */
export interface FrameFacts {
  faceCount: number;
  /** Box of the face when exactly one is in view. */
  box?: RelativeBox;
  /** Detector confidence, 0 to 1. */
  score?: number;
  /** Head turn left or right: 0 looking straight at the camera (see head-pose.ts). */
  yaw?: number;
  /** Head tilt up or down: 0 looking straight at the camera (see head-pose.ts). */
  pitch?: number;
  /** Mean brightness of the face region, 0 to 255. */
  brightness?: number;
  /** Mean brightness of the whole frame, 0 to 255; compared with the face to spot a backlit person. */
  surroundBrightness?: number;
}

/** The facts of a look plus how much the face moved since the previous look (fraction of the frame). */
export interface CaptureFrame extends FrameFacts {
  movement?: number;
}

/** Finds faces in a playing video element. The real one runs face-api in the browser; tests fake it. */
export interface FaceDetector {
  /** A cheap look for live guidance: counts faces and measures the frame. */
  look(video: HTMLVideoElement): Promise<FrameFacts>;
  /** The 128-number descriptor of the single face in view; undefined when there is not exactly one. */
  describe(video: HTMLVideoElement): Promise<number[] | undefined>;
}

export interface FaceStatus {
  enrolled: boolean;
  enrolledAt?: string;
}

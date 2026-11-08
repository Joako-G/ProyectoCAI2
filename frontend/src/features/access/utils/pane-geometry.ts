import type { RelativeBox } from '../../faces/types/face';

/** The camera pane of the stage, in stage pixels. */
export const CAMERA_PANE = { width: 710, height: 700 } as const;

export interface PaneRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** Where the framing rectangle sits in the approved design when no face is detected: inside the oval, centered. */
export const FALLBACK_FRAME: PaneRect = { left: 224, top: 201, width: 262, height: 230 };

// Until the video reports its real size, assume the 4:3 the camera is asked for.
const ASSUMED_VIDEO = { width: 640, height: 480 };

/**
 * Maps a face box (fractions of the camera image) to a rectangle in the camera pane. The video fills the pane with
 * `object-fit: cover` and is mirrored, so the image is scaled to cover, centered (the overflow is cropped) and
 * flipped horizontally. The result is clamped to the pane. Without a box it is the design's fixed position.
 */
export function frameForFace(box: RelativeBox | undefined, video: { width: number; height: number }): PaneRect {
  if (!box) return FALLBACK_FRAME;
  const source = video.width > 0 && video.height > 0 ? video : ASSUMED_VIDEO;
  const scale = Math.max(CAMERA_PANE.width / source.width, CAMERA_PANE.height / source.height);
  const shownWidth = source.width * scale;
  const shownHeight = source.height * scale;
  const cropX = (shownWidth - CAMERA_PANE.width) / 2;
  const cropY = (shownHeight - CAMERA_PANE.height) / 2;
  const mirroredX = 1 - (box.x + box.width);
  const rawLeft = mirroredX * shownWidth - cropX;
  const rawTop = box.y * shownHeight - cropY;
  const left = Math.max(0, rawLeft);
  const top = Math.max(0, rawTop);
  const right = Math.min(CAMERA_PANE.width, rawLeft + box.width * shownWidth);
  const bottom = Math.min(CAMERA_PANE.height, rawTop + box.height * shownHeight);
  return { left, top, width: Math.max(0, right - left), height: Math.max(0, bottom - top) };
}

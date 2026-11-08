/** The size the approved kiosk design is drawn at: 710 px of camera plus a 470 px panel, 700 px tall. */
export const STAGE_WIDTH = 1180;
export const STAGE_HEIGHT = 700;

const MIN_SCALE = 0.01;

/** The uniform scale that makes the whole stage fit a viewport, so the screen is centered at any monitor size. */
export function fitScale(viewportWidth: number, viewportHeight: number): number {
  return Math.max(MIN_SCALE, Math.min(viewportWidth / STAGE_WIDTH, viewportHeight / STAGE_HEIGHT));
}

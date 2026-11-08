import { describe, expect, it } from 'vitest';
import { estimateHeadPose } from './head-pose';

/** A 68-point face where only the points the estimate reads are set: a symmetric, frontal face 100 px wide. */
function landmarks(overrides: Record<number, { x: number; y: number }> = {}) {
  const points = Array.from({ length: 68 }, () => ({ x: 50, y: 50 }));
  points[0] = { x: 0, y: 40 };
  points[16] = { x: 100, y: 40 };
  points[8] = { x: 50, y: 120 };
  for (let index = 36; index <= 47; index += 1) points[index] = { x: 50, y: 50 };
  points[30] = { x: 50, y: 50 + 0.45 * 70 };
  for (const [index, point] of Object.entries(overrides)) points[Number(index)] = point;
  return points;
}

describe('estimateHeadPose', () => {
  it('reads a frontal face as no yaw and no pitch', () => {
    const pose = estimateHeadPose(landmarks());
    expect(pose.yaw).toBeCloseTo(0);
    expect(pose.pitch).toBeCloseTo(0);
  });

  it('reads a nose shifted sideways as yaw, with the sign of the shift', () => {
    expect(estimateHeadPose(landmarks({ 30: { x: 70, y: 81.5 } })).yaw).toBeCloseTo(0.2);
    expect(estimateHeadPose(landmarks({ 30: { x: 30, y: 81.5 } })).yaw).toBeCloseTo(-0.2);
  });

  it('reads a nose moved up or down the face as pitch', () => {
    expect(estimateHeadPose(landmarks({ 30: { x: 50, y: 100 } })).pitch).toBeGreaterThan(0.1);
    expect(estimateHeadPose(landmarks({ 30: { x: 50, y: 60 } })).pitch).toBeLessThan(-0.1);
  });

  it('gives up on degenerate landmarks', () => {
    expect(estimateHeadPose(landmarks({ 16: { x: 0, y: 40 } }))).toEqual({});
  });
});

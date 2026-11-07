import * as faceapi from '@vladmandic/face-api';
import type { FaceDetector, FrameFacts } from '../types/face';
import { regionBrightness } from '../utils/brightness';
import { estimateHeadPose } from '../utils/head-pose';

// Served by the frontend itself (copied from the package by scripts/copy-face-models.mjs), so the club needs no internet.
const MODEL_URL = '/models/face';

/** HAVE_CURRENT_DATA: the video has a frame to look at. */
const HAVE_CURRENT_DATA = 2;

/**
 * Live guidance runs several times a second on a modest PC, so it uses the smallest input the tiny detector
 * accepts well (a multiple of 32). A face this small in the frame is "too far" anyway.
 */
const LOOK_INPUT_SIZE = 256;
/** The final capture runs once per shot, so it can afford a larger input for a steadier box and landmarks. */
const DESCRIBE_INPUT_SIZE = 416;
const SCORE_THRESHOLD = 0.5;

/** Brightness is measured on a frame downscaled to this size: a few thousand pixels per look. */
const BRIGHTNESS_WIDTH = 64;
const BRIGHTNESS_HEIGHT = 48;

let brightnessContext: CanvasRenderingContext2D | null | undefined;

/** Mean brightness of the face region and of the whole frame, from a tiny downscaled copy of the video frame. */
function measureBrightness(video: HTMLVideoElement, box: { x: number; y: number; width: number; height: number }) {
  if (brightnessContext === undefined) {
    const canvas = document.createElement('canvas');
    canvas.width = BRIGHTNESS_WIDTH;
    canvas.height = BRIGHTNESS_HEIGHT;
    brightnessContext = canvas.getContext('2d', { willReadFrequently: true });
  }
  if (!brightnessContext) return {};
  brightnessContext.drawImage(video, 0, 0, BRIGHTNESS_WIDTH, BRIGHTNESS_HEIGHT);
  const { data } = brightnessContext.getImageData(0, 0, BRIGHTNESS_WIDTH, BRIGHTNESS_HEIGHT);
  return {
    brightness: regionBrightness(data, BRIGHTNESS_WIDTH, BRIGHTNESS_HEIGHT, {
      x: box.x * BRIGHTNESS_WIDTH,
      y: box.y * BRIGHTNESS_HEIGHT,
      width: box.width * BRIGHTNESS_WIDTH,
      height: box.height * BRIGHTNESS_HEIGHT,
    }),
    surroundBrightness: regionBrightness(data, BRIGHTNESS_WIDTH, BRIGHTNESS_HEIGHT),
  };
}

/**
 * The real detector: tiny face detector, 68-point landmarks and the 128-number recognition net, all in the browser.
 * Only this file imports face-api, and face-tools loads it on demand, so other screens never pay for it.
 * Nothing here leaves the browser: the video frame is read in memory and only the descriptor is returned.
 * The more accurate SSD MobileNet detector is not among the copied models, so the tiny detector serves both
 * the live look and the final capture (the descriptor net aligns the face from its own landmarks either way).
 */
export async function createFaceDetector(): Promise<FaceDetector> {
  await Promise.all([
    faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
    faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
    faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
  ]);
  const lookOptions = new faceapi.TinyFaceDetectorOptions({ inputSize: LOOK_INPUT_SIZE, scoreThreshold: SCORE_THRESHOLD });
  const describeOptions = new faceapi.TinyFaceDetectorOptions({ inputSize: DESCRIBE_INPUT_SIZE, scoreThreshold: SCORE_THRESHOLD });

  return {
    async look(video): Promise<FrameFacts> {
      if (video.readyState < HAVE_CURRENT_DATA) return { faceCount: 0 };
      const found = await faceapi.detectAllFaces(video, lookOptions).withFaceLandmarks();
      const [only] = found;
      if (!only || found.length > 1) return { faceCount: found.length };

      const { relativeBox, score, imageDims } = only.detection;
      const box = { x: relativeBox.x, y: relativeBox.y, width: relativeBox.width, height: relativeBox.height };
      const pose = estimateHeadPose(
        only.landmarks.positions.map((point) => ({ x: point.x / imageDims.width, y: point.y / imageDims.height })),
      );
      return { faceCount: 1, box, score, ...pose, ...measureBrightness(video, box) };
    },

    async describe(video) {
      if (video.readyState < HAVE_CURRENT_DATA) return undefined;
      const found = await faceapi.detectAllFaces(video, describeOptions).withFaceLandmarks().withFaceDescriptors();
      const [only] = found;
      return only && found.length === 1 ? Array.from(only.descriptor) : undefined;
    },
  };
}

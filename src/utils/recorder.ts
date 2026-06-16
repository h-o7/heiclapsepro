/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { TimelineFrame } from '../types';

/**
 * Automatically detects the best supported video format in the current browser.
 */
export function getSupportedMimeType(): string {
  const types = [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm',
    'video/mp4',
  ];

  for (const type of types) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(type)) {
      return type;
    }
  }
  return '';
}

interface RecordOptions {
  frames: TimelineFrame[];
  fps: number;
  width: number;
  height: number;
  onProgress: (current: number, total: number) => void;
}

/**
 * Programmatically renders the timelapse timeline onto a hidden canvas
 * and captures it into a video blob at the exact designated frame rate.
 */
export function compileVideo({
  frames,
  fps,
  width,
  height,
  onProgress,
}: RecordOptions): Promise<Blob> {
  return new Promise((resolve, reject) => {
    if (frames.length === 0) {
      reject(new Error('Timeline is empty. Add photo frames first.'));
      return;
    }

    const mimeType = getSupportedMimeType();
    if (!mimeType) {
      reject(new Error('MediaRecorder is not fully supported in this browser. Please try Chrome, Firefox or Safari.'));
      return;
    }

    // Create an offscreen canvas
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      reject(new Error('Unable to create 2D canvas context.'));
      return;
    }

    // Capture canvas stream (0 means manual control, or pass FPS)
    const stream = canvas.captureStream(fps);
    const recordedChunks: Blob[] = [];
    
    // Create MediaRecorder with high quality video bitrate
    const mediaRecorder = new MediaRecorder(stream, {
      mimeType,
      videoBitsPerSecond: 8000000, // 8 Mbps for high fidelity
    });

    mediaRecorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) {
        recordedChunks.push(event.data);
      }
    };

    mediaRecorder.onstop = () => {
      const videoBlob = new Blob(recordedChunks, { type: mimeType });
      resolve(videoBlob);
    };

    mediaRecorder.onerror = (err) => {
      reject(err);
    };

    // Load helper to draw an image frame with individual rotations/flips
    const drawFrame = (frame: TimelineFrame): Promise<void> => {
      return new Promise((resolveFrame) => {
        const img = new Image();
        img.src = frame.url;
        img.onload = () => {
          // Clear background (pitch black as standard video letterboxing)
          ctx.fillStyle = '#000000';
          ctx.fillRect(0, 0, width, height);

          ctx.save();
          
          // Translate to center for rotation & scale
          ctx.translate(width / 2, height / 2);

          // Apply rotation
          if (frame.rotation > 0) {
            ctx.rotate((frame.rotation * Math.PI) / 180);
          }

          // Apply flip
          if (frame.flipped) {
            ctx.scale(-1, 1);
          }

          // Calculate fitted sizes (contain aspect ratios inside the output frame dimensions)
          // Adjust based on rotation (if portrait rotated, swap aspect check)
          const isRotated90or270 = frame.rotation === 90 || frame.rotation === 270;
          const imgW = isRotated90or270 ? img.naturalHeight : img.naturalWidth;
          const imgH = isRotated90or270 ? img.naturalWidth : img.naturalHeight;
          const aspect = imgW / imgH;

          let targetW = width;
          let targetH = height;

          if (width / height > aspect) {
            targetW = height * aspect;
          } else {
            targetH = width / aspect;
          }

          // Switch width/height measurements if we are drawing pre-rotated coordinates
          if (isRotated90or270) {
            // Since we canvas-translate to center and rotate, drawing sizes should match original image dimensions fitted
            const factor = Math.min(width / imgH, height / imgW);
            ctx.drawImage(img, -img.naturalWidth * factor / 2, -img.naturalHeight * factor / 2, img.naturalWidth * factor, img.naturalHeight * factor);
          } else {
            ctx.drawImage(img, -targetW / 2, -targetH / 2, targetW, targetH);
          }

          ctx.restore();
          resolveFrame();
        };
        img.onerror = () => {
          // If picture fails, render a dark screen or placeholder
          ctx.fillStyle = '#1e1e2e';
          ctx.fillRect(0, 0, width, height);
          ctx.fillStyle = '#f38ba8';
          ctx.font = '24px Inter, sans-serif';
          ctx.fillText(`Error loading frame: ${frame.name}`, 40, height / 2);
          resolveFrame();
        };
      });
    };

    // Start recording immediately
    mediaRecorder.start();

    // Loop through frames sequentially with fine-grained timers
    let currentFrameIndex = 0;
    const intervalMs = 1000 / fps;

    async function processTimeline() {
      if (currentFrameIndex >= frames.length) {
        // Yield time for mediarecorder to finish processing tail canvas frames
        setTimeout(() => {
          mediaRecorder.stop();
        }, 500);
        return;
      }

      const frame = frames[currentFrameIndex];
      onProgress(currentFrameIndex + 1, frames.length);
      
      await drawFrame(frame);

      currentFrameIndex++;
      // Sleep to allow encoder to capture at the correct frame pacing
      setTimeout(processTimeline, intervalMs);
    }

    // Unleash processing
    processTimeline();
  });
}

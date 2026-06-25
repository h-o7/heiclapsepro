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
    'video/mp4;codecs=avc1',
    'video/mp4;codecs=h264',
    'video/mp4',
    'video/webm;codecs=vp9',
    'video/webm;codecs=vp8',
    'video/webm',
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
  bitrate?: number;
  format?: 'mp4' | 'webm';
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
  bitrate,
  format,
}: RecordOptions): Promise<Blob> {
  return new Promise((resolve, reject) => {
    if (frames.length === 0) {
      reject(new Error('Timeline is empty. Add photo frames first.'));
      return;
    }

    let mimeType = '';
    if (format === 'mp4') {
      const mp4Types = [
        'video/mp4;codecs=avc1',
        'video/mp4;codecs=h264',
        'video/mp4',
      ];
      for (const t of mp4Types) {
        if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(t)) {
          mimeType = t;
          break;
        }
      }
      
      // If native MP4 is not supported (e.g. Firefox), fallback to clean video-only WebM
      if (!mimeType) {
        const webmTypes = [
          'video/webm;codecs=vp9',
          'video/webm;codecs=vp8',
          'video/webm',
        ];
        for (const t of webmTypes) {
          if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(t)) {
            mimeType = t;
            break;
          }
        }
      }
    } else {
      // User selected WebM format explicitly
      const webmTypes = [
        'video/webm;codecs=vp9',
        'video/webm;codecs=vp8',
        'video/webm',
      ];
      for (const t of webmTypes) {
        if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(t)) {
          mimeType = t;
          break;
        }
      }
    }

    if (!mimeType) {
      mimeType = getSupportedMimeType();
    }

    if (!mimeType) {
      reject(new Error('MediaRecorder is not fully supported in this browser. Please try Chrome, Edge, Firefox or Safari.'));
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
      videoBitsPerSecond: bitrate || 45000000, // custom bitrate, default 45 Mbps
    });

    mediaRecorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) {
        recordedChunks.push(event.data);
      }
    };

    mediaRecorder.onstop = () => {
      // If we recorded a real mp4 stream, use video/mp4. Otherwise, use video/webm.
      const finalMime = mimeType.startsWith('video/mp4') ? 'video/mp4' : 'video/webm';
      const videoBlob = new Blob(recordedChunks, { type: finalMime });
      resolve(videoBlob);
    };

    mediaRecorder.onerror = (err) => {
      reject(err);
    };

    // Load helper to draw an image frame with individual rotations/flips
    const drawFrame = (frame: TimelineFrame): Promise<void> => {
      return new Promise((resolveFrame) => {
        const img = new Image();
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
          const imgW = (isRotated90or270 ? img.naturalHeight : img.naturalWidth) || 1920;
          const imgH = (isRotated90or270 ? img.naturalWidth : img.naturalHeight) || 1080;
          const aspect = imgW / imgH || 16/9;

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
            const factor = Math.min(width / imgH, height / imgW) || 1;
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
        img.src = frame.url;
      });
    };

    // Pre-draw the first frame to initialize the canvas stream track with valid video dimensions and content
    drawFrame(frames[0]).then(() => {
      // Start recording with a timeslice of 100ms to guarantee data chunks are flushed periodically,
      // avoiding silent buffer failures or empty blobs on canvas recording.
      mediaRecorder.start(100);

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

      // Start processing the timeline frames
      processTimeline();
    }).catch((err) => {
      reject(err);
    });
  });
}

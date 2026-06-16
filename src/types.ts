/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface HEICFile {
  id: string;
  file: File;
  name: string;
  size: number;
  status: 'pending' | 'converting' | 'done' | 'error';
  errorMsg?: string;
  convertedBlob?: Blob;
  convertedUrl?: string; // object URL for preview
  progress: number; // 0 to 100
}

export interface TimelineFrame {
  id: string;
  name: string;
  size: number;
  url: string; // Object URL for rendering
  blob: Blob;
  width: number;
  height: number;
  rotation: number; // 0, 90, 180, 270 degrees
  flipped: boolean;
  aspectRatio: number; // width / height
}

export type PlayerState = 'playing' | 'paused' | 'stopped';

export type ActiveTab = 'timelapse' | 'converter';

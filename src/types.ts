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

export type ActiveTab = 'converter' | 'worklog';

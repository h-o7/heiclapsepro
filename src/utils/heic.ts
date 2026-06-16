/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

let scriptLoadingPromise: Promise<any> | null = null;

/**
 * Ensures the heic2any script is loaded into the browser context.
 */
export function loadHeic2Any(): Promise<any> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Browser context required.'));
  }

  // Check if already loaded
  if ((window as any).heic2any) {
    return Promise.resolve((window as any).heic2any);
  }

  if (scriptLoadingPromise) {
    return scriptLoadingPromise;
  }

  scriptLoadingPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/heic2any@0.0.4/dist/heic2any.js';
    script.async = true;
    script.onload = () => {
      if ((window as any).heic2any) {
        resolve((window as any).heic2any);
      } else {
        reject(new Error('Failed to initialize heic2any.'));
      }
    };
    script.onerror = () => {
      scriptLoadingPromise = null;
      reject(new Error('Failed to load HEIC converter script (heic2any) from CDN. Please verify network access.'));
    };
    document.head.appendChild(script);
  });

  return scriptLoadingPromise;
}

/**
 * Converts a HEIC Blob into a standard high-quality JPG Blob.
 */
export async function convertHEICtoJPG(
  blob: Blob,
  quality: number = 0.85
): Promise<Blob> {
  const heic2any = await loadHeic2Any();

  try {
    const response = await heic2any({
      blob,
      toType: 'image/jpeg',
      quality: quality,
    });

    if (Array.isArray(response)) {
      return response[0];
    }
    return response;
  } catch (err: any) {
    console.error('HEIC conversion error: ', err);
    throw new Error(err?.message || 'HEIC decoding failed. Ensure it is a valid Samsung or iOS HEIC photo.');
  }
}

/**
 * Helper to get the image width/height from a Blob URL.
 */
export function getImageDimensions(url: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    const img = new Image();
    img.src = url;
    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.onerror = () => {
      resolve({ width: 1920, height: 1080 }); // default fallback
    };
  });
}

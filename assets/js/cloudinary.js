// Cloudinary unsigned image upload from the browser.
// Reads the cloud name + preset from firebase-config.js.
import { CLOUDINARY } from './firebase-config.js';

export const isCloudinaryConfigured = () =>
  Boolean(CLOUDINARY.cloudName && CLOUDINARY.uploadPreset);

/**
 * Upload a single file. Returns the secure HTTPS URL.
 * Calls onProgress(percent) repeatedly while uploading.
 */
export function uploadToCloudinary(file, { folder = 'virea', onProgress, resourceType = 'image' } = {}) {
  if (!isCloudinaryConfigured()) {
    return Promise.reject(new Error('Cloudinary is not configured.'));
  }
  return new Promise((resolve, reject) => {
    // `auto` accepts PDF/DOCX/XLSX and lets Cloudinary pick the resource type.
    const url = `https://api.cloudinary.com/v1_1/${CLOUDINARY.cloudName}/${resourceType}/upload`;
    const form = new FormData();
    form.append('file', file);
    form.append('upload_preset', CLOUDINARY.uploadPreset);
    if (folder) form.append('folder', folder);

    const xhr = new XMLHttpRequest();
    xhr.open('POST', url);

    if (onProgress) {
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) onProgress((e.loaded / e.total) * 100);
      };
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const data = JSON.parse(xhr.responseText);
          // Return the full payload for non-image uploads (we need bytes/format too)
          resolve(resourceType === 'image' ? data.secure_url : data);
        } catch {
          reject(new Error('Cloudinary returned an invalid response'));
        }
      } else {
        let message = `Upload failed (${xhr.status})`;
        try {
          const body = JSON.parse(xhr.responseText);
          if (body?.error?.message) message = body.error.message;
        } catch {}
        reject(new Error(message));
      }
    };
    xhr.onerror = () => reject(new Error('Network error uploading to Cloudinary'));
    xhr.send(form);
  });
}

export const uploadManyToCloudinary = (files, opts = {}) =>
  Promise.all(Array.from(files).map((f) => uploadToCloudinary(f, opts)));

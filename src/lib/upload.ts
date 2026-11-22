export interface UploadedMediaResult {
  url: string;
  originalName: string;
  size: number;
  mimeType: string;
  mediaCategory: 'image' | 'video' | 'file';
}

const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

export async function uploadMediaFile(file: File): Promise<UploadedMediaResult> {
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error('File is too large. Maximum allowed size is 50 MB.');
  }

  const form = new FormData();
  form.append('file', file);

  const resp = await fetch('/api/uploads', { method: 'POST', body: form });
  const rawText = await resp.text();

  let parsed: Partial<UploadedMediaResult> & { error?: string } = {};
  if (rawText) {
    try {
      parsed = JSON.parse(rawText) as Partial<UploadedMediaResult> & { error?: string };
    } catch {
      if (!resp.ok) {
        throw new Error(`Upload failed (${resp.status}). Please try another JPG, PNG, WebP, or MP4 file.`);
      }
      throw new Error('Unexpected response from upload server.');
    }
  }

  if (!resp.ok) {
    throw new Error(parsed.error || `Upload failed (${resp.status})`);
  }

  if (!parsed.url || typeof parsed.url !== 'string') {
    throw new Error('Upload succeeded without a file URL.');
  }

  return {
    url: parsed.url,
    originalName: parsed.originalName || file.name || 'uploaded-file',
    size: parsed.size ?? file.size,
    mimeType: parsed.mimeType || file.type || '',
    mediaCategory: parsed.mediaCategory || 'file',
  };
}

export function sanitizeRemoteOrLocalUrl(url: string | null | undefined, maxLen = 500): string {
  if (!url || typeof url !== 'string') return '';
  const trimmed = url.trim();
  if (!trimmed || trimmed.length > maxLen) return '';
  if (trimmed.startsWith('/')) return trimmed;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
      return trimmed;
    }
  } catch {
    return '';
  }
  return '';
}

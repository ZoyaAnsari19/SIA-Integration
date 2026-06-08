const IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'] as const;
const VOICE_TYPES = ['audio/webm', 'audio/ogg', 'audio/mp4', 'audio/mpeg'] as const;
const PDF_TYPES = ['application/pdf'] as const;

export const SUPPORT_ALLOWED_IMAGE_TYPES = [...IMAGE_TYPES];
export const SUPPORT_ALLOWED_VOICE_TYPES = [...VOICE_TYPES];
export const SUPPORT_ALLOWED_PDF_TYPES = [...PDF_TYPES];

export const SUPPORT_UPLOAD_ALLOWED_MIME_TYPES = [
  ...SUPPORT_ALLOWED_IMAGE_TYPES,
  ...SUPPORT_ALLOWED_VOICE_TYPES,
  ...SUPPORT_ALLOWED_PDF_TYPES,
];

// Shared max upload size (MB) for support attachments
export const SUPPORT_MAX_FILE_SIZE_MB = 5;

export function classifySupportAttachmentType(mimetype: string): 'image' | 'voice' | 'other' {
  if (SUPPORT_ALLOWED_IMAGE_TYPES.includes(mimetype as (typeof IMAGE_TYPES)[number])) return 'image';
  if (SUPPORT_ALLOWED_VOICE_TYPES.includes(mimetype as (typeof VOICE_TYPES)[number])) return 'voice';
  return 'other';
}

export function resolveSupportAttachmentExtension(mimetype: string, originalFilename?: string): string {
  const fromName = originalFilename?.split('.').pop();
  if (fromName && fromName.length <= 8) {
    return fromName;
  }
  if (SUPPORT_ALLOWED_IMAGE_TYPES.includes(mimetype as (typeof IMAGE_TYPES)[number])) return 'jpg';
  if (SUPPORT_ALLOWED_PDF_TYPES.includes(mimetype as (typeof PDF_TYPES)[number])) return 'pdf';
  return 'webm';
}


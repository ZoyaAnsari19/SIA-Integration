import React from 'react'

type MessageAttachmentProps = {
  attachmentType?: string | null
  attachmentUrl?: string | null
  filename?: string | null
}

export function MessageAttachment({ attachmentType, attachmentUrl, filename }: MessageAttachmentProps) {
  if (!attachmentUrl) return null

  const type = (attachmentType || '').toLowerCase()
  const urlLower = attachmentUrl.toLowerCase()

  // Detect image types: either semantic type or image mimetype/extension
  const isImage =
    type === 'image' ||
    type.startsWith('image/') ||
    /\.(png|jpe?g|gif|webp|bmp|svg)$/.test(urlLower)

  // Detect audio / voice: semantic type, mimetype, or common audio extensions
  const isAudio =
    type === 'audio' ||
    type === 'voice' ||
    type.startsWith('audio/') ||
    /\.(mp3|wav|ogg|webm|m4a)$/i.test(urlLower)

  // Detect PDF / generic file – still rendered as link
  const isPdf =
    type === 'pdf' ||
    type === 'application/pdf' ||
    urlLower.endsWith('.pdf')

  if (isImage) {
    return (
      <a
        href={attachmentUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="block max-w-[260px]"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={attachmentUrl}
          alt={filename || 'Image'}
          className="rounded-lg max-h-48 object-contain border border-slate-200 bg-white"
        />
      </a>
    )
  }

  if (isAudio) {
    return (
      <audio
        src={attachmentUrl}
        controls
        className="max-w-full h-8"
      />
    )
  }

  return (
    <a
      href={attachmentUrl}
      target="_blank"
      rel="noopener noreferrer"
      download={filename || undefined}
      className="text-xs underline block max-w-[220px] truncate text-blue-600"
    >
      {filename || 'Download'}
    </a>
  )
}


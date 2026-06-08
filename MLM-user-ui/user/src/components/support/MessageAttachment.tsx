import React from "react";

type MessageAttachmentProps = {
  attachmentType?: string | null;
  attachmentUrl?: string | null;
  filename?: string | null;
};

function isImageType(type: string): boolean {
  const t = type.toLowerCase();
  return t === "image" || t.startsWith("image/");
}

function isAudioType(type: string): boolean {
  const t = type.toLowerCase();
  return t === "voice" || t === "audio" || t.startsWith("audio/");
}

function inferTypeFromFilename(name: string | null | undefined): string {
  if (!name) return "";
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  const imageExts = ["jpg", "jpeg", "png", "gif", "webp", "bmp", "svg"];
  const audioExts = ["webm", "ogg", "mp3", "mp4", "m4a", "wav", "opus"];
  if (imageExts.includes(ext)) return "image";
  if (audioExts.includes(ext)) return "audio";
  return "";
}

export function MessageAttachment(props: MessageAttachmentProps) {
  const { attachmentType, attachmentUrl, filename } = props;
  if (!attachmentUrl) return null;

  const type = ((attachmentType || "").trim() || inferTypeFromFilename(filename)).toLowerCase();

  if (isImageType(type)) {
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
          alt={filename || "Image"}
          className="rounded-lg max-h-48 object-contain border border-[var(--border-soft)] bg-[var(--card-bg)]"
        />
      </a>
    );
  }

  if (isAudioType(type)) {
    return (
      <div className="mt-1">
        <audio
          src={attachmentUrl}
          controls
          preload="metadata"
          className="max-w-full min-w-[240px] h-9 rounded-md"
        />
        {filename && (
          <p className="text-xs text-[var(--text-muted)] mt-0.5 truncate max-w-[260px]" title={filename}>
            {filename}
          </p>
        )}
      </div>
    );
  }

  return (
    <a
      href={attachmentUrl}
      target="_blank"
      rel="noopener noreferrer"
      download={filename || undefined}
      className="text-xs underline block max-w-[220px] truncate text-[var(--brand-blue)]"
    >
      {filename || "Download"}
    </a>
  );
}


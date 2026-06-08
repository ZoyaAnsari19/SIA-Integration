"use client";

import React, { useState, useRef } from "react";
import { Upload, X, Image as ImageIcon } from "lucide-react";
import { Button } from "./Button";

type FileUploadProps = {
  label?: string;
  accept?: string;
  maxSize?: number; // in MB
  value?: File | null;
  onChange?: (file: File | null) => void;
  preview?: string | null;
  onPreviewChange?: (preview: string | null) => void;
  showPreview?: boolean;
  required?: boolean;
  error?: string;
  helperText?: string;
  className?: string;
  dragAndDrop?: boolean;
};

export function FileUpload({
  label,
  accept = "image/*",
  maxSize = 5, // 5MB default
  value,
  onChange,
  preview,
  onPreviewChange,
  showPreview = true,
  required = false,
  error,
  helperText,
  className = "",
  dragAndDrop = true,
}: FileUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(preview || null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validateFile = (file: File): string | null => {
    if (!file.type.startsWith("image/")) {
      return "Please select a valid image file";
    }
    if (file.size > maxSize * 1024 * 1024) {
      return `Image size should be less than ${maxSize}MB`;
    }
    return null;
  };

  const handleFileSelect = (file: File) => {
    const validationError = validateFile(file);
    if (validationError) {
      alert(validationError);
      return;
    }

    if (onChange) {
      onChange(file);
    }

    // Generate preview
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      setPreviewUrl(result);
      if (onPreviewChange) {
        onPreviewChange(result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (dragAndDrop) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (dragAndDrop) {
      const file = e.dataTransfer.files?.[0];
      if (file) {
        handleFileSelect(file);
      }
    }
  };

  const handleRemove = () => {
    setPreviewUrl(null);
    if (onChange) onChange(null);
    if (onPreviewChange) onPreviewChange(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      {label && (
        <label className="text-sm font-semibold text-[var(--text-body)]">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}

      {showPreview && previewUrl && (
        <div className="relative mb-3">
          <div className="relative inline-block">
            <img
              src={previewUrl}
              alt="Preview"
              className="max-w-full h-auto rounded-lg border border-[var(--border)] max-h-48 transition-colors duration-200"
            />
            <button
              type="button"
              onClick={handleRemove}
              className="absolute -top-2 -right-2 p-1.5 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
              aria-label="Remove preview"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      <div
        className={`border-2 border-dashed rounded-lg p-6 transition-colors ${
          isDragging
            ? "border-blue-500 bg-[var(--sidebar-hover)]"
            : error
              ? "border-red-300 hover:border-red-400"
              : "border-[var(--border)] hover:border-blue-400"
        }`}
        onDragOver={dragAndDrop ? handleDragOver : undefined}
        onDragLeave={dragAndDrop ? handleDragLeave : undefined}
        onDrop={dragAndDrop ? handleDrop : undefined}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={accept}
          onChange={handleFileInputChange}
          className="hidden"
          required={required}
        />

        <div
          className="flex flex-col items-center gap-3 cursor-pointer"
          onClick={handleClick}
        >
          <div className="p-3 bg-[var(--sidebar-hover)] rounded-full">
            {accept.startsWith("image/") ? (
              <ImageIcon className="w-6 h-6 text-blue-600" />
            ) : (
              <Upload className="w-6 h-6 text-blue-600" />
            )}
          </div>
          <div className="text-center">
            <p className="text-sm font-semibold text-[var(--text-strong)]">
              {previewUrl
                ? "Choose a different file"
                : dragAndDrop
                  ? "Click to upload or drag and drop"
                  : "Click to upload"}
            </p>
            <p className="text-xs text-[var(--text-muted)] mt-1">
              {accept.startsWith("image/")
                ? `PNG, JPG, JPEG up to ${maxSize}MB`
                : `Allowed formats up to ${maxSize}MB`}
            </p>
          </div>
          {!dragAndDrop && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleClick}
            >
              <Upload className="w-4 h-4 mr-1.5" />
              Select File
            </Button>
          )}
        </div>
      </div>

      {error && <span className="text-sm text-red-600">{error}</span>}
      {helperText && !error && (
        <span className="text-sm text-[var(--text-muted)]">{helperText}</span>
      )}
    </div>
  );
}

export default FileUpload;

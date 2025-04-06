import React, { useState, useRef } from 'react';
import { Image as ImageIcon, X } from 'lucide-react';

interface ImageUploaderProps {
  onImageCapture: (file: File) => void;
  previewUrl?: string;
  className?: string;
  onRemove?: () => void;
}

export default function ImageUploader({ onImageCapture, previewUrl, className = '', onRemove }: ImageUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const dropZoneRef = useRef<HTMLDivElement>(null);

  const handlePaste = (e: ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (const item of Array.from(items)) {
      if (item.type.indexOf('image') !== -1) {
        const file = item.getAsFile();
        if (file) {
          validateAndProcessImage(file);
        }
        break;
      }
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
      validateAndProcessImage(file);
    }
  };

  const validateAndProcessImage = (file: File) => {
    // Check file type
    if (!file.type.match(/^image\/(jpeg|png|webp)$/)) {
      alert('Only JPG, PNG, and WEBP images are supported');
      return;
    }

    // Check file size (5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert('Image must be smaller than 5MB');
      return;
    }

    onImageCapture(file);
  };

  React.useEffect(() => {
    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, []);

  return (
    <div
      ref={dropZoneRef}
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
      className={`
        relative border-2 border-dashed rounded-lg p-4 text-center cursor-pointer
        transition-colors duration-200 min-h-[80px] flex flex-col items-center justify-center
        ${isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'}
        ${className}
      `}
    >
      {previewUrl ? (
        <div className="relative">
          <img
            src={previewUrl}
            alt="Trade snapshot preview"
            className="max-h-[60px] rounded-lg shadow-sm"
          />
          {onRemove && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onRemove();
              }}
              className="absolute -top-2 -right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors shadow-sm"
              title="Remove image"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      ) : (
        <>
          <ImageIcon className="h-5 w-5 text-gray-400 mb-1" />
          <div className="text-sm text-gray-600">
            <p className="text-xs font-medium">Drop image here or paste from clipboard</p>
            <p className="text-gray-500 text-xs mt-1">
              Supports: PNG, JPG, WEBP up to 5MB
            </p>
          </div>
        </>
      )}
    </div>
  );
}
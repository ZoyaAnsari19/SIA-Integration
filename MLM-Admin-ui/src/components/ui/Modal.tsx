import React, { useEffect } from 'react'

export interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title?: React.ReactNode
  children: React.ReactNode
  footer?: React.ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full'
  closeOnBackdropClick?: boolean
  className?: string
}

const sizeClasses = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
  full: 'max-w-full mx-4',
}

export function Modal({
  isOpen,
  onClose,
  title,
  children,
  footer,
  size = 'md',
  closeOnBackdropClick = true,
  className = '',
}: ModalProps) {
  // Handle ESC key press
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose()
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleEscape)
      // Prevent body scroll when modal is open
      document.body.style.overflow = 'hidden'
    }

    return () => {
      document.removeEventListener('keydown', handleEscape)
      document.body.style.overflow = 'unset'
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 bg-black/30 backdrop-blur-md z-50 flex items-center justify-center p-4"
      onClick={(e) => {
        if (closeOnBackdropClick && e.target === e.currentTarget) {
          onClose()
        }
      }}
    >
      <div
        className={`bg-white rounded-lg shadow-xl w-full ${sizeClasses[size]} max-h-[90vh] flex flex-col ${className}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        {title && (
          <div className="flex justify-between items-center p-4 sm:p-5 border-b border-[#eee] flex-shrink-0">
            <h2 className="text-lg sm:text-xl font-semibold m-0 pr-2">{title}</h2>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded border border-[#ccc] bg-white hover:bg-[#f9f9f9] text-gray-700 text-xl sm:text-2xl leading-none flex-shrink-0 transition-colors"
              aria-label="Close"
              type="button"
            >
              &times;
            </button>
          </div>
        )}

        {/* Body */}
        <div className="p-4 sm:p-5 overflow-y-auto flex-1">{children}</div>

        {/* Footer */}
        {footer && (
          <div className="flex justify-end gap-2 p-4 sm:p-5 border-t border-[#eee] flex-shrink-0">
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}

export default Modal


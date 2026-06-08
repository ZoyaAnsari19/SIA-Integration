import React from 'react'

export function ApproveReject({ onApprove, onReject }: { onApprove?: () => void; onReject?: () => void }) {
  const isApproveDisabled = !onApprove
  const isRejectDisabled = !onReject
  
  return (
    <>
      <button
        className={`w-8 h-8 inline-flex items-center justify-center rounded-lg border transition-colors ${
          isApproveDisabled
            ? 'bg-gray-100 text-gray-400 border-gray-300 cursor-not-allowed'
            : 'bg-white text-[#28a745] border-[#d1d5db] hover:bg-[#28a745] hover:text-white hover:border-[#28a745]'
        }`}
        title={isApproveDisabled ? 'Approve (not available for this status)' : 'Approve'}
        type="button"
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          if (onApprove && !isApproveDisabled) {
            onApprove()
          }
        }}
        disabled={isApproveDisabled}
        aria-label="Approve"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M20 6L9 17l-5-5" />
        </svg>
      </button>
      <button
        className={`w-8 h-8 inline-flex items-center justify-center rounded-lg border transition-colors ${
          isRejectDisabled
            ? 'bg-gray-100 text-gray-400 border-gray-300 cursor-not-allowed'
            : 'bg-white text-[#dc3545] border-[#d1d5db] hover:bg-[#dc3545] hover:text-white hover:border-[#dc3545]'
        }`}
        title={isRejectDisabled ? 'Reject (not available for this status)' : 'Reject'}
        type="button"
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          if (onReject && !isRejectDisabled) {
            onReject()
          }
        }}
        disabled={isRejectDisabled}
        aria-label="Reject"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </>
  )
}

export function ViewButton({ onClick }: { onClick?: () => void }) {
  return (
    <button
      className="w-8 h-8 rounded-lg border bg-white text-[#007bff] border-[#d1d5db] inline-flex items-center justify-center hover:bg-[#007bff] hover:text-white hover:border-[#007bff] transition-colors"
      title="View"
      type="button"
      onClick={onClick}
      aria-label="View"
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    </button>
  )
}

export function EditButton({ onClick }: { onClick?: () => void }) {
  return (
    <button
      className="w-8 h-8 rounded-lg border bg-white text-[#b38f00] border-[#d1d5db] inline-flex items-center justify-center hover:bg-[#ffc107] hover:text-white hover:border-[#ffc107] transition-colors"
      title="Edit"
      type="button"
      onClick={onClick}
      aria-label="Edit"
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 20h9" />
        <path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
      </svg>
    </button>
  )
}

export function DeleteButton({ onClick }: { onClick?: () => void }) {
  return (
    <button
      className="w-8 h-8 rounded-lg border bg-white text-[#dc3545] border-[#d1d5db] inline-flex items-center justify-center hover:bg-[#dc3545] hover:text-white hover:border-[#dc3545] transition-colors"
      title="Delete"
      type="button"
      onClick={onClick}
      aria-label="Delete"
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <polyline points="3 6 5 6 21 6" />
        <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
        <path d="M10 11v6" />
        <path d="M14 11v6" />
        <path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
      </svg>
    </button>
  )
}

export function ActivateButton({ onClick }: { onClick?: () => void }) {
  return (
    <button
      className="w-8 h-8 rounded-lg border bg-white text-[#28a745] border-[#d1d5db] inline-flex items-center justify-center hover:bg-[#28a745] hover:text-white hover:border-[#28a745] transition-colors"
      title="Activate"
      type="button"
      onClick={onClick}
      aria-label="Activate"
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
        <polyline points="22 4 12 14.01 9 11.01" />
      </svg>
    </button>
  )
}

export function DeactivateButton({ onClick }: { onClick?: () => void }) {
  return (
    <button
      className="w-8 h-8 rounded-lg border bg-white text-[#ffc107] border-[#d1d5db] inline-flex items-center justify-center hover:bg-[#ffc107] hover:text-white hover:border-[#ffc107] transition-colors"
      title="Deactivate"
      type="button"
      onClick={onClick}
      aria-label="Deactivate"
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
    </button>
  )
}

export default ApproveReject



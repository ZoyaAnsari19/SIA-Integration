import React from 'react'

export function Pagination({
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 25, 50],
}: {
  page: number
  pageSize: number
  total: number
  onPageChange: (page: number) => void
  onPageSizeChange?: (pageSize: number) => void
  pageSizeOptions?: number[]
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1
  const end = Math.min(page * pageSize, total)

  // Generate page numbers to display
  const getPageNumbers = () => {
    const pages: (number | string)[] = []
    const maxVisible = 10 // Show up to 10 page numbers
    
    if (totalPages <= maxVisible) {
      // Show all pages if total is less than maxVisible
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i)
      }
    } else {
      // Always show first page
      pages.push(1)
      
      if (page <= 5) {
        // Near the start: show 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, ..., last
        for (let i = 2; i <= 10; i++) {
          pages.push(i)
        }
        pages.push('...')
        pages.push(totalPages)
      } else if (page >= totalPages - 4) {
        // Near the end: show 1, ..., last-9, last-8, ..., last
        pages.push('...')
        for (let i = totalPages - 9; i <= totalPages; i++) {
          pages.push(i)
        }
      } else {
        // In the middle: show 1, ..., page-2, page-1, page, page+1, page+2, ..., last
        pages.push('...')
        for (let i = page - 2; i <= page + 2; i++) {
          pages.push(i)
        }
        pages.push('...')
        pages.push(totalPages)
      }
    }
    
    return pages
  }

  const pageNumbers = getPageNumbers()

  return (
    <div className="flex flex-col sm:flex-row flex-wrap justify-between items-stretch sm:items-center pt-4 sm:pt-5 border-t border-[#eee] text-xs sm:text-sm text-[#555] gap-3 sm:gap-5">
      <div className="flex items-center gap-2 justify-center sm:justify-start">
        <label htmlFor="show-entries">Show</label>
        {onPageSizeChange ? (
          <select
            id="show-entries"
            value={pageSize}
            onChange={(e) => onPageSizeChange?.(Number(e.target.value))}
            className="px-2 py-1 border border-[#ccc] rounded-md text-sm"
          >
            {pageSizeOptions.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        ) : (
          <span className="px-2 py-1">{pageSize}</span>
        )}
        <span>entries</span>
      </div>
      <div className="text-center sm:text-left">{`Displaying ${start} to ${end} of ${total} items`}</div>
      <div className="flex items-center gap-1 sm:gap-2 justify-center sm:justify-end flex-wrap">
        <button
          className="px-3 py-1 border border-[#ccc] rounded-md hover:bg-[#eee] text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          title="Previous"
          type="button"
          disabled={page === 1}
          onClick={() => onPageChange(Math.max(1, page - 1))}
        >
          &lt;
        </button>
        {pageNumbers.map((pageNum, index) => {
          if (pageNum === '...') {
            return (
              <span key={`ellipsis-${index}`} className="px-2 py-1 text-sm">
                ...
              </span>
            )
          }

          // Extra safety: skip any invalid numeric values so React never receives NaN as children
          if (typeof pageNum !== 'number' || Number.isNaN(pageNum)) {
            return null
          }

          const pageNumValue = pageNum
          return (
            <button
              key={`${pageNumValue}-${index}`}
              className={`px-3 py-1 border rounded-md text-sm min-w-[36px] ${
                pageNumValue === page
                  ? 'bg-[#007bff] text-white border-[#007bff] font-semibold'
                  : 'border-[#ccc] hover:bg-[#eee]'
              }`}
              type="button"
              onClick={() => onPageChange(pageNumValue)}
            >
              {String(pageNumValue)}
            </button>
          )
        })}
        <button
          className="px-3 py-1 border border-[#ccc] rounded-md hover:bg-[#eee] text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          title="Next"
          type="button"
          disabled={page === totalPages}
          onClick={() => onPageChange(Math.min(totalPages, page + 1))}
        >
          &gt;
        </button>
      </div>
    </div>
  )
}

export default Pagination



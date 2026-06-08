import React from 'react'

export function Card({ title, toolbarRight, children, className }: { title?: React.ReactNode; toolbarRight?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <div className={className || ''}>
      {title ? <h1 className="text-lg sm:text-xl md:text-2xl font-semibold mb-4 md:mb-5 text-[#222]">{title}</h1> : null}
      <div className="bg-white border border-[#e0e0e0] rounded-lg px-3 py-4 sm:px-4 sm:py-4 md:px-6 md:py-5 shadow-sm">
        {toolbarRight ? (
          <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3 sm:gap-0 pb-4 mb-5 border-b border-[#eee]">
            <div />
            <div className="flex flex-wrap gap-2">{toolbarRight}</div>
          </div>
        ) : null}
        {children}
      </div>
    </div>
  )
}

export function Toolbar({ align = 'end', children }: { align?: 'start' | 'end'; children: React.ReactNode }) {
  return (
    <div className={`flex flex-wrap ${align === 'start' ? 'justify-start' : 'justify-end'} gap-2 pb-4 mb-5 border-b border-[#eee]`}>
      {children}
    </div>
  )
}

export function ToolbarButton({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className="inline-flex items-center gap-1 px-2.5 py-1.5 sm:px-3 sm:py-2 text-xs sm:text-sm font-medium bg-white border border-[#ccc] text-[#333] rounded-md hover:bg-[#f9f9f9]"
      {...props}
    >
      {children}
    </button>
  )
}

export default Card



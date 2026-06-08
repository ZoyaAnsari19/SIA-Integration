import React from 'react'

export function FiltersBar({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-3 sm:gap-4 mt-3 pt-3 border-t border-dashed border-[#e0e0e0]">
      {children}
    </div>
  )
}

export function SearchInput({ id = 'search', label = 'Search:', value, onChange, placeholder = 'Search...' }: { id?: string; label?: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-2 w-full sm:w-auto">
      <label htmlFor={id} className="font-medium text-sm sm:text-base whitespace-nowrap">{label}</label>
      <input id={id} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} className="px-3 py-2 border border-[#ccc] rounded-md text-sm w-full sm:min-w-[150px] flex-1 sm:flex-initial" />
    </div>
  )
}

export function TextInput({ id, label, value, onChange, placeholder, onKeyDown }: { id: string; label: string; value: string; onChange: (v: string) => void; placeholder?: string; onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-2 w-full sm:w-auto">
      <label htmlFor={id} className="font-medium text-sm sm:text-base whitespace-nowrap">{label}</label>
      <input id={id} value={value} onChange={e => onChange(e.target.value)} onKeyDown={onKeyDown} placeholder={placeholder} className="px-3 py-2 border border-[#ccc] rounded-md text-sm w-full sm:min-w-[150px] flex-1 sm:flex-initial" />
    </div>
  )
}

export function PrimaryButton({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button className="px-3 py-2 text-sm font-medium rounded-md bg-[#007bff] text-white hover:bg-[#0056b3] w-full sm:w-auto" {...props}>{children}</button>
}

export function SecondaryButton({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button className="px-3 py-2 text-sm font-medium rounded-md bg-[#6c757d] text-white hover:bg-[#5a6268] w-full sm:w-auto" {...props}>{children}</button>
}

export function SelectInput({ id, label, value, onChange, options, placeholder }: { 
  id: string; 
  label: string; 
  value: string; 
  onChange: (v: string) => void; 
  options: Array<{ value: string; label: string }>;
  placeholder?: string;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-2 w-full sm:w-auto">
      <label htmlFor={id} className="font-medium text-sm sm:text-base whitespace-nowrap">{label}</label>
      <select
        id={id}
        value={value}
        onChange={e => onChange(e.target.value)}
        className="px-3 py-2 border border-[#ccc] rounded-md text-sm w-full sm:min-w-[150px] flex-1 sm:flex-initial focus:outline-none focus:ring-2 focus:ring-[#007bff] focus:border-[#007bff]"
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map(option => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  )
}

export function DateRangeInput({ 
  id, 
  label, 
  startDate, 
  endDate, 
  onStartDateChange, 
  onEndDateChange 
}: { 
  id: string; 
  label: string; 
  startDate: string; 
  endDate: string; 
  onStartDateChange: (v: string) => void; 
  onEndDateChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-2 w-full sm:w-auto">
      <label className="font-medium text-sm sm:text-base whitespace-nowrap">{label}</label>
      <div className="flex items-center gap-2 w-full sm:w-auto">
        <input
          id={`${id}-start`}
          type="date"
          value={startDate}
          onChange={e => onStartDateChange(e.target.value)}
          className="px-3 py-2 border border-[#ccc] rounded-md text-sm w-full sm:min-w-[140px] flex-1 sm:flex-initial focus:outline-none focus:ring-2 focus:ring-[#007bff] focus:border-[#007bff]"
        />
        <span className="text-gray-500 whitespace-nowrap">to</span>
        <input
          id={`${id}-end`}
          type="date"
          value={endDate}
          onChange={e => onEndDateChange(e.target.value)}
          className="px-3 py-2 border border-[#ccc] rounded-md text-sm w-full sm:min-w-[140px] flex-1 sm:flex-initial focus:outline-none focus:ring-2 focus:ring-[#007bff] focus:border-[#007bff]"
        />
      </div>
    </div>
  )
}

export default FiltersBar



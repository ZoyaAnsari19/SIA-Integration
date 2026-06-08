import React from 'react'

export type DataTableColumn<Row> = {
  key: keyof Row | string
  title: string | React.ReactNode
  widthPx?: number
  headerClassName?: string
  cellClassName?: string
  render?: (row: Row, rowIndex: number) => React.ReactNode
}

export function DataTable<Row = Record<string, unknown>>({
  columns,
  rows,
  renderActions,
  actionsHeader = 'Actions',
  minWidthPx = 1200,
}: {
  columns: Array<DataTableColumn<Row>>
  rows: Row[]
  renderActions?: (row: Row, rowIndex: number) => React.ReactNode
  actionsHeader?: string
  minWidthPx?: number
}) {
  return (
    <div className="w-full overflow-x-auto border border-[#e0e0e0] rounded-lg mb-4 sm:mb-5">
      <table className="w-full border-collapse" style={{ minWidth: `${minWidthPx}px` }}>
        <thead>
          <tr className="bg-[#f9f9f9]">
            {renderActions && (
              <th className="font-semibold border-b-2 border-[#e0e0e0] sticky top-0 z-10 text-left px-2 sm:px-3 md:px-4 py-2 sm:py-2.5 md:py-3 text-xs sm:text-sm whitespace-nowrap">
                {actionsHeader}
              </th>
            )}
            {columns.map((col, idx) => (
              <th
                key={String(col.key) + idx}
                className={`font-semibold border-b-2 border-[#e0e0e0] sticky top-0 z-10 text-left px-2 sm:px-3 md:px-4 py-2 sm:py-2.5 md:py-3 text-xs sm:text-sm whitespace-nowrap ${col.headerClassName || ''}`}
                style={col.widthPx ? { width: `${col.widthPx}px` } : undefined}
              >
                {col.title}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex} className="border-b border-[#f0f0f0]">
              {renderActions && (
                <td className="px-2 sm:px-3 md:px-4 py-2 sm:py-2.5 md:py-3 whitespace-nowrap">{renderActions(row, rowIndex)}</td>
              )}
              {columns.map((col, colIndex) => {
                const hasCustomWhitespace = col.cellClassName?.includes('whitespace-')
                return (
                  <td 
                    key={String(col.key) + colIndex} 
                    className={`px-2 sm:px-3 md:px-4 py-2 sm:py-2.5 md:py-3 text-xs sm:text-sm ${!hasCustomWhitespace ? 'whitespace-nowrap' : ''} ${col.cellClassName || ''}`}
                  >
                    {col.render ? col.render(row, rowIndex) : ((row as Record<string, unknown>)[String(col.key)] as React.ReactNode)}
                  </td>
                )
              })}
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td
                className="text-center text-[#777] py-6 text-sm"
                colSpan={(renderActions ? 1 : 0) + columns.length}
              >
                No data
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

export default DataTable



// Simple CSV export helper for client-side tables
// Usage: exportToCsv('filename.csv', ['col1', 'col2'], rows.map(r => [r.col1, r.col2]))

const escapeCsvValue = (value: string | number): string => {
  const str = String(value ?? '')
  // Escape double quotes and normalize newlines
  const cleaned = str.replace(/"/g, '""').replace(/\r?\n/g, ' ')
  return `"${cleaned}"`
}

export function exportToCsv(
  filename: string,
  headers: string[],
  rows: Array<Array<string | number>>,
): void {
  if (typeof window === 'undefined') return

  if (!headers.length) {
    // Nothing to export
    return
  }

  const lines = [
    headers.join(','),
    ...rows.map(row => row.map(escapeCsvValue).join(',')),
  ]

  const blob = new Blob([lines.join('\n')], {
    type: 'text/csv;charset=utf-8;',
  })

  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}



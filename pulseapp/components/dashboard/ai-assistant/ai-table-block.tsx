'use client'

import type { AIBlockTable, AIBlockTableCell, AIBlockCellVariant } from '@/types'

interface Props {
  block: AIBlockTable
}

export default function AITableBlock({ block }: Props) {
  return (
    <div className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 overflow-hidden">
      {block.title && (
        <div className="px-4 py-2.5 text-xs font-semibold text-gray-700 dark:text-gray-200 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/60">
          {block.title}
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400 bg-gray-50/60 dark:bg-gray-800/40">
              {block.columns.map(col => (
                <th
                  key={col.key}
                  className={`px-3 py-2 font-medium ${alignClass(col.align)}`}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {block.rows.map((row, ri) => (
              <tr
                key={ri}
                className="border-t border-gray-100 dark:border-gray-800 hover:bg-gray-50/60 dark:hover:bg-gray-800/40"
              >
                {row.map((cell, ci) => (
                  <td
                    key={ci}
                    className={`px-3 py-2 ${alignClass(block.columns[ci]?.align)}`}
                  >
                    {renderCell(cell, block.columns[ci]?.variant)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {block.footer && (
        <div className="px-4 py-2 text-[11px] text-gray-500 dark:text-gray-400 border-t border-gray-200 dark:border-gray-700 bg-gray-50/60 dark:bg-gray-800/40">
          {block.footer}
        </div>
      )}
    </div>
  )
}

function alignClass(align?: 'left' | 'right' | 'center') {
  return align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left'
}

function renderCell(cell: AIBlockTableCell, columnVariant?: AIBlockCellVariant) {
  if (cell == null) return <span className="text-gray-400">—</span>

  let value: string | number | null
  let variant: AIBlockCellVariant | undefined = columnVariant

  if (typeof cell === 'object') {
    value = cell.value
    variant = cell.variant || variant
  } else {
    value = cell
  }

  if (value == null || value === '') return <span className="text-gray-400">—</span>

  const text = String(value)

  switch (variant) {
    case 'money':
      return <span className="font-medium text-gray-900 dark:text-gray-100 tabular-nums">{text}</span>
    case 'percent':
      return <span className="font-medium text-gray-700 dark:text-gray-300 tabular-nums">{text}</span>
    case 'delta':
      return <DeltaBadge text={text} />
    case 'muted':
      return <span className="text-gray-600 dark:text-gray-300">{text}</span>
    case 'strong':
      return <span className="font-semibold text-gray-900 dark:text-gray-100">{text}</span>
    default:
      return <span className="text-gray-700 dark:text-gray-200">{text}</span>
  }
}

function DeltaBadge({ text }: { text: string }) {
  const n = parseFloat(text.replace('%', ''))
  const positive = !isNaN(n) && n > 0
  const negative = !isNaN(n) && n < 0
  const cls = positive
    ? 'text-green-700 dark:text-green-300'
    : negative
    ? 'text-red-700 dark:text-red-300'
    : 'text-gray-500'
  const sign = positive ? '+' : ''
  return <span className={`font-medium tabular-nums ${cls}`}>{sign}{text}</span>
}

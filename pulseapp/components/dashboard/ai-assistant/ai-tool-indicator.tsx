'use client'

import { Loader2, CheckCircle2 } from 'lucide-react'

interface ToolExecution {
  name: string
  label: string
  status: 'running' | 'done'
  summary?: string
}

interface Props {
  tools: ToolExecution[]
}

export default function AIToolIndicator({ tools }: Props) {
  if (tools.length === 0) return null

  return (
    <div className="flex flex-col gap-1.5 px-4 py-2">
      {tools.map((tool) => (
        <div
          key={tool.name}
          className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400"
        >
          {tool.status === 'running' ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-500" />
          ) : (
            <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
          )}
          <span>{tool.status === 'done' && tool.summary ? tool.summary : tool.label}</span>
        </div>
      ))}
    </div>
  )
}

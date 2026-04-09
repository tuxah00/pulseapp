'use client'

import React from 'react'

export function AnimatedList({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      {React.Children.map(children, (child, index) => {
        if (!React.isValidElement(child)) return child
        return React.cloneElement(child as React.ReactElement<{ index?: number }>, { index })
      })}
    </div>
  )
}

export function AnimatedItem({
  children,
  className,
  index = 0,
  onClick,
  ...props
}: {
  children: React.ReactNode
  className?: string
  index?: number
  onClick?: React.MouseEventHandler<HTMLDivElement>
} & Omit<React.HTMLAttributes<HTMLDivElement>, 'className' | 'onClick'>) {
  return (
    <div
      className={`animated-item ${className || ''}`}
      style={{ animationDelay: `${index * 40}ms` }}
      onClick={onClick}
      {...props}
    >
      {children}
    </div>
  )
}

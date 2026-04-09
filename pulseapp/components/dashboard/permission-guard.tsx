'use client'

import { useBusinessContext } from '@/lib/hooks/use-business-context'
import { ShieldX } from 'lucide-react'
import type { StaffPermissions } from '@/types'

interface PermissionGuardProps {
  permission: keyof StaffPermissions
  children: React.ReactNode
}

export function PermissionGuard({ permission, children }: PermissionGuardProps) {
  const { permissions } = useBusinessContext()

  if (permissions && !permissions[permission]) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-center space-y-3">
          <ShieldX className="h-12 w-12 text-gray-300 dark:text-gray-600 mx-auto" />
          <p className="text-lg font-medium text-gray-500 dark:text-gray-400">
            Bu sayfaya erişim yetkiniz bulunmamaktadır.
          </p>
          <p className="text-sm text-gray-400 dark:text-gray-500">
            İşletme sahibinizle iletişime geçin.
          </p>
        </div>
      </div>
    )
  }

  return <>{children}</>
}

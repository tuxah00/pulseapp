'use client'

import { useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'

export default function PortalFeedbackRedirect() {
  const params = useParams()
  const router = useRouter()
  const businessId = params.businessId as string

  useEffect(() => {
    router.replace(`/portal/${businessId}/dashboard/reviews`)
  }, [businessId, router])

  return (
    <div className="flex items-center justify-center py-16">
      <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
    </div>
  )
}

import { NextRequest, NextResponse } from 'next/server'

// DELETE — Portal oturumunu kapat
export async function DELETE(request: NextRequest) {
  const businessId = request.cookies.get('portal_business_id')?.value || ''

  const response = NextResponse.json({ success: true })

  response.cookies.delete({
    name: 'portal_customer_id',
    path: `/portal/${businessId}`,
  })
  response.cookies.delete({
    name: 'portal_business_id',
    path: `/portal/${businessId}`,
  })

  return response
}

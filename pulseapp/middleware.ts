import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Auth durumunu kontrol et (token yenileme dahil)
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  // ── Public rotalar ──
  // /portal/** → portal kendi cookie tabanlı oturum sistemine sahip (portal_customer_id + portal_business_id).
  //   Middleware seviyesinde bloklamak yerine her portal server component kendi getPortalSession() kontrolünü yapıyor.
  //   Dashboard session'ına sahip kullanıcılar (işletme sahipleri) da owner-preview endpointi üzerinden
  //   portal cookie alabildiği için bu rotalar middleware'de public bırakılıyor.
  // /book/manage/** → manage_token tabanlı public erişim; token kontrolü server component'te yapılıyor.
  const publicPaths = ['/book', '/api/public', '/portal', '/api/portal', '/offline']
  if (publicPaths.some(p => pathname.startsWith(p))) {
    return supabaseResponse
  }

  // ── Korumalı rotalar: /dashboard/* ──
  if (pathname.startsWith('/dashboard')) {
    if (!user) {
      const url = request.nextUrl.clone()
      url.pathname = '/auth/login'
      url.searchParams.set('redirect', pathname)
      return NextResponse.redirect(url)
    }
  }

  // ── Auth sayfaları: Giriş yapmışsa dashboard'a yönlendir ──
  if (pathname.startsWith('/auth/')) {
    if (user) {
      const url = request.nextUrl.clone()
      url.pathname = '/dashboard'
      return NextResponse.redirect(url)
    }
  }

  // ── Ana sayfa: Giriş yapmışsa dashboard'a yönlendir ──
  if (pathname === '/') {
    if (user) {
      const url = request.nextUrl.clone()
      url.pathname = '/dashboard'
      return NextResponse.redirect(url)
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    // API route'ları ve statik dosyalar hariç
    '/((?!_next/static|_next/image|favicon.ico|api/webhooks|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}

import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  // /admin Route များကို စစ်ဆေးခြင်း
  if (request.nextUrl.pathname.startsWith('/admin')) {
    if (!user) {
      return NextResponse.redirect(new URL('/login', request.url))
    }

    // Role စစ်ဆေးခြင်း (app_metadata မှ)
    const userRole = user.app_metadata?.role
    if (userRole !== 'admin') {
      return NextResponse.redirect(new URL('/', request.url)) // Admin မဟုတ်ရင် Home သို့ ပြန်လွှတ်မည်
    }
  }

  return response
}

export const config = {
  matcher: ['/admin/:path*'],
}
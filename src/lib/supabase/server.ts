import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()

  // Env vars ausentes hacen que createServerClient lance con undefined y
  // eso arrastra a un 500 sin contexto. Logeamos y usamos placeholders;
  // el cliente resultante fallará las queries con un error claro en vez de
  // crashear al instanciarse.
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) {
    console.error('[supabase/server] NEXT_PUBLIC_SUPABASE_URL / ANON_KEY no configurados')
  }

  return createServerClient(
    url || 'https://placeholder.supabase.co',
    key || 'placeholder',
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing sessions.
          }
        },
      },
    }
  )
}

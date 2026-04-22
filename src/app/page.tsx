import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function Home() {
  // Chequeo de sesión directo (más robusto que depender solo del proxy).
  // Sin sesión → /login; con sesión → /dashboard.
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    redirect(user ? '/dashboard' : '/login')
  } catch (err) {
    // redirect() lanza NEXT_REDIRECT que NO hay que atrapar
    if (err && typeof err === 'object' && 'digest' in err && typeof (err as { digest?: string }).digest === 'string' && (err as { digest: string }).digest.startsWith('NEXT_REDIRECT')) {
      throw err
    }
    console.error('[home] error chequeando sesión:', err)
    redirect('/login')
  }
}

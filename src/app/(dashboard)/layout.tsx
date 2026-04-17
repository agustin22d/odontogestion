import { getCurrentUser, signOut } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { AuthProvider } from '@/components/AuthProvider'
import Sidebar from '@/components/Sidebar'
import DemoBanner from '@/components/DemoBanner'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await getCurrentUser()

  if (!user) {
    // Clear stale session to prevent redirect loop with middleware
    await signOut()
    redirect('/login')
  }

  if (user.must_change_password) {
    redirect('/cambiar-clave')
  }

  const demoMode = process.env.NEXT_PUBLIC_DEMO_MODE === 'true'

  return (
    <AuthProvider initialUser={user}>
      <DemoBanner />
      <div className={`min-h-screen bg-beige ${demoMode ? 'pt-9' : ''}`}>
        <Sidebar />
        {/* Main content — offset by sidebar width */}
        <main className="lg:ml-[250px] transition-all duration-200">
          <div className="p-4 pt-16 sm:p-6 sm:pt-16 lg:p-8 lg:pt-8 max-w-[1400px] mx-auto">
            {children}
          </div>
        </main>
      </div>
    </AuthProvider>
  )
}

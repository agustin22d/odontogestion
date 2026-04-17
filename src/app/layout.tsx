import type { Metadata } from "next"
import { DM_Sans, Fraunces } from "next/font/google"
import "./globals.css"

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
})

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  weight: ["400", "600", "700"],
})

export const metadata: Metadata = {
  title: "Odonto Gestión — Sistema Integral para Clínicas Dentales",
  description: "Sistema de gestión integral para clínicas dentales: turnos, cobranzas, gastos, stock, empleados y laboratorio.",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="es" className={`${dmSans.variable} ${fraunces.variable}`}>
      <body className="min-h-screen bg-beige text-text-primary font-sans antialiased">
        {children}
      </body>
    </html>
  )
}

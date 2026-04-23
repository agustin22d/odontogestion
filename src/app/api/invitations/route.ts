import { NextResponse } from 'next/server'
import { Resend } from 'resend'
import { createClient } from '@/lib/supabase/server'

/**
 * Crea una invitación + envía email con el link `/invite/<token>`.
 *
 * Body JSON: { email: string, role_id: string, sede_id?: string }
 *
 * RLS valida que el caller tenga `settings.users` (vía has_permission).
 * Si Resend falla (o no hay RESEND_API_KEY), igual se devuelve el link
 * para que el admin lo copie a mano (fallback explícito).
 */
export async function POST(req: Request) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  let body: { email?: string; role_id?: string; sede_id?: string | null }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Body inválido' }, { status: 400 })
  }
  const email = body.email?.trim().toLowerCase()
  const role_id = body.role_id
  const sede_id = body.sede_id || null
  if (!email || !role_id) {
    return NextResponse.json({ error: 'Faltan email o role_id' }, { status: 400 })
  }

  // Obtener clinic_id + nombre de la clínica del invitador.
  // invitations.clinic_id es NOT NULL y no tiene trigger auto_set_clinic_id,
  // así que hay que pasarlo explícito para que pase el RLS WITH CHECK.
  const { data: cu, error: cuErr } = await supabase
    .from('clinic_users')
    .select('clinic_id, clinics(nombre)')
    .eq('auth_user_id', user.id)
    .eq('activo', true)
    .maybeSingle()
  if (cuErr || !cu) {
    return NextResponse.json({ error: 'Sin membresía activa en una clínica' }, { status: 403 })
  }
  const clinicData = cu as unknown as { clinic_id: string; clinics: { nombre: string } | null }
  const clinic_id = clinicData.clinic_id
  const clinicNombre = clinicData.clinics?.nombre || 'tu clínica'

  // Insert (RLS valida settings.users via has_permission y clinic_id match)
  const { data: inserted, error: insErr } = await supabase
    .from('invitations')
    .insert({ clinic_id, email, role_id, sede_id, invited_by: user.id })
    .select('token, expires_at')
    .single()

  if (insErr) {
    return NextResponse.json({ error: insErr.message }, { status: 400 })
  }
  const { token, expires_at } = inserted as unknown as { token: string; expires_at: string }

  const { data: roleRow } = await supabase
    .from('roles')
    .select('nombre')
    .eq('id', role_id)
    .maybeSingle()
  const roleNombre = (roleRow as { nombre?: string } | null)?.nombre || 'Empleado'

  const origin = (() => {
    const fromHeader = req.headers.get('origin')
    if (fromHeader) return fromHeader
    const url = new URL(req.url)
    return `${url.protocol}//${url.host}`
  })()
  const link = `${origin}/invite/${token}`

  // Mandar email (best-effort)
  let emailSent = false
  let emailError: string | null = null
  const apiKey = process.env.RESEND_API_KEY
  const fromAddr = process.env.RESEND_FROM_EMAIL || 'Odonto Gestión <onboarding@resend.dev>'

  if (apiKey) {
    try {
      const resend = new Resend(apiKey)
      const result = await resend.emails.send({
        from: fromAddr,
        to: [email],
        subject: `Invitación a ${clinicNombre} en Odonto Gestión`,
        html: renderInvitationEmail({ clinicNombre, roleNombre, link, expiresAt: expires_at }),
      })
      if (result.error) {
        emailError = result.error.message || String(result.error)
      } else {
        emailSent = true
      }
    } catch (e) {
      emailError = e instanceof Error ? e.message : String(e)
    }
  } else {
    emailError = 'RESEND_API_KEY no configurada'
  }

  return NextResponse.json({ token, link, emailSent, emailError })
}

function renderInvitationEmail({
  clinicNombre, roleNombre, link, expiresAt,
}: {
  clinicNombre: string
  roleNombre: string
  link: string
  expiresAt: string
}) {
  const venceTxt = new Date(expiresAt).toLocaleDateString('es-AR', {
    day: '2-digit', month: 'long', year: 'numeric',
  })
  return `<!DOCTYPE html>
<html>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f5f1ea;margin:0;padding:32px 16px;color:#222">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;margin:0 auto;background:#fff;border:1px solid #e5e0d6;border-radius:12px;overflow:hidden">
    <tr><td style="padding:28px 28px 8px">
      <p style="margin:0 0 4px;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:#0ea5e9;font-weight:600">Odonto Gestión</p>
      <h1 style="margin:0;font-size:22px;font-weight:600;color:#1a1a1a">Te invitaron a ${escapeHtml(clinicNombre)}</h1>
    </td></tr>
    <tr><td style="padding:8px 28px 0;font-size:14px;line-height:1.55;color:#444">
      <p style="margin:0 0 12px">El equipo de <strong>${escapeHtml(clinicNombre)}</strong> te invitó a unirte como <strong>${escapeHtml(roleNombre)}</strong>.</p>
      <p style="margin:0 0 4px">Hacé click en el botón para crear tu cuenta y empezar:</p>
    </td></tr>
    <tr><td style="padding:20px 28px">
      <a href="${link}" style="display:inline-block;background:#0ea5e9;color:#fff;text-decoration:none;font-weight:600;font-size:14px;padding:11px 22px;border-radius:8px">Aceptar invitación</a>
    </td></tr>
    <tr><td style="padding:0 28px 28px;font-size:12px;line-height:1.55;color:#666">
      <p style="margin:0 0 8px">O copiá y pegá este link en el navegador:</p>
      <p style="margin:0 0 16px;word-break:break-all;font-family:monospace;font-size:11px;color:#888">${link}</p>
      <p style="margin:0;color:#999">El link vence el ${venceTxt}.</p>
    </td></tr>
  </table>
</body>
</html>`
}

function escapeHtml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

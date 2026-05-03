import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const webhookUrl = process.env.DI_ADMIN_WEBHOOK_URL
  const webhookSecret = process.env.DI_ADMIN_WEBHOOK_SECRET

  if (!webhookUrl || !webhookSecret) {
    return NextResponse.json({ ok: true }) // fail-soft si no está configurado
  }

  try {
    const body = await req.json()
    await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${webhookSecret}`,
      },
      body: JSON.stringify(body),
    })
  } catch {
    // fail-soft
  }

  return NextResponse.json({ ok: true })
}

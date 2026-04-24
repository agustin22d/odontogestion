'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Building2, UserCog, Mail, Check, ArrowRight, ArrowLeft, Sparkles, Plus, X } from 'lucide-react'

type Step = 0 | 1 | 2 | 3

interface SedeDraft { nombre: string; direccion: string }
interface ProfDraft { nombre: string; apellido: string; duracion_default_min: number; color: string }
interface InviteDraft { email: string }

const COLORS = ['#4a7c59', '#d4a574', '#8c5a8c', '#5a8ca8', '#a85a5a', '#5aa888']

export default function OnboardingWizard({ initialClinicName }: { initialClinicName: string | null }) {
  const router = useRouter()
  const supabase = createClient()
  const [step, setStep] = useState<Step>(0)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [sedes, setSedes] = useState<SedeDraft[]>([{ nombre: '', direccion: '' }])
  const [profesionales, setProfesionales] = useState<ProfDraft[]>([{ nombre: '', apellido: '', duracion_default_min: 30, color: COLORS[0] }])
  const [invites, setInvites] = useState<InviteDraft[]>([])

  const stepTitles = ['Tu clínica', 'Sedes', 'Profesionales', 'Equipo']

  async function handleFinish() {
    setSaving(true)
    setError(null)

    const sedesValidas = sedes.filter(s => s.nombre.trim())
    const profsValidos = profesionales.filter(p => p.nombre.trim())
    const invitesValidos = invites.filter(i => i.email.trim())

    if (sedesValidas.length === 0) {
      setError('Tenés que cargar al menos una sede.')
      setStep(1)
      setSaving(false)
      return
    }

    // 1) Sedes
    const { data: sedesIns, error: e1 } = await supabase
      .from('sedes')
      .insert(sedesValidas.map(s => ({ nombre: s.nombre.trim(), direccion: s.direccion.trim() || null, activa: true })))
      .select('id')

    if (e1) {
      setError('Error al crear sedes: ' + e1.message)
      setSaving(false)
      return
    }
    const sedeIds = ((sedesIns ?? []) as { id: string }[]).map(s => s.id)

    // 2) Profesionales (asignados a todas las sedes que se acaban de crear)
    if (profsValidos.length > 0) {
      const { data: profsIns, error: e2 } = await supabase
        .from('profesionales')
        .insert(profsValidos.map(p => ({
          nombre: p.nombre.trim(),
          apellido: p.apellido.trim() || null,
          duracion_default_min: p.duracion_default_min,
          color: p.color,
          activo: true,
        })))
        .select('id')

      if (e2) {
        setError('Error al crear profesionales: ' + e2.message)
        setSaving(false)
        return
      }

      // Vincular cada profesional a TODAS las sedes
      const profIds = ((profsIns ?? []) as { id: string }[]).map(p => p.id)
      if (profIds.length > 0 && sedeIds.length > 0) {
        const links = profIds.flatMap(pid => sedeIds.map(sid => ({ profesional_id: pid, sede_id: sid })))
        await supabase.from('profesional_sedes').insert(links)
      }
    }

    // 3) Invitaciones (best-effort: errores se loguean, no rompen el flow)
    for (const inv of invitesValidos) {
      try {
        await fetch('/api/invitations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: inv.email.trim(), role_id: null, sede_id: null }),
        })
      } catch {
        // ignore — el user puede invitar después desde Configuración
      }
    }

    // 4) Marcar como onboarded
    const { error: e4 } = await supabase.rpc('mark_onboarded')
    if (e4) {
      setError('Error al finalizar: ' + e4.message)
      setSaving(false)
      return
    }

    router.replace('/dashboard')
  }

  return (
    <div className="min-h-screen bg-bg flex items-start sm:items-center justify-center p-4 py-10">
      <div className="max-w-2xl w-full">
        {/* Stepper */}
        <div className="flex items-center justify-between mb-6 px-2">
          {stepTitles.map((title, idx) => {
            const active = idx === step
            const done = idx < step
            return (
              <div key={idx} className="flex items-center gap-2 flex-1">
                <div className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold
                  ${done ? 'bg-green-primary text-white' : active ? 'bg-green-primary text-white ring-4 ring-green-light' : 'bg-beige text-text-muted'}
                `}>
                  {done ? <Check size={14} /> : idx + 1}
                </div>
                <span className={`hidden sm:inline text-xs font-medium ${active ? 'text-text-primary' : 'text-text-muted'}`}>{title}</span>
                {idx < stepTitles.length - 1 && <div className={`flex-1 h-px ${done ? 'bg-green-primary' : 'bg-border'}`} />}
              </div>
            )
          })}
        </div>

        <div className="bg-surface rounded-2xl border border-border p-6 md:p-8 shadow-sm">
          {step === 0 && <StepBienvenida clinicName={initialClinicName} onNext={() => setStep(1)} />}
          {step === 1 && <StepSedes sedes={sedes} setSedes={setSedes} onBack={() => setStep(0)} onNext={() => setStep(2)} />}
          {step === 2 && <StepProfesionales profs={profesionales} setProfs={setProfesionales} onBack={() => setStep(1)} onNext={() => setStep(3)} />}
          {step === 3 && <StepInvitar invites={invites} setInvites={setInvites} onBack={() => setStep(2)} onFinish={handleFinish} saving={saving} error={error} />}
        </div>

        <p className="text-center text-xs text-text-muted mt-4">
          Podés saltear estos pasos y configurar después desde Configuración. Pero te recomendamos cargar al menos una sede ahora.
        </p>
      </div>
    </div>
  )
}

function StepBienvenida({ clinicName, onNext }: { clinicName: string | null; onNext: () => void }) {
  return (
    <div className="text-center">
      <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-green-light text-green-primary mb-4">
        <Sparkles size={24} />
      </div>
      <h1 className="font-display text-2xl md:text-3xl font-semibold text-text-primary mb-2">
        ¡Bienvenido{clinicName ? ` a ${clinicName}` : ''}!
      </h1>
      <p className="text-text-secondary mb-8 max-w-md mx-auto">
        En 4 pasos rápidos dejamos lista tu clínica para empezar a usarla. Vas a poder cargar más cosas después desde Configuración.
      </p>
      <ol className="text-left text-sm text-text-secondary space-y-2 max-w-sm mx-auto mb-8">
        <li className="flex items-center gap-2"><Building2 size={16} className="text-text-muted" /> Cargá tus sedes</li>
        <li className="flex items-center gap-2"><UserCog size={16} className="text-text-muted" /> Sumá tus profesionales</li>
        <li className="flex items-center gap-2"><Mail size={16} className="text-text-muted" /> Invitá a tu equipo (opcional)</li>
      </ol>
      <button
        onClick={onNext}
        className="inline-flex items-center gap-2 px-5 py-3 bg-green-primary hover:bg-green-primary/90 text-white rounded-lg text-sm font-medium transition-colors"
      >
        Empezar <ArrowRight size={16} />
      </button>
    </div>
  )
}

function StepSedes({ sedes, setSedes, onBack, onNext }: { sedes: SedeDraft[]; setSedes: (s: SedeDraft[]) => void; onBack: () => void; onNext: () => void }) {
  const update = (i: number, k: keyof SedeDraft, v: string) => {
    const next = [...sedes]
    next[i] = { ...next[i], [k]: v }
    setSedes(next)
  }
  const add = () => setSedes([...sedes, { nombre: '', direccion: '' }])
  const remove = (i: number) => setSedes(sedes.filter((_, idx) => idx !== i))

  const algunaCargada = sedes.some(s => s.nombre.trim())

  return (
    <div>
      <h2 className="font-display text-2xl font-semibold text-text-primary mb-2">Cargá tus sedes</h2>
      <p className="text-sm text-text-secondary mb-6">Una sede es cada local físico de la clínica. Más adelante asignás los profesionales y los turnos a cada sede.</p>

      <div className="space-y-3 mb-4">
        {sedes.map((s, i) => (
          <div key={i} className="grid grid-cols-1 sm:grid-cols-[1fr_1.5fr_auto] gap-2 items-start">
            <input
              value={s.nombre}
              onChange={e => update(i, 'nombre', e.target.value)}
              placeholder="Nombre (ej: Sede Centro)"
              className="border border-border rounded-lg px-3 py-2 text-sm bg-bg focus:outline-none focus:border-green-primary"
            />
            <input
              value={s.direccion}
              onChange={e => update(i, 'direccion', e.target.value)}
              placeholder="Dirección (opcional)"
              className="border border-border rounded-lg px-3 py-2 text-sm bg-bg focus:outline-none focus:border-green-primary"
            />
            {sedes.length > 1 && (
              <button onClick={() => remove(i)} className="text-text-muted hover:text-red p-2" title="Quitar">
                <X size={16} />
              </button>
            )}
          </div>
        ))}
      </div>

      <button onClick={add} className="inline-flex items-center gap-1.5 text-sm text-green-primary hover:underline mb-6">
        <Plus size={14} /> Agregar otra sede
      </button>

      <div className="flex justify-between gap-2 pt-4 border-t border-border">
        <button onClick={onBack} className="inline-flex items-center gap-1.5 px-4 py-2 text-sm text-text-secondary hover:text-text-primary">
          <ArrowLeft size={14} /> Atrás
        </button>
        <button
          onClick={onNext}
          disabled={!algunaCargada}
          className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-green-primary hover:bg-green-primary/90 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition-colors"
        >
          Siguiente <ArrowRight size={14} />
        </button>
      </div>
    </div>
  )
}

function StepProfesionales({ profs, setProfs, onBack, onNext }: { profs: ProfDraft[]; setProfs: (p: ProfDraft[]) => void; onBack: () => void; onNext: () => void }) {
  const update = (i: number, k: keyof ProfDraft, v: string | number) => {
    const next = [...profs]
    next[i] = { ...next[i], [k]: v as never }
    setProfs(next)
  }
  const add = () => setProfs([...profs, { nombre: '', apellido: '', duracion_default_min: 30, color: COLORS[profs.length % COLORS.length] }])
  const remove = (i: number) => setProfs(profs.filter((_, idx) => idx !== i))

  return (
    <div>
      <h2 className="font-display text-2xl font-semibold text-text-primary mb-2">Sumá tus profesionales</h2>
      <p className="text-sm text-text-secondary mb-6">Quiénes van a atender en la agenda. Podés saltearlo si todavía no los tenés definidos. Después configurás horarios y bloqueos en Configuración.</p>

      <div className="space-y-3 mb-4">
        {profs.map((p, i) => (
          <div key={i} className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_100px_auto_auto] gap-2 items-start">
            <input
              value={p.nombre}
              onChange={e => update(i, 'nombre', e.target.value)}
              placeholder="Nombre"
              className="border border-border rounded-lg px-3 py-2 text-sm bg-bg focus:outline-none focus:border-green-primary"
            />
            <input
              value={p.apellido}
              onChange={e => update(i, 'apellido', e.target.value)}
              placeholder="Apellido"
              className="border border-border rounded-lg px-3 py-2 text-sm bg-bg focus:outline-none focus:border-green-primary"
            />
            <input
              type="number"
              min={5}
              step={5}
              value={p.duracion_default_min}
              onChange={e => update(i, 'duracion_default_min', Number(e.target.value))}
              title="Duración default por turno (min)"
              className="border border-border rounded-lg px-3 py-2 text-sm bg-bg focus:outline-none focus:border-green-primary"
            />
            <input
              type="color"
              value={p.color}
              onChange={e => update(i, 'color', e.target.value)}
              title="Color en la agenda"
              className="w-10 h-10 border border-border rounded-lg cursor-pointer"
            />
            {profs.length > 1 && (
              <button onClick={() => remove(i)} className="text-text-muted hover:text-red p-2" title="Quitar">
                <X size={16} />
              </button>
            )}
          </div>
        ))}
      </div>

      <button onClick={add} className="inline-flex items-center gap-1.5 text-sm text-green-primary hover:underline mb-6">
        <Plus size={14} /> Agregar otro profesional
      </button>

      <div className="flex justify-between gap-2 pt-4 border-t border-border">
        <button onClick={onBack} className="inline-flex items-center gap-1.5 px-4 py-2 text-sm text-text-secondary hover:text-text-primary">
          <ArrowLeft size={14} /> Atrás
        </button>
        <button
          onClick={onNext}
          className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-green-primary hover:bg-green-primary/90 text-white rounded-lg text-sm font-medium transition-colors"
        >
          Siguiente <ArrowRight size={14} />
        </button>
      </div>
    </div>
  )
}

function StepInvitar({ invites, setInvites, onBack, onFinish, saving, error }: {
  invites: InviteDraft[]; setInvites: (i: InviteDraft[]) => void; onBack: () => void; onFinish: () => void; saving: boolean; error: string | null
}) {
  const update = (i: number, v: string) => {
    const next = [...invites]
    next[i] = { email: v }
    setInvites(next)
  }
  const add = () => setInvites([...invites, { email: '' }])
  const remove = (i: number) => setInvites(invites.filter((_, idx) => idx !== i))

  return (
    <div>
      <h2 className="font-display text-2xl font-semibold text-text-primary mb-2">Invitá a tu equipo</h2>
      <p className="text-sm text-text-secondary mb-6">
        Mandales el link de acceso por email. Los podés agregar después en Configuración → Equipo. <span className="text-text-muted">(Opcional)</span>
      </p>

      {invites.length === 0 ? (
        <button
          onClick={add}
          className="w-full border border-dashed border-border rounded-lg px-4 py-6 text-sm text-text-secondary hover:bg-beige/30 transition-colors flex items-center justify-center gap-2"
        >
          <Plus size={14} /> Invitar a alguien
        </button>
      ) : (
        <div className="space-y-3 mb-4">
          {invites.map((inv, i) => (
            <div key={i} className="grid grid-cols-[1fr_auto] gap-2 items-start">
              <input
                type="email"
                value={inv.email}
                onChange={e => update(i, e.target.value)}
                placeholder="email@clinica.com"
                className="border border-border rounded-lg px-3 py-2 text-sm bg-bg focus:outline-none focus:border-green-primary"
              />
              <button onClick={() => remove(i)} className="text-text-muted hover:text-red p-2" title="Quitar">
                <X size={16} />
              </button>
            </div>
          ))}
          <button onClick={add} className="inline-flex items-center gap-1.5 text-sm text-green-primary hover:underline">
            <Plus size={14} /> Agregar otro
          </button>
        </div>
      )}

      {error && (
        <div className="my-4 p-3 bg-red-light border border-red/20 rounded-lg text-sm text-red">{error}</div>
      )}

      <div className="flex justify-between gap-2 pt-4 border-t border-border mt-6">
        <button onClick={onBack} disabled={saving} className="inline-flex items-center gap-1.5 px-4 py-2 text-sm text-text-secondary hover:text-text-primary disabled:opacity-50">
          <ArrowLeft size={14} /> Atrás
        </button>
        <button
          onClick={onFinish}
          disabled={saving}
          className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-green-primary hover:bg-green-primary/90 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
        >
          {saving ? 'Guardando...' : 'Finalizar configuración'} <Check size={14} />
        </button>
      </div>
    </div>
  )
}

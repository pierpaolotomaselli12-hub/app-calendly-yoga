import { useState, useRef, useEffect, type ChangeEvent } from 'react'
import {
  Plus, SlidersHorizontal, Leaf, Pencil, MoreHorizontal,
  MapPin, CalendarDays, X, Trash2, User,
} from 'lucide-react'
import { useApp } from '../../context/AppContext'
import { supabase } from '../../lib/supabase'
import type { YogaEvent, EventFormData } from '../../types'
import './AdminEvents.css'

// ─── Color palette ───────────────────────────────────────────────────────────

const GRADIENT_COLORS = ['#6b7048','#b87a5a','#5a7858','#607080','#7a5070','#8b7040']

function eventColor(id: string): string {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) & 0xffff
  return GRADIENT_COLORS[h % GRADIENT_COLORS.length]
}

function hexDarken(hex: string, amt = 28): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgb(${Math.max(0, r - amt)},${Math.max(0, g - amt)},${Math.max(0, b - amt)})`
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const DAY_NAMES  = ['Dom','Lun','Mar','Mer','Gio','Ven','Sab']
const MONTH_FULL = ['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno',
                    'Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre']

function parsePrice(price: string): number {
  const m = price.replace(/[.,](\d{2})$/, '').match(/\d+/)
  return m ? parseInt(m[0], 10) : 0
}

function daysUntil(dateStr: string): number {
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const [y, mo, d] = dateStr.split('-').map(Number)
  return Math.ceil((new Date(y, mo - 1, d).getTime() - today.getTime()) / 86_400_000)
}

function daysUntilText(dateStr: string): string {
  const n = daysUntil(dateStr)
  if (n < 0)   return 'Passato'
  if (n === 0) return 'Oggi'
  if (n === 1) return 'Domani'
  return `Tra ${n} giorni`
}

function formatDateLong(dateStr: string, time: string): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  return `${DAY_NAMES[dt.getDay()]} ${d} ${MONTH_FULL[m - 1]} · ${time}`
}

function formatDateShort(dateStr: string, time: string): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  return `${DAY_NAMES[dt.getDay()]} ${d} · ${time}`
}

// ─── Modal wrapper ────────────────────────────────────────────────────────────

function Modal({ title, onClose, children, wide = false }: {
  title: string; onClose: () => void; children: React.ReactNode; wide?: boolean
}) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div className="ev-overlay" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className={`ev-modal${wide ? ' ev-modal--wide' : ''}`}>
        <div className="ev-modal-head">
          <h2 className="ev-modal-title">{title}</h2>
          <button className="ev-modal-close" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="ev-modal-body">{children}</div>
      </div>
    </div>
  )
}

// ─── Options Menu ────────────────────────────────────────────────────────────

function OptionsMenu({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  return (
    <div className="ev-menu-wrap" ref={ref}>
      <button className="ev-card-icon-btn" onClick={() => setOpen(v => !v)}>
        <MoreHorizontal size={14} />
      </button>
      {open && (
        <div className="ev-menu">
          <button className="ev-menu-item" onClick={() => { onEdit(); setOpen(false) }}>
            <Pencil size={13} /> Modifica
          </button>
          <div className="ev-menu-sep" />
          <button className="ev-menu-item ev-menu-item--danger" onClick={() => { onDelete(); setOpen(false) }}>
            <Trash2 size={13} /> Elimina
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Event Card ───────────────────────────────────────────────────────────────

function EventCard({ event, onEdit, onDelete, onDetails, onRegistrations }: {
  event: YogaEvent
  onEdit: () => void
  onDelete: () => void
  onDetails: () => void
  onRegistrations: () => void
}) {
  const color = eventColor(event.id)
  const gradient = `linear-gradient(135deg, ${color} 0%, ${hexDarken(color)} 100%)`
  const stripes  = 'repeating-linear-gradient(-45deg, rgba(255,255,255,0.04) 0px, rgba(255,255,255,0.04) 1px, transparent 1px, transparent 13px)'

  const days = daysUntil(event.date)
  const pct  = event.maxParticipants > 0
    ? Math.round((event.bookings.length / event.maxParticipants) * 100)
    : 0
  const isFull = event.bookings.length >= event.maxParticipants
  const price  = event.price.trim()

  return (
    <div className="ev-card">
      {/* Gradient header */}
      <div className="ev-card-header" style={{ background: gradient }}>
        <div className="ev-card-header-overlay" style={{ background: stripes }} />

        <div className="ev-card-badges">
          {price && <span className="ev-badge-price">{price}</span>}
          <span className="ev-badge-time">
            {days > 0 ? `TRA ${days}G` : days === 0 ? 'OGGI' : 'PASSATO'}
          </span>
        </div>

        <div className="ev-card-actions">
          <button className="ev-card-icon-btn" onClick={onEdit}><Pencil size={14} /></button>
          <OptionsMenu onEdit={onEdit} onDelete={onDelete} />
        </div>

        <Leaf className="ev-card-leaf" size={48} />

        {isFull && days >= 0 && <span className="ev-badge-full-overlay">Al completo</span>}
      </div>

      {/* Content */}
      <div className="ev-card-body">
        <h3 className="ev-card-title">{event.title}</h3>

        <div className="ev-card-meta">
          <span className="ev-card-meta-row">
            <CalendarDays size={13} className="ev-meta-icon" />
            {formatDateLong(event.date, event.time)}
          </span>
          {event.location && (
            <span className="ev-card-meta-row">
              <MapPin size={13} className="ev-meta-icon" />
              {event.location}
            </span>
          )}
        </div>

        <div className="ev-card-enroll">
          <div className="ev-enroll-row">
            <span className="ev-enroll-count">
              <strong>{event.bookings.length}</strong> / {event.maxParticipants} iscritti
            </span>
            <span className="ev-enroll-pct">{pct}%</span>
          </div>
          <div className="ev-progress-track">
            <div className="ev-progress-fill" style={{ width: `${pct}%` }} />
          </div>
        </div>

        <div className="ev-card-ctas">
          <button className="ev-cta-outline" onClick={onDetails}>Dettagli</button>
          <button className="ev-cta-solid" onClick={onRegistrations}>
            Iscritti ({event.bookings.length})
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="ev-stat-card">
      <p className="ev-stat-label">{label}</p>
      {children}
    </div>
  )
}

// ─── Details Modal ────────────────────────────────────────────────────────────

function DetailsModal({ event, onClose }: { event: YogaEvent; onClose: () => void }) {
  const color = eventColor(event.id)
  const gradient = `linear-gradient(135deg, ${color} 0%, ${hexDarken(color)} 100%)`
  const pct = event.maxParticipants > 0
    ? Math.round((event.bookings.length / event.maxParticipants) * 100)
    : 0

  return (
    <Modal title="Dettagli evento" onClose={onClose} wide>
      <div className="ev-detail">
        <div className="ev-detail-banner" style={{ background: gradient }}>
          <div className="ev-detail-banner-overlay" />
          <Leaf className="ev-card-leaf" size={42} />
          {event.imageUrl && <img src={event.imageUrl} alt="" className="ev-detail-img" />}
        </div>

        <h2 className="ev-detail-title">{event.title}</h2>

        <div className="ev-detail-meta">
          <span className="ev-card-meta-row">
            <CalendarDays size={14} className="ev-meta-icon" />{formatDateLong(event.date, event.time)}
          </span>
          {event.location && (
            <span className="ev-card-meta-row">
              <MapPin size={14} className="ev-meta-icon" />{event.location}
            </span>
          )}
          {event.price && <span className="ev-card-meta-row">💰 {event.price}</span>}
        </div>

        {event.description && <p className="ev-detail-desc">{event.description}</p>}

        <div className="ev-detail-stats">
          <div className="ev-detail-stat-row">
            <span>Iscritti</span>
            <strong>{event.bookings.length} / {event.maxParticipants}</strong>
          </div>
          <div className="ev-progress-track">
            <div className="ev-progress-fill" style={{ width: `${pct}%` }} />
          </div>
          <div className="ev-detail-stat-sub">
            <span>{event.maxParticipants - event.bookings.length} posti disponibili</span>
            <span>{pct}% pieno</span>
          </div>
          {event.waitlist.length > 0 && (
            <p className="ev-detail-waitlist">+{event.waitlist.length} in lista d'attesa</p>
          )}
        </div>

        {event.notes && (
          <div className="ev-detail-notes">
            <span className="ev-detail-notes-label">Note</span>
            <p>{event.notes}</p>
          </div>
        )}

        <div className="ev-modal-foot">
          <button className="ev-btn-cancel" onClick={onClose}>Chiudi</button>
        </div>
      </div>
    </Modal>
  )
}

// ─── Registrations Modal ──────────────────────────────────────────────────────

function RegistrationsModal({ event, onClose }: { event: YogaEvent; onClose: () => void }) {
  return (
    <Modal title={`Iscritti — ${event.title}`} onClose={onClose}>
      <p className="ev-reg-count">
        {event.bookings.length} iscritti · {event.maxParticipants - event.bookings.length} posti liberi
      </p>

      {event.bookings.length === 0 ? (
        <p className="ev-reg-empty">Nessun iscritto ancora.</p>
      ) : (
        <ul className="ev-reg-list">
          {event.bookings.map((b, i) => (
            <li key={b.id} className="ev-reg-item">
              <div className="ev-reg-avatar">
                {b.firstName?.[0]?.toUpperCase() ?? <User size={14} />}
              </div>
              <div className="ev-reg-info">
                <span className="ev-reg-name">{b.firstName} {b.lastName}</span>
                <span className="ev-reg-email">{b.email}</span>
                {b.phone && <span className="ev-reg-phone">{b.phone}</span>}
              </div>
              <span className="ev-reg-num">#{i + 1}</span>
            </li>
          ))}
        </ul>
      )}

      {event.waitlist.length > 0 && (
        <div className="ev-waitlist-section">
          <p className="ev-waitlist-title">Lista d'attesa ({event.waitlist.length})</p>
          <ul className="ev-reg-list">
            {event.waitlist.map((w, i) => (
              <li key={w.id} className="ev-reg-item ev-reg-item--wait">
                <div className="ev-reg-avatar ev-reg-avatar--wait">
                  {w.firstName?.[0]?.toUpperCase() ?? <User size={14} />}
                </div>
                <div className="ev-reg-info">
                  <span className="ev-reg-name">{w.firstName} {w.lastName}</span>
                  <span className="ev-reg-email">{w.email}</span>
                </div>
                <span className="ev-reg-num ev-reg-num--wait">A{i + 1}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="ev-modal-foot">
        <button className="ev-btn-cancel" onClick={onClose}>Chiudi</button>
      </div>
    </Modal>
  )
}

// ─── Form Modal ───────────────────────────────────────────────────────────────

const emptyForm: EventFormData = {
  title: '', description: '', date: '', time: '',
  location: '', price: '', notes: '', imageUrl: '', maxParticipants: 20,
}

function EventFormModal({ initial, onClose, onSave }: {
  initial?: YogaEvent | null
  onClose: () => void
  onSave: (form: EventFormData) => Promise<void>
}) {
  const [form, setForm] = useState<EventFormData>(
    initial
      ? { title: initial.title, description: initial.description, date: initial.date,
          time: initial.time, location: initial.location, price: initial.price,
          notes: initial.notes, imageUrl: initial.imageUrl, maxParticipants: initial.maxParticipants }
      : emptyForm
  )
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string>(initial?.imageUrl ?? '')
  const [saving, setSaving] = useState(false)

  function upd(field: keyof EventFormData, value: string | number) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  function handleImageChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setImageFile(file)
    setImagePreview(URL.createObjectURL(file))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    let imageUrl = form.imageUrl
    try {
      if (imageFile) {
        const ext = imageFile.name.split('.').pop() ?? 'jpg'
        const path = `events/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
        const { error } = await supabase.storage.from('images').upload(path, imageFile)
        if (!error) imageUrl = supabase.storage.from('images').getPublicUrl(path).data.publicUrl
      }
    } catch { /* keep existing URL */ }
    await onSave({ ...form, imageUrl })
    setSaving(false)
    onClose()
  }

  return (
    <Modal title={initial ? 'Modifica evento' : 'Nuovo evento'} onClose={onClose} wide>
      <form className="ev-form" onSubmit={handleSubmit}>
        <div className="ev-form-grid">
          <div className="ev-form-col-full">
            <label className="ev-label">Titolo *</label>
            <input required placeholder="Es. Workshop di meditazione"
              value={form.title} onChange={e => upd('title', e.target.value)} />
          </div>

          <div>
            <label className="ev-label">Data *</label>
            <input type="date" required value={form.date} onChange={e => upd('date', e.target.value)} />
          </div>

          <div>
            <label className="ev-label">Orario *</label>
            <input type="time" required value={form.time} onChange={e => upd('time', e.target.value)} />
          </div>

          <div>
            <label className="ev-label">Max partecipanti</label>
            <input type="number" min={1} value={form.maxParticipants}
              onChange={e => upd('maxParticipants', parseInt(e.target.value, 10) || 1)} />
          </div>

          <div>
            <label className="ev-label">Prezzo</label>
            <input placeholder="Es. €30 · Gratuito"
              value={form.price} onChange={e => upd('price', e.target.value)} />
          </div>

          <div className="ev-form-col-full">
            <label className="ev-label">Luogo</label>
            <input placeholder="Es. Studio Yoga, Sala grande"
              value={form.location} onChange={e => upd('location', e.target.value)} />
          </div>

          <div className="ev-form-col-full">
            <label className="ev-label">Descrizione</label>
            <textarea rows={3} placeholder="Descrivi l'evento…"
              value={form.description} onChange={e => upd('description', e.target.value)} />
          </div>

          <div className="ev-form-col-full">
            <label className="ev-label">Note</label>
            <textarea rows={2} placeholder="Informazioni aggiuntive…"
              value={form.notes} onChange={e => upd('notes', e.target.value)} />
          </div>

          <div className="ev-form-col-full">
            <label className="ev-label">Immagine (opzionale)</label>
            {imagePreview && (
              <div className="ev-img-preview-wrap">
                <img src={imagePreview} className="ev-img-preview" alt="" />
                <button type="button" className="ev-img-remove"
                  onClick={() => { setImageFile(null); setImagePreview(''); upd('imageUrl', '') }}>
                  Rimuovi
                </button>
              </div>
            )}
            <label className="ev-img-upload-btn">
              {imagePreview ? 'Cambia immagine' : '+ Carica immagine'}
              <input type="file" accept="image/jpeg,image/png,image/webp"
                onChange={handleImageChange} style={{ display: 'none' }} />
            </label>
            <p className="ev-form-hint">JPG o WebP · consigliato <strong>1280 × 720 px</strong> · max 2 MB</p>
          </div>
        </div>

        <div className="ev-form-foot">
          <button type="submit" className="ev-btn-save" disabled={saving}>
            {saving ? (imageFile ? 'Caricamento…' : 'Salvataggio…') : initial ? 'Salva modifiche' : 'Crea evento'}
          </button>
          <button type="button" className="ev-btn-cancel" onClick={onClose}>Annulla</button>
        </div>
      </form>
    </Modal>
  )
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function AdminEvents() {
  const { events, addEvent, updateEvent, deleteEvent } = useApp()

  const [showForm, setShowForm]           = useState(false)
  const [editingEvent, setEditingEvent]   = useState<YogaEvent | null>(null)
  const [detailsEvent, setDetailsEvent]   = useState<YogaEvent | null>(null)
  const [regsEvent, setRegsEvent]         = useState<YogaEvent | null>(null)
  const [deleteId, setDeleteId]           = useState<string | null>(null)
  const [filterTime, setFilterTime]       = useState<'upcoming' | 'past' | 'all'>('upcoming')
  const [showFilter, setShowFilter]       = useState(false)

  const todayISO = new Date().toISOString().slice(0, 10)

  const activeEvents       = events.filter(e => e.date >= todayISO)
  const totalRegistrations = events.reduce((s, e) => s + e.bookings.length, 0)
  const totalCapacity      = events.reduce((s, e) => s + e.maxParticipants, 0)
  const totalRevenue       = events.reduce((s, e) => s + parsePrice(e.price) * e.bookings.length, 0)
  const nextEvent          = [...activeEvents].sort((a, b) =>
    a.date.localeCompare(b.date) || a.time.localeCompare(b.time))[0]
  const regRatio           = totalCapacity > 0 ? totalRegistrations / totalCapacity : 0

  const filteredEvents = [...events]
    .filter(e => {
      if (filterTime === 'upcoming') return e.date >= todayISO
      if (filterTime === 'past')     return e.date <  todayISO
      return true
    })
    .sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time))

  async function handleSave(form: EventFormData) {
    if (editingEvent) await updateEvent(editingEvent.id, form)
    else              await addEvent(form)
  }

  async function confirmDelete(id: string) {
    await deleteEvent(id)
    setDeleteId(null)
  }

  return (
    <div className="ev-page">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="ev-header">
        <div>
          <h1 className="ev-title">Eventi &amp; ritiri</h1>
          <p className="ev-subtitle">
            {activeEvents.length} {activeEvents.length === 1 ? 'evento pubblicato' : 'eventi pubblicati'}
            {' · '}{totalRegistrations} {totalRegistrations === 1 ? 'iscritto' : 'iscritti'}
            {totalRevenue > 0 ? ` · ${Math.round(totalRevenue)}€ generati` : ''}
          </p>
        </div>
        <div className="ev-header-btns">
          <button
            className={`ev-btn-filter${filterTime !== 'upcoming' ? ' ev-btn-filter--active' : ''}`}
            onClick={() => setShowFilter(v => !v)}
          >
            <SlidersHorizontal size={15} />
            Filtri
            {filterTime !== 'upcoming' && <span className="ev-filter-dot" />}
          </button>
          <button className="ev-btn-new" onClick={() => { setEditingEvent(null); setShowForm(true) }}>
            <Plus size={16} /> Nuovo evento
          </button>
        </div>
      </div>

      {/* ── Filter panel ───────────────────────────────────────────────── */}
      {showFilter && (
        <div className="ev-filter-panel">
          <span className="ev-filter-label">Periodo</span>
          <div className="ev-filter-btns">
            {(['upcoming', 'past', 'all'] as const).map(t => (
              <button
                key={t}
                className={`ev-filter-btn${filterTime === t ? ' ev-filter-btn--on' : ''}`}
                onClick={() => setFilterTime(t)}
              >
                {t === 'upcoming' ? 'Prossimi' : t === 'past' ? 'Passati' : 'Tutti'}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Stats ──────────────────────────────────────────────────────── */}
      <div className="ev-stats-row">
        <StatCard label="EVENTI ATTIVI">
          <span className="ev-stat-num">{activeEvents.length}</span>
        </StatCard>

        <StatCard label="ISCRIZIONI TOTALI">
          <div className="ev-stat-frac">
            <span className="ev-stat-num">{totalRegistrations}</span>
            <span className="ev-stat-denom">/ {totalCapacity}</span>
          </div>
          <div className="ev-stat-bar">
            <div className="ev-stat-bar-fill ev-stat-bar-fill--accent"
                 style={{ width: `${Math.min(100, regRatio * 100)}%` }} />
          </div>
        </StatCard>

        <StatCard label="INCASSO EVENTI">
          <div className="ev-stat-frac">
            <span className="ev-stat-num">{Math.round(totalRevenue)}</span>
            <span className="ev-stat-euro">€</span>
          </div>
        </StatCard>

        <StatCard label="PROSSIMO EVENTO">
          {nextEvent ? (
            <>
              <p className="ev-stat-next-when">{daysUntilText(nextEvent.date)}</p>
              <p className="ev-stat-next-date">{formatDateShort(nextEvent.date, nextEvent.time)}</p>
            </>
          ) : (
            <p className="ev-stat-none">Nessun evento in programma</p>
          )}
        </StatCard>
      </div>

      {/* ── Events grid ────────────────────────────────────────────────── */}
      {filteredEvents.length === 0 ? (
        <div className="ev-empty">
          <Leaf size={48} className="ev-empty-icon" />
          <p className="ev-empty-title">
            {events.length === 0 ? 'Nessun evento ancora' : 'Nessun evento corrisponde ai filtri'}
          </p>
          {events.length === 0 && (
            <button className="ev-btn-new ev-empty-cta"
              onClick={() => { setEditingEvent(null); setShowForm(true) }}>
              <Plus size={16} /> Crea il primo evento
            </button>
          )}
        </div>
      ) : (
        <div className="ev-grid">
          {filteredEvents.map(ev => (
            <EventCard
              key={ev.id}
              event={ev}
              onEdit={() => { setEditingEvent(ev); setShowForm(true) }}
              onDelete={() => setDeleteId(ev.id)}
              onDetails={() => setDetailsEvent(ev)}
              onRegistrations={() => setRegsEvent(ev)}
            />
          ))}
        </div>
      )}

      {/* ── Modals ─────────────────────────────────────────────────────── */}
      {showForm && (
        <EventFormModal
          initial={editingEvent}
          onClose={() => { setShowForm(false); setEditingEvent(null) }}
          onSave={handleSave}
        />
      )}

      {detailsEvent && (
        <DetailsModal event={detailsEvent} onClose={() => setDetailsEvent(null)} />
      )}

      {regsEvent && (
        <RegistrationsModal event={regsEvent} onClose={() => setRegsEvent(null)} />
      )}

      {deleteId && (
        <div className="ev-overlay" onClick={e => { if (e.target === e.currentTarget) setDeleteId(null) }}>
          <div className="ev-modal ev-modal--sm">
            <div className="ev-modal-head">
              <h2 className="ev-modal-title">Elimina evento</h2>
              <button className="ev-modal-close" onClick={() => setDeleteId(null)}><X size={18} /></button>
            </div>
            <div className="ev-modal-body">
              <p className="ev-delete-msg">
                Sei sicuro di voler eliminare questo evento?<br />
                Tutte le iscrizioni verranno rimosse.
              </p>
              <div className="ev-modal-foot">
                <button className="ev-btn-danger" onClick={() => void confirmDelete(deleteId)}>Elimina</button>
                <button className="ev-btn-cancel" onClick={() => setDeleteId(null)}>Annulla</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

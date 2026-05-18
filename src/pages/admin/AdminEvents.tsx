import { useState, type ChangeEvent } from 'react'
import { useApp } from '../../context/AppContext'
import { supabase } from '../../lib/supabase'
import type { YogaEvent, EventFormData } from '../../types'
import './AdminEvents.css'

const emptyForm: EventFormData = {
  title: '', description: '', date: '', time: '',
  location: '', price: '', notes: '', imageUrl: '', maxParticipants: 20,
}

function formatDateLong(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number)
  return new Date(year, month - 1, day).toLocaleDateString('it-IT', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })
}

export default function AdminEvents() {
  const { events, addEvent, updateEvent, deleteEvent } = useApp()
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<EventFormData>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string>('')

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const sorted = [...events].sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time))

  function openNew() {
    setEditingId(null)
    setForm(emptyForm)
    setImageFile(null)
    setImagePreview('')
    setShowForm(true)
  }

  function openEdit(ev: YogaEvent) {
    setEditingId(ev.id)
    setForm({
      title: ev.title, description: ev.description, date: ev.date, time: ev.time,
      location: ev.location, price: ev.price, notes: ev.notes, imageUrl: ev.imageUrl, maxParticipants: ev.maxParticipants,
    })
    setImageFile(null)
    setImagePreview(ev.imageUrl)
    setShowForm(true)
    setDeleteConfirm(null)
  }

  function closeForm() {
    setShowForm(false)
    setEditingId(null)
    setForm(emptyForm)
    setImageFile(null)
    setImagePreview('')
  }

  function handleImageChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setImageFile(file)
    setImagePreview(URL.createObjectURL(file))
  }

  function update(field: keyof EventFormData, value: string | number) {
    setForm(prev => ({ ...prev, [field]: value }))
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
    const formWithImage = { ...form, imageUrl }
    if (editingId) {
      await updateEvent(editingId, formWithImage)
    } else {
      await addEvent(formWithImage)
    }
    setSaving(false)
    closeForm()
  }

  async function handleDelete(id: string) {
    if (deleteConfirm === id) {
      await deleteEvent(id)
      setDeleteConfirm(null)
    } else {
      setDeleteConfirm(id)
    }
  }

  return (
    <div className="events-admin-page">
      <div className="events-admin-header">
        <div>
          <h1 className="events-admin-title">Eventi</h1>
          <p className="events-admin-subtitle">{events.length} {events.length === 1 ? 'evento' : 'eventi'} totali</p>
        </div>
        <button className="btn-new-event" onClick={openNew}>+ Nuovo evento</button>
      </div>

      {showForm && (
        <form className="event-form-panel" onSubmit={handleSubmit}>
          <h2 className="event-form-title">{editingId ? 'Modifica evento' : 'Nuovo evento'}</h2>
          <div className="event-form-grid">
            <div className="form-field event-form-full">
              <label className="form-label">Titolo *</label>
              <input type="text" required placeholder="Es. Workshop di meditazione"
                value={form.title} onChange={e => update('title', e.target.value)} />
            </div>
            <div className="form-field">
              <label className="form-label">Data *</label>
              <input type="date" required value={form.date} onChange={e => update('date', e.target.value)} />
            </div>
            <div className="form-field">
              <label className="form-label">Orario *</label>
              <input type="time" required value={form.time} onChange={e => update('time', e.target.value)} />
            </div>
            <div className="form-field">
              <label className="form-label">Max partecipanti *</label>
              <input type="number" required min={1} value={form.maxParticipants}
                onChange={e => update('maxParticipants', parseInt(e.target.value, 10) || 1)} />
            </div>
            <div className="form-field">
              <label className="form-label">Prezzo</label>
              <input type="text" placeholder="Es. €30 · Gratuito"
                value={form.price} onChange={e => update('price', e.target.value)} />
            </div>
            <div className="form-field event-form-full">
              <label className="form-label">Luogo</label>
              <input type="text" placeholder="Es. Studio Yoga Milano"
                value={form.location} onChange={e => update('location', e.target.value)} />
            </div>
            <div className="form-field event-form-full">
              <label className="form-label">Descrizione</label>
              <textarea rows={3} placeholder="Descrivi l'evento…"
                value={form.description} onChange={e => update('description', e.target.value)} />
            </div>
            <div className="form-field event-form-full">
              <label className="form-label">Note</label>
              <textarea rows={2} placeholder="Informazioni aggiuntive…"
                value={form.notes} onChange={e => update('notes', e.target.value)} />
            </div>
            <div className="form-field event-form-full">
              <label className="form-label">Immagine (opzionale)</label>
              {imagePreview && (
                <div className="form-image-preview-wrap">
                  <img src={imagePreview} className="form-image-preview" alt="" />
                  <button type="button" className="btn-remove-image" onClick={() => {
                    setImageFile(null); setImagePreview(''); update('imageUrl', '')
                  }}>Rimuovi</button>
                </div>
              )}
              <label className="btn-upload-image">
                {imagePreview ? 'Cambia immagine' : '+ Carica immagine'}
                <input type="file" accept="image/jpeg,image/png,image/webp" onChange={handleImageChange} style={{ display: 'none' }} />
              </label>
              <p className="form-hint">JPG o WebP · consigliato <strong>1280 × 720 px</strong> · max 2 MB</p>
            </div>
          </div>
          <div className="event-form-actions">
            <button type="submit" className="btn-save-event" disabled={saving}>
              {saving ? (imageFile ? 'Caricamento immagine…' : 'Salvataggio…') : editingId ? 'Salva modifiche' : 'Crea evento'}
            </button>
            <button type="button" className="btn-cancel-event" onClick={closeForm}>Annulla</button>
          </div>
        </form>
      )}

      {sorted.length === 0 ? (
        <div className="events-empty-state">
          <p className="events-empty-title">Nessun evento creato</p>
          <p className="events-empty-sub">Clicca su "+ Nuovo evento" per aggiungerne uno.</p>
        </div>
      ) : (
        <div className="events-list">
          {sorted.map(ev => {
            const [y, m, d] = ev.date.split('-').map(Number)
            const isPast = new Date(y, m - 1, d) < today
            const isFull = ev.bookings.length >= ev.maxParticipants
            const fillPct = ev.maxParticipants > 0
              ? Math.round((ev.bookings.length / ev.maxParticipants) * 100)
              : 0
            return (
              <div key={ev.id} className={`event-card ${isPast ? 'event-card--past' : ''}`}>
                {ev.imageUrl && <img src={ev.imageUrl} className="event-admin-img-thumb" alt="" />}
                <div className="event-card__inner">
                <div className="event-card__body">
                  <div className="event-card__top">
                    {isPast && <span className="event-badge-past">Passato</span>}
                    {isFull && !isPast && <span className="event-badge-full">Al completo</span>}
                    {ev.price && <span className="event-badge-price">{ev.price}</span>}
                  </div>
                  <h2 className="event-card__title">{ev.title}</h2>
                  <p className="event-card__date">{formatDateLong(ev.date)} · {ev.time}</p>
                  {ev.location && <p className="event-card__location">📍 {ev.location}</p>}
                  {ev.description && <p className="event-card__desc">{ev.description}</p>}
                  {ev.notes && <p className="event-card__notes">{ev.notes}</p>}
                  <div className="event-card__fill">
                    <span className="event-card__fill-count">{ev.bookings.length} / {ev.maxParticipants} iscritti</span>
                    <div className="event-fill-bar">
                      <div className="event-fill-bar__inner"
                        style={{ width: `${fillPct}%`, background: isFull ? '#8b4a48' : 'var(--color-green)' }} />
                    </div>
                    {ev.waitlist.length > 0 && (
                      <span className="event-card__waitlist-count">+{ev.waitlist.length} in lista d'attesa</span>
                    )}
                  </div>
                </div>
                <div className="event-card__actions">
                  <button className="btn-edit-event" onClick={() => openEdit(ev)}>Modifica</button>
                  {deleteConfirm === ev.id ? (
                    <>
                      <button className="btn-confirm-delete-sm" onClick={() => { void handleDelete(ev.id) }}>Conferma</button>
                      <button className="btn-cancel-xs" onClick={() => setDeleteConfirm(null)}>No</button>
                    </>
                  ) : (
                    <button className="btn-danger" onClick={() => setDeleteConfirm(ev.id)}>Elimina</button>
                  )}
                </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

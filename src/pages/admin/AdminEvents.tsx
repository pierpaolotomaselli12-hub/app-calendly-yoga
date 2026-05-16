import { useState } from 'react'
import { useApp } from '../../context/AppContext'
import type { YogaEvent } from '../../types'
import './AdminEvents.css'

type FormData = Omit<YogaEvent, 'id' | 'createdAt'>

const emptyForm: FormData = {
  title: '',
  description: '',
  date: '',
  time: '',
  location: '',
  price: '',
  notes: '',
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
  const [form, setForm] = useState<FormData>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const sorted = [...events].sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time))

  function openNew() {
    setEditingId(null)
    setForm(emptyForm)
    setShowForm(true)
  }

  function openEdit(ev: YogaEvent) {
    setEditingId(ev.id)
    setForm({
      title: ev.title,
      description: ev.description,
      date: ev.date,
      time: ev.time,
      location: ev.location,
      price: ev.price,
      notes: ev.notes,
    })
    setShowForm(true)
    setDeleteConfirm(null)
  }

  function closeForm() {
    setShowForm(false)
    setEditingId(null)
    setForm(emptyForm)
  }

  function update(field: keyof FormData, value: string) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    if (editingId) {
      await updateEvent(editingId, form)
    } else {
      await addEvent(form)
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
              <input
                type="text" required placeholder="Es. Workshop di meditazione"
                value={form.title}
                onChange={e => update('title', e.target.value)}
              />
            </div>
            <div className="form-field">
              <label className="form-label">Data *</label>
              <input
                type="date" required
                value={form.date}
                onChange={e => update('date', e.target.value)}
              />
            </div>
            <div className="form-field">
              <label className="form-label">Orario *</label>
              <input
                type="time" required
                value={form.time}
                onChange={e => update('time', e.target.value)}
              />
            </div>
            <div className="form-field">
              <label className="form-label">Luogo</label>
              <input
                type="text" placeholder="Es. Studio Yoga Milano"
                value={form.location}
                onChange={e => update('location', e.target.value)}
              />
            </div>
            <div className="form-field">
              <label className="form-label">Prezzo</label>
              <input
                type="text" placeholder="Es. €30 · Gratuito"
                value={form.price}
                onChange={e => update('price', e.target.value)}
              />
            </div>
            <div className="form-field event-form-full">
              <label className="form-label">Descrizione</label>
              <textarea
                rows={3} placeholder="Descrivi l'evento…"
                value={form.description}
                onChange={e => update('description', e.target.value)}
              />
            </div>
            <div className="form-field event-form-full">
              <label className="form-label">Note</label>
              <textarea
                rows={2} placeholder="Informazioni aggiuntive…"
                value={form.notes}
                onChange={e => update('notes', e.target.value)}
              />
            </div>
          </div>
          <div className="event-form-actions">
            <button type="submit" className="btn-save-event" disabled={saving}>
              {saving ? 'Salvataggio…' : editingId ? 'Salva modifiche' : 'Crea evento'}
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
            return (
              <div key={ev.id} className={`event-card ${isPast ? 'event-card--past' : ''}`}>
                <div className="event-card__body">
                  <div className="event-card__top">
                    {isPast && <span className="event-badge-past">Passato</span>}
                    {ev.price && <span className="event-badge-price">{ev.price}</span>}
                  </div>
                  <h2 className="event-card__title">{ev.title}</h2>
                  <p className="event-card__date">{formatDateLong(ev.date)} · {ev.time}</p>
                  {ev.location && <p className="event-card__location">📍 {ev.location}</p>}
                  {ev.description && <p className="event-card__desc">{ev.description}</p>}
                  {ev.notes && <p className="event-card__notes">{ev.notes}</p>}
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
            )
          })}
        </div>
      )}
    </div>
  )
}

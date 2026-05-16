import { useState, type FormEvent } from 'react'
import { useApp } from '../../context/AppContext'
import type { Slot } from '../../types'
import './AdminSlots.css'

interface SlotForm {
  title: string
  date: string
  time: string
  duration: string
  maxParticipants: string
  notes: string
}

const emptyForm: SlotForm = {
  title: '',
  date: '',
  time: '',
  duration: '60',
  maxParticipants: '10',
  notes: '',
}

function formatDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-')
  return `${d}/${m}/${y}`
}

export default function AdminSlots() {
  const { slots, addSlot, deleteSlot } = useApp()
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<SlotForm>(emptyForm)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  const sortedSlots = [...slots].sort((a, b) => {
    const cmp = b.date.localeCompare(a.date)
    return cmp !== 0 ? cmp : b.time.localeCompare(a.time)
  })

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    addSlot({
      title: form.title.trim(),
      date: form.date,
      time: form.time,
      duration: Number(form.duration),
      maxParticipants: Number(form.maxParticipants),
      notes: form.notes.trim(),
    })
    setForm(emptyForm)
    setShowForm(false)
  }

  function handleDelete(slot: Slot) {
    if (deleteConfirm === slot.id) {
      deleteSlot(slot.id)
      setDeleteConfirm(null)
    } else {
      setDeleteConfirm(slot.id)
    }
  }

  return (
    <div className="slots-page">
      <div className="slots-header">
        <h1 className="slots-title">Lezioni</h1>
        {!showForm && (
          <button className="btn-primary" onClick={() => setShowForm(true)}>
            + Nuova Lezione
          </button>
        )}
      </div>

      {showForm && (
        <form className="slot-form" onSubmit={handleSubmit}>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Titolo</label>
              <input
                name="title"
                value={form.title}
                onChange={handleChange}
                required
                placeholder="es. Hatha Yoga"
              />
            </div>
          </div>
          <div className="form-row form-row--3">
            <div className="form-group">
              <label className="form-label">Data</label>
              <input
                type="date"
                name="date"
                value={form.date}
                onChange={handleChange}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Ora</label>
              <input
                type="time"
                name="time"
                value={form.time}
                onChange={handleChange}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Durata (minuti)</label>
              <input
                type="number"
                name="duration"
                value={form.duration}
                onChange={handleChange}
                min={15}
                required
              />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group form-group--half">
              <label className="form-label">Max partecipanti</label>
              <input
                type="number"
                name="maxParticipants"
                value={form.maxParticipants}
                onChange={handleChange}
                min={1}
                required
              />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Note (opzionale)</label>
              <textarea
                name="notes"
                value={form.notes}
                onChange={handleChange}
                rows={3}
                placeholder="Informazioni aggiuntive per gli studenti…"
              />
            </div>
          </div>
          <div className="form-actions">
            <button type="submit" className="btn-primary">
              Salva Lezione
            </button>
            <button
              type="button"
              className="btn-cancel"
              onClick={() => { setShowForm(false); setForm(emptyForm) }}
            >
              Annulla
            </button>
          </div>
        </form>
      )}

      {sortedSlots.length === 0 ? (
        <div className="slots-empty">
          <p>Nessuna lezione creata.</p>
          <p className="slots-empty-sub">Crea la tua prima lezione usando il pulsante qui sopra.</p>
        </div>
      ) : (
        <div className="slots-list">
          {sortedSlots.map(slot => (
            <div key={slot.id} className="slot-card">
              <div className="slot-main">
                <div className="slot-info">
                  <span className="slot-name">{slot.title}</span>
                  <span className="slot-date">
                    {formatDate(slot.date)} &middot; {slot.time} &middot; {slot.duration} min
                  </span>
                  {slot.notes && (
                    <span className="slot-notes">{slot.notes}</span>
                  )}
                </div>
                <div className="slot-right">
                  <div className="slot-capacity">
                    <span className="capacity-booked">{slot.bookings.length}</span>
                    <span className="capacity-sep">/</span>
                    <span className="capacity-max">{slot.maxParticipants}</span>
                  </div>
                  <div className="slot-actions">
                    {deleteConfirm === slot.id ? (
                      <>
                        <button
                          className="btn-confirm-delete"
                          onClick={() => handleDelete(slot)}
                        >
                          Conferma
                        </button>
                        <button
                          className="btn-cancel-small"
                          onClick={() => setDeleteConfirm(null)}
                        >
                          Annulla
                        </button>
                      </>
                    ) : (
                      <button
                        className="btn-danger"
                        onClick={() => handleDelete(slot)}
                      >
                        Elimina
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

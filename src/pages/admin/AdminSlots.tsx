import { useState, type FormEvent, type ChangeEvent } from 'react'
import { useApp } from '../../context/AppContext'
import { supabase } from '../../lib/supabase'
import type { Slot } from '../../types'
import './AdminSlots.css'

interface SlotForm {
  title: string
  type: string
  date: string
  time: string
  duration: string
  maxParticipants: string
  notes: string
  imageUrl: string
}

const emptyForm: SlotForm = {
  title: '',
  type: '',
  date: '',
  time: '',
  duration: '60',
  maxParticipants: '10',
  notes: '',
  imageUrl: '',
}

const TYPE_OPTIONS = ['Hatha', 'Vinyasa', 'Yin', 'Restorative', 'Pranayama', 'Altro']

function formatDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-')
  return `${d}/${m}/${y}`
}

function todayStr(): string {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

type StatusBadge = 'available' | 'full' | 'past'

function getStatus(slot: Slot): StatusBadge {
  const today = todayStr()
  if (slot.date < today) return 'past'
  if (slot.bookings.length >= slot.maxParticipants) return 'full'
  return 'available'
}

const STATUS_LABELS: Record<StatusBadge, string> = {
  available: 'Disponibile',
  full: 'Al completo',
  past: 'Passata',
}

type Tab = 'upcoming' | 'past'

export default function AdminSlots() {
  const { slots, addSlot, deleteSlot, updateSlot, duplicateSlot, deleteBooking, waitlist, students, addBooking, decrementStudentCredits } = useApp()
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<SlotForm>(emptyForm)
  const [editingSlot, setEditingSlot] = useState<Slot | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<Tab>('upcoming')
  const [expandedSlot, setExpandedSlot] = useState<string | null>(null)
  const [duplicatingSlot, setDuplicatingSlot] = useState<string | null>(null)
  const [duplicateDate, setDuplicateDate] = useState<string>('')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string>('')
  const [imageUploading, setImageUploading] = useState(false)
  const [addStudentId, setAddStudentId] = useState<string>('')
  const [addingStudent, setAddingStudent] = useState(false)
  const [studentSearch, setStudentSearch] = useState<string>('')
  const [showStudentDropdown, setShowStudentDropdown] = useState(false)

  const today = todayStr()

  const filteredSlots = slots
    .filter(s => activeTab === 'upcoming' ? s.date >= today : s.date < today)
    .sort((a, b) => {
      const cmp = a.date.localeCompare(b.date)
      if (activeTab === 'upcoming') return cmp !== 0 ? cmp : a.time.localeCompare(b.time)
      return cmp !== 0 ? -cmp : -a.time.localeCompare(b.time)
    })

  function handleChange(e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }

  function openCreate() {
    setEditingSlot(null)
    setForm(emptyForm)
    setImageFile(null)
    setImagePreview('')
    setShowForm(true)
  }

  function openEdit(slot: Slot) {
    setEditingSlot(slot)
    setForm({
      title: slot.title,
      type: slot.type,
      date: slot.date,
      time: slot.time,
      duration: String(slot.duration),
      maxParticipants: String(slot.maxParticipants),
      notes: slot.notes,
      imageUrl: slot.imageUrl,
    })
    setImageFile(null)
    setImagePreview(slot.imageUrl)
    setShowForm(true)
    setDeleteConfirm(null)
    setExpandedSlot(null)
    setDuplicatingSlot(null)
  }

  function closeForm() {
    setShowForm(false)
    setForm(emptyForm)
    setEditingSlot(null)
    setImageFile(null)
    setImagePreview('')
  }

  function handleImageChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setImageFile(file)
    setImagePreview(URL.createObjectURL(file))
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setImageUploading(true)
    let imageUrl = form.imageUrl
    try {
      if (imageFile) {
        const ext = imageFile.name.split('.').pop() ?? 'jpg'
        const path = `slots/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
        const { error } = await supabase.storage.from('images').upload(path, imageFile)
        if (!error) imageUrl = supabase.storage.from('images').getPublicUrl(path).data.publicUrl
      }
    } catch { /* keep existing URL */ }
    setImageUploading(false)
    const data = {
      title: form.title.trim(),
      type: form.type,
      date: form.date,
      time: form.time,
      duration: Number(form.duration),
      maxParticipants: Number(form.maxParticipants),
      notes: form.notes.trim(),
      imageUrl,
    }
    if (editingSlot) {
      await updateSlot(editingSlot.id, data)
    } else {
      await addSlot(data)
    }
    closeForm()
  }

  async function handleDelete(slot: Slot) {
    if (deleteConfirm === slot.id) {
      await deleteSlot(slot.id)
      setDeleteConfirm(null)
      if (expandedSlot === slot.id) setExpandedSlot(null)
    } else {
      setDeleteConfirm(slot.id)
    }
  }

  function toggleExpanded(id: string) {
    setExpandedSlot(prev => (prev === id ? null : id))
    setStudentSearch('')
    setAddStudentId('')
    setShowStudentDropdown(false)
  }

  function startDuplicate(id: string) {
    setDuplicatingSlot(id)
    setDuplicateDate('')
    setDeleteConfirm(null)
  }

  async function confirmDuplicate(id: string) {
    if (!duplicateDate) return
    await duplicateSlot(id, duplicateDate)
    setDuplicatingSlot(null)
    setDuplicateDate('')
  }

  function cancelDuplicate() {
    setDuplicatingSlot(null)
    setDuplicateDate('')
  }

  async function handleAddStudent(slotId: string) {
    const student = students.find(s => s.id === addStudentId)
    if (!student) return
    setAddingStudent(true)
    await addBooking({ slotId, firstName: student.firstName, lastName: student.lastName, email: student.email, phone: student.phone })
    if (student.lessonCredits > 0) await decrementStudentCredits(student.id)
    setAddStudentId('')
    setStudentSearch('')
    setAddingStudent(false)
  }

  return (
    <div className="slots-page">
      <div className="slots-header">
        <h1 className="slots-title">Lezioni</h1>
        {!showForm && (
          <button className="btn-primary" onClick={openCreate}>
            + Nuova Lezione
          </button>
        )}
      </div>

      {showForm && (
        <form className="slot-form" onSubmit={handleSubmit}>
          <div className="form-row form-row--2">
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
            <div className="form-group">
              <label className="form-label">Tipo di lezione</label>
              <select name="type" value={form.type} onChange={handleChange} required>
                <option value="">Seleziona tipo…</option>
                {TYPE_OPTIONS.map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
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
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Immagine (opzionale)</label>
              {imagePreview && (
                <div className="form-image-preview-wrap">
                  <img src={imagePreview} className="form-image-preview" alt="" />
                  <button type="button" className="btn-remove-image" onClick={() => {
                    setImageFile(null); setImagePreview(''); setForm(p => ({ ...p, imageUrl: '' }))
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
          <div className="form-actions">
            <button type="submit" className="btn-primary" disabled={imageUploading}>
              {imageUploading ? 'Caricamento immagine…' : editingSlot ? 'Aggiorna Lezione' : 'Salva Lezione'}
            </button>
            <button type="button" className="btn-cancel" onClick={closeForm}>
              Annulla
            </button>
          </div>
        </form>
      )}

      <div className="slot-tabs">
        <button
          className={`slot-tab${activeTab === 'upcoming' ? ' slot-tab--active' : ''}`}
          onClick={() => setActiveTab('upcoming')}
        >
          Prossime
        </button>
        <button
          className={`slot-tab${activeTab === 'past' ? ' slot-tab--active' : ''}`}
          onClick={() => setActiveTab('past')}
        >
          Passate
        </button>
      </div>

      {filteredSlots.length === 0 ? (
        <div className="slots-empty">
          <p>{activeTab === 'upcoming' ? 'Nessuna lezione in programma.' : 'Nessuna lezione passata.'}</p>
          {activeTab === 'upcoming' && (
            <p className="slots-empty-sub">Crea la tua prima lezione usando il pulsante qui sopra.</p>
          )}
        </div>
      ) : (
        <div className="slots-list">
          {filteredSlots.map(slot => {
            const status = getStatus(slot)
            const isExpanded = expandedSlot === slot.id
            const isDuplicating = duplicatingSlot === slot.id

            return (
              <div key={slot.id} className="slot-card">
                <div className="slot-main">
                  {slot.imageUrl && <img src={slot.imageUrl} className="slot-img-thumb" alt="" />}
                  <div className="slot-info">
                    <div className="slot-name-row">
                      <span className="slot-name">{slot.title}</span>
                      {slot.type && (
                        <span className="slot-type-badge">{slot.type}</span>
                      )}
                      <span className={`slot-status-badge badge--${status}`}>
                        {STATUS_LABELS[status]}
                      </span>
                    </div>
                    <span className="slot-date">
                      {formatDate(slot.date)} &middot; {slot.time} &middot; {slot.duration} min
                    </span>
                    {slot.notes && (
                      <span className="slot-notes">{slot.notes}</span>
                    )}
                    <div className="slot-secondary-actions">
                      <button
                        className="btn-text"
                        onClick={() => toggleExpanded(slot.id)}
                      >
                        Vedi studenti ({slot.bookings.length})
                      </button>
                      <button
                        className="btn-text"
                        onClick={() => openEdit(slot)}
                      >
                        Modifica
                      </button>
                      <button
                        className="btn-text"
                        onClick={() => startDuplicate(slot.id)}
                      >
                        Duplica
                      </button>
                    </div>
                  </div>
                  <div className="slot-right">
                    <div className="slot-capacity">
                      <span className="capacity-booked">{slot.bookings.length}</span>
                      <span className="capacity-sep">/</span>
                      <span className="capacity-max">{slot.maxParticipants}</span>
                      {waitlist.filter(w => w.slotId === slot.id).length > 0 && (
                        <span className="capacity-waitlist">
                          &middot; {waitlist.filter(w => w.slotId === slot.id).length} in attesa
                        </span>
                      )}
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

                {isDuplicating && (
                  <div className="slot-duplicate-panel">
                    <span className="duplicate-label">Nuova data per la copia:</span>
                    <input
                      type="date"
                      value={duplicateDate}
                      onChange={e => setDuplicateDate(e.target.value)}
                    />
                    <button
                      className="btn-primary btn-sm"
                      onClick={() => confirmDuplicate(slot.id)}
                      disabled={!duplicateDate}
                    >
                      Conferma
                    </button>
                    <button className="btn-cancel-small" onClick={cancelDuplicate}>
                      Annulla
                    </button>
                  </div>
                )}

                {isExpanded && (
                  <div className="slot-students-panel">
                    {slot.bookings.length === 0 ? (
                      <p className="students-empty">Nessuno studente iscritto.</p>
                    ) : (
                      <ul className="students-list">
                        {slot.bookings.map(b => (
                          <li key={b.id} className="student-row">
                            <div className="student-info">
                              <span className="student-name">{b.firstName} {b.lastName}</span>
                              <span className="student-contact">{b.email}{b.phone ? ` · ${b.phone}` : ''}</span>
                            </div>
                            <button
                              className="btn-text btn-text--danger"
                              onClick={() => { void deleteBooking(slot.id, b.id) }}
                            >
                              Rimuovi
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                    {(() => {
                      const bookedIds = new Set(slot.bookings.map(b => b.email))
                      const available = students.filter(s => !bookedIds.has(s.email) && s.lessonCredits >= 1)
                      return (
                        <div className="add-student-row">
                          <span className="add-student-label">Aggiungi studente</span>
                          <div className="add-student-controls">
                            <div className="student-search-wrap">
                              <input
                                type="text"
                                className="student-search-input"
                                placeholder="Cerca per nome o email…"
                                autoComplete="off"
                                value={studentSearch}
                                onChange={e => {
                                  setStudentSearch(e.target.value)
                                  setAddStudentId('')
                                  setShowStudentDropdown(true)
                                }}
                                onFocus={() => setShowStudentDropdown(true)}
                                onBlur={() => setTimeout(() => setShowStudentDropdown(false), 150)}
                              />
                              {showStudentDropdown && studentSearch.length > 0 && (() => {
                                const filtered = available.filter(s =>
                                  `${s.firstName} ${s.lastName} ${s.email}`.toLowerCase().includes(studentSearch.toLowerCase())
                                )
                                return filtered.length > 0 ? (
                                  <ul className="student-search-dropdown">
                                    {filtered.slice(0, 8).map(s => (
                                      <li
                                        key={s.id}
                                        className="student-search-option"
                                        onMouseDown={() => {
                                          setAddStudentId(s.id)
                                          setStudentSearch(`${s.firstName} ${s.lastName}`)
                                          setShowStudentDropdown(false)
                                        }}
                                      >
                                        <span className="student-search-name">{s.firstName} {s.lastName}</span>
                                        <span className="student-search-meta">{s.email} · {s.lessonCredits > 0 ? `${s.lessonCredits} crediti` : 'nessun credito'}</span>
                                      </li>
                                    ))}
                                  </ul>
                                ) : (
                                  <div className="student-search-empty">Nessuno studente trovato</div>
                                )
                              })()}
                            </div>
                            <button
                              className="btn-primary btn-sm"
                              disabled={!addStudentId || addingStudent}
                              onClick={() => handleAddStudent(slot.id)}
                            >
                              {addingStudent ? '…' : 'Aggiungi'}
                            </button>
                          </div>
                          {slot.bookings.length >= slot.maxParticipants && (
                            <p className="add-student-warning">La lezione è al completo — l'aggiunta manuale supererà il limite.</p>
                          )}
                        </div>
                      )
                    })()}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

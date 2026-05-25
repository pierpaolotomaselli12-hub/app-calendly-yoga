import { useState, type FormEvent, type ChangeEvent } from 'react'
import { useApp } from '../../context/AppContext'
import { supabase } from '../../lib/supabase'
import type { Slot } from '../../types'
import './AdminSlots.css'

// ── Form & type helpers ───────────────────────────────

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

function todayStr(): string {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

// ── Date display helpers ──────────────────────────────

const MONTH_SHORT = ['GEN', 'FEB', 'MAR', 'APR', 'MAG', 'GIU', 'LUG', 'AGO', 'SET', 'OTT', 'NOV', 'DIC']
const DAY_SHORT   = ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab']

function parseDateParts(dateStr: string) {
  const [y, m, d] = dateStr.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  return { dayNum: d, month: MONTH_SHORT[m - 1], dayName: DAY_SHORT[date.getDay()] }
}

// ── Avatar helpers ────────────────────────────────────

const AVATAR_COLORS = ['#818569', '#8b4a48', '#c17f3b', '#5c6148', '#9a8878', '#6e7258', '#b0906e']

function avatarColor(name: string): string {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffff
  return AVATAR_COLORS[h % AVATAR_COLORS.length]
}

function initials(first: string, last: string): string {
  return `${first[0] ?? ''}${last[0] ?? ''}`.toUpperCase()
}

// ── Fill rate ─────────────────────────────────────────

function slotFillRate(slot: Slot): number {
  return Math.min(Math.round((slot.bookings.length / Math.max(slot.maxParticipants, 1)) * 100), 100)
}

function fillBarColor(rate: number): string {
  if (rate >= 100) return '#8b4a48'
  if (rate >= 70)  return '#c17f3b'
  return '#818569'
}

type Tab = 'upcoming' | 'past'

// ── Component ─────────────────────────────────────────

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

  const upcomingCount = slots.filter(s => s.date >= today).length
  const pastCount = slots.filter(s => s.date < today).length

  const filteredSlots = slots
    .filter(s => activeTab === 'upcoming' ? s.date >= today : s.date < today)
    .sort((a, b) => {
      const cmp = a.date.localeCompare(b.date)
      if (activeTab === 'upcoming') return cmp !== 0 ? cmp : a.time.localeCompare(b.time)
      return cmp !== 0 ? -cmp : -a.time.localeCompare(b.time)
    })

  // ── Form handlers ─────────────────────────────────

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
      setExpandedSlot(null)
      setDuplicatingSlot(null)
    }
  }

  function toggleExpanded(id: string) {
    setExpandedSlot(prev => (prev === id ? null : id))
    setStudentSearch('')
    setAddStudentId('')
    setShowStudentDropdown(false)
    setDeleteConfirm(null)
  }

  function startDuplicate(id: string) {
    setDuplicatingSlot(prev => (prev === id ? null : id))
    setDuplicateDate('')
    setDeleteConfirm(null)
    setExpandedSlot(null)
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

  // ── Render ───────────────────────────────────────

  return (
    <div className="slots-page">

      {/* Header */}
      <div className="slots-header">
        <div className="slots-header-left">
          <h1 className="slots-title">Lezioni</h1>
          <p className="slots-subtitle">
            {upcomingCount} {upcomingCount === 1 ? 'prossima' : 'prossime'} · {pastCount} {pastCount === 1 ? 'passata' : 'passate'}
          </p>
        </div>
        <div className="slots-header-right">
          <div className="slots-view-toggle">
            <button className="view-btn view-btn--active">Lista</button>
            <button className="view-btn">Settimana</button>
          </div>
          <button className="btn-filtri">
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6">
              <path d="M2 4h12M5 8h6M7 12h2" />
            </svg>
            Filtri
          </button>
          {!showForm && (
            <button className="btn-primary slots-new-btn" onClick={openCreate}>
              + Nuova lezione
            </button>
          )}
        </div>
      </div>

      {/* Create/Edit Form */}
      {showForm && (
        <form className="slot-form" onSubmit={handleSubmit}>
          <div className="form-row form-row--2">
            <div className="form-group">
              <label className="form-label">Titolo</label>
              <input name="title" value={form.title} onChange={handleChange} required placeholder="es. Hatha Yoga" />
            </div>
            <div className="form-group">
              <label className="form-label">Tipo di lezione</label>
              <select name="type" value={form.type} onChange={handleChange} required>
                <option value="">Seleziona tipo…</option>
                {TYPE_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>
          <div className="form-row form-row--3">
            <div className="form-group">
              <label className="form-label">Data</label>
              <input type="date" name="date" value={form.date} onChange={handleChange} required />
            </div>
            <div className="form-group">
              <label className="form-label">Ora</label>
              <input type="time" name="time" value={form.time} onChange={handleChange} required />
            </div>
            <div className="form-group">
              <label className="form-label">Durata (minuti)</label>
              <input type="number" name="duration" value={form.duration} onChange={handleChange} min={15} required />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group form-group--half">
              <label className="form-label">Max partecipanti</label>
              <input type="number" name="maxParticipants" value={form.maxParticipants} onChange={handleChange} min={1} required />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Note (opzionale)</label>
              <textarea name="notes" value={form.notes} onChange={handleChange} rows={3} placeholder="Informazioni aggiuntive per gli studenti…" />
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
            <button type="button" className="btn-cancel" onClick={closeForm}>Annulla</button>
          </div>
        </form>
      )}

      {/* Tabs */}
      <div className="slot-tabs">
        <button
          className={`slot-tab${activeTab === 'upcoming' ? ' slot-tab--active' : ''}`}
          onClick={() => setActiveTab('upcoming')}
        >
          Prossime
          <span className="slot-tab-badge">{upcomingCount}</span>
        </button>
        <button
          className={`slot-tab${activeTab === 'past' ? ' slot-tab--active' : ''}`}
          onClick={() => setActiveTab('past')}
        >
          Passate
          <span className="slot-tab-badge">{pastCount}</span>
        </button>
      </div>

      {/* Slot list */}
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
            const isExpanded = expandedSlot === slot.id
            const isDuplicating = duplicatingSlot === slot.id
            const isDeleteConfirm = deleteConfirm === slot.id
            const { dayNum, month, dayName } = parseDateParts(slot.date)
            const rate = slotFillRate(slot)
            const slotWaitlist = waitlist.filter(w => w.slotId === slot.id).length
            const MAX_VISIBLE_AVATARS = 4

            return (
              <div key={slot.id} className={`slot-card${activeTab === 'past' ? ' slot-card--past' : ''}`}>

                {/* Main row */}
                <div className="slot-main">

                  {/* Date block */}
                  <div className="slot-date-col">
                    <span className="slot-date-num">{dayNum}</span>
                    <span className="slot-date-month">{month}</span>
                    <span className="slot-date-day">{dayName}</span>
                  </div>

                  {/* Info block */}
                  <div className="slot-info-col">
                    <div className="slot-badges">
                      {slot.type && <span className="slot-type-pill">{slot.type}</span>}
                      {slotWaitlist > 0 && (
                        <span className="slot-waitlist-pill">{slotWaitlist} in attesa</span>
                      )}
                    </div>
                    <span className="slot-title">{slot.title}</span>
                    <div className="slot-meta">
                      <svg className="slot-meta-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <circle cx="8" cy="8" r="6" />
                        <path d="M8 5v3l2 1.2" />
                      </svg>
                      {slot.time} · {slot.duration} min · Laura P.
                    </div>
                  </div>

                  {/* Capacity block */}
                  <div className="slot-cap-col">
                    <div className="slot-cap-header">
                      <span className="slot-cap-text">{slot.bookings.length} / {slot.maxParticipants} prenotati</span>
                      <span className="slot-cap-pct">{rate}%</span>
                    </div>
                    <div className="fill-bar-wrap">
                      <div className="fill-bar" style={{ width: `${rate}%`, background: fillBarColor(rate) }} />
                    </div>
                    <div className="slot-cap-footer">
                      {/* Student avatars */}
                      <div className="slot-avatars">
                        {slot.bookings.slice(0, MAX_VISIBLE_AVATARS).map(b => (
                          <div
                            key={b.id}
                            className="slot-avatar"
                            style={{ background: avatarColor(`${b.firstName}${b.lastName}`) }}
                            title={`${b.firstName} ${b.lastName}`}
                          >
                            {initials(b.firstName, b.lastName)}
                          </div>
                        ))}
                        {slot.bookings.length > MAX_VISIBLE_AVATARS && (
                          <div className="slot-avatar slot-avatar--more">
                            +{slot.bookings.length - MAX_VISIBLE_AVATARS}
                          </div>
                        )}
                      </div>

                      {/* Icon action buttons */}
                      <div className="slot-icon-actions">
                        {/* View students */}
                        <button
                          className={`slot-icon-btn${isExpanded ? ' slot-icon-btn--active' : ''}`}
                          onClick={() => toggleExpanded(slot.id)}
                          title="Vedi studenti"
                        >
                          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                            <path d="M1 8s2.5-5 7-5 7 5 7 5-2.5 5-7 5-7-5-7-5z" />
                            <circle cx="8" cy="8" r="2" />
                          </svg>
                        </button>

                        {/* Duplicate */}
                        <button
                          className={`slot-icon-btn${isDuplicating ? ' slot-icon-btn--active' : ''}`}
                          onClick={() => startDuplicate(slot.id)}
                          title="Duplica"
                        >
                          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                            <rect x="5" y="5" width="9" height="9" rx="1.5" />
                            <path d="M2 11V2h9" />
                          </svg>
                        </button>

                        {/* Edit */}
                        <button
                          className="slot-icon-btn"
                          onClick={() => openEdit(slot)}
                          title="Modifica"
                        >
                          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                            <path d="M11 2l3 3-8 8H3v-3l8-8z" />
                          </svg>
                        </button>

                        {/* Delete */}
                        <button
                          className={`slot-icon-btn slot-icon-btn--danger${isDeleteConfirm ? ' slot-icon-btn--danger-active' : ''}`}
                          onClick={() => handleDelete(slot)}
                          title="Elimina"
                        >
                          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                            <path d="M2 4h12M5 4V2h6v2M6 7v5M10 7v5M3 4l1 9h8l1-9" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Delete confirm strip */}
                {isDeleteConfirm && (
                  <div className="slot-delete-confirm">
                    <span className="slot-delete-confirm-text">Eliminare questa lezione e tutte le sue prenotazioni?</span>
                    <button className="btn-confirm-delete" onClick={() => handleDelete(slot)}>Conferma</button>
                    <button className="btn-cancel-small" onClick={() => setDeleteConfirm(null)}>Annulla</button>
                  </div>
                )}

                {/* Duplicate panel */}
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
                    <button className="btn-cancel-small" onClick={cancelDuplicate}>Annulla</button>
                  </div>
                )}

                {/* Students panel */}
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

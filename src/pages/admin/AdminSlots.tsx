import { useState, type FormEvent, type ChangeEvent, type ReactNode } from 'react'
import { useApp } from '../../context/AppContext'
import { supabase } from '../../lib/supabase'
import type { Slot } from '../../types'
import './AdminSlots.css'

// ── Types ──────────────────────────────────────────────

interface SlotForm {
  title: string; type: string; date: string; time: string
  duration: string; maxParticipants: string; notes: string; imageUrl: string
}

const emptyForm: SlotForm = {
  title: '', type: '', date: '', time: '',
  duration: '60', maxParticipants: '10', notes: '', imageUrl: '',
}

const TYPE_OPTIONS = ['Hatha', 'Vinyasa', 'Yin', 'Restorative', 'Pranayama', 'Altro']
type Tab = 'upcoming' | 'past'
type ViewMode = 'list' | 'week'

// ── Date helpers ───────────────────────────────────────

const MONTH_SHORT = ['GEN','FEB','MAR','APR','MAG','GIU','LUG','AGO','SET','OTT','NOV','DIC']
const MONTH_LONG  = ['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno','Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre']
const DAY_SHORT   = ['Dom','Lun','Mar','Mer','Gio','Ven','Sab']
const WEEK_LABELS = ['Lun','Mar','Mer','Gio','Ven','Sab','Dom']

function todayStr(): string {
  const n = new Date()
  return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}-${String(n.getDate()).padStart(2,'0')}`
}

function parseDateParts(dateStr: string) {
  const [y, m, d] = dateStr.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  return { dayNum: d, month: MONTH_SHORT[m - 1], dayName: DAY_SHORT[date.getDay()] }
}

function getMonday(d: Date): Date {
  const day = d.getDay()
  const m = new Date(d)
  m.setDate(d.getDate() + (day === 0 ? -6 : 1 - day))
  m.setHours(0, 0, 0, 0)
  return m
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d); r.setDate(r.getDate() + n); return r
}

function toISO(d: Date): string { return d.toISOString().slice(0, 10) }

function formatWeekRange(mon: Date): string {
  const sun = addDays(mon, 6)
  if (mon.getMonth() === sun.getMonth())
    return `${mon.getDate()} – ${sun.getDate()} ${MONTH_LONG[sun.getMonth()]} ${sun.getFullYear()}`
  return `${mon.getDate()} ${MONTH_LONG[mon.getMonth()]} – ${sun.getDate()} ${MONTH_LONG[sun.getMonth()]} ${sun.getFullYear()}`
}

// ── Avatar helpers ─────────────────────────────────────

const AVATAR_COLORS = ['#818569','#8b4a48','#c17f3b','#5c6148','#9a8878','#6e7258','#b0906e']

function avatarColor(name: string): string {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffff
  return AVATAR_COLORS[h % AVATAR_COLORS.length]
}

function initials(first: string, last: string): string {
  return `${first[0] ?? ''}${last[0] ?? ''}`.toUpperCase()
}

// ── Fill rate ──────────────────────────────────────────

function slotFillRate(slot: Slot): number {
  return Math.min(Math.round((slot.bookings.length / Math.max(slot.maxParticipants, 1)) * 100), 100)
}

function fillBarColor(rate: number): string {
  if (rate >= 100) return '#8b4a48'
  if (rate >= 70) return '#c17f3b'
  return '#818569'
}

// ── SVG icons ──────────────────────────────────────────

function IconEye()  { return <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M1 8s2.5-5 7-5 7 5 7 5-2.5 5-7 5-7-5-7-5z"/><circle cx="8" cy="8" r="2"/></svg> }
function IconCopy() { return <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="5" y="5" width="9" height="9" rx="1.5"/><path d="M2 11V2h9"/></svg> }
function IconEdit() { return <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M11 2l3 3-8 8H3v-3l8-8z"/></svg> }
function IconTrash(){ return <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M2 4h12M5 4V2h6v2M6 7v5M10 7v5M3 4l1 9h8l1-9"/></svg> }

// ── Component ──────────────────────────────────────────

export default function AdminSlots() {
  const {
    slots, addSlot, deleteSlot, updateSlot, duplicateSlot,
    deleteBooking, waitlist, students, addBooking, decrementStudentCredits,
  } = useApp()

  // ── Core state ─────────────────────────────────────
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<SlotForm>(emptyForm)
  const [editingSlot, setEditingSlot] = useState<Slot | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<Tab>('upcoming')
  const [expandedSlot, setExpandedSlot] = useState<string | null>(null)
  const [duplicatingSlot, setDuplicatingSlot] = useState<string | null>(null)
  const [duplicateDate, setDuplicateDate] = useState('')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState('')
  const [imageUploading, setImageUploading] = useState(false)
  const [addStudentId, setAddStudentId] = useState('')
  const [addingStudent, setAddingStudent] = useState(false)
  const [studentSearch, setStudentSearch] = useState('')
  const [showStudentDropdown, setShowStudentDropdown] = useState(false)

  // ── View / filter state ────────────────────────────
  const [viewMode, setViewMode] = useState<ViewMode>('list')
  const [weekStart, setWeekStart] = useState<Date>(() => getMonday(new Date()))
  const [showFilters, setShowFilters] = useState(false)
  const [filterTypes, setFilterTypes] = useState<string[]>([])

  const today = todayStr()

  // ── Derived data ───────────────────────────────────
  const typeFiltered = filterTypes.length === 0
    ? slots
    : slots.filter(s => filterTypes.includes(s.type))

  const upcomingCount = slots.filter(s => s.date >= today).length
  const pastCount     = slots.filter(s => s.date < today).length

  const listSlots = typeFiltered
    .filter(s => activeTab === 'upcoming' ? s.date >= today : s.date < today)
    .sort((a, b) => {
      const cmp = a.date.localeCompare(b.date)
      if (activeTab === 'upcoming') return cmp !== 0 ? cmp : a.time.localeCompare(b.time)
      return cmp !== 0 ? -cmp : -a.time.localeCompare(b.time)
    })

  const weekDays  = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
  const weekRange = formatWeekRange(weekStart)

  // ── Handlers ───────────────────────────────────────

  function toggleFilterType(t: string) {
    setFilterTypes(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t])
  }

  function handleChange(e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }

  function openCreate() {
    setEditingSlot(null); setForm(emptyForm)
    setImageFile(null); setImagePreview(''); setShowForm(true)
  }

  function openEdit(slot: Slot) {
    setEditingSlot(slot)
    setForm({ title: slot.title, type: slot.type, date: slot.date, time: slot.time,
      duration: String(slot.duration), maxParticipants: String(slot.maxParticipants),
      notes: slot.notes, imageUrl: slot.imageUrl })
    setImageFile(null); setImagePreview(slot.imageUrl); setShowForm(true)
    setDeleteConfirm(null); setExpandedSlot(null); setDuplicatingSlot(null)
  }

  function closeForm() {
    setShowForm(false); setForm(emptyForm); setEditingSlot(null)
    setImageFile(null); setImagePreview('')
  }

  function handleImageChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setImageFile(file); setImagePreview(URL.createObjectURL(file))
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault(); setImageUploading(true)
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
      title: form.title.trim(), type: form.type, date: form.date, time: form.time,
      duration: Number(form.duration), maxParticipants: Number(form.maxParticipants),
      notes: form.notes.trim(), imageUrl,
    }
    if (editingSlot) await updateSlot(editingSlot.id, data)
    else await addSlot(data)
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
    setExpandedSlot(prev => prev === id ? null : id)
    setStudentSearch(''); setAddStudentId(''); setShowStudentDropdown(false)
    setDeleteConfirm(null); setDuplicatingSlot(null)
  }

  function startDuplicate(id: string) {
    setDuplicatingSlot(prev => prev === id ? null : id)
    setDuplicateDate(''); setDeleteConfirm(null); setExpandedSlot(null)
  }

  async function confirmDuplicate(id: string) {
    if (!duplicateDate) return
    await duplicateSlot(id, duplicateDate)
    setDuplicatingSlot(null); setDuplicateDate('')
  }

  function cancelDuplicate() { setDuplicatingSlot(null); setDuplicateDate('') }

  async function handleAddStudent(slotId: string) {
    const student = students.find(s => s.id === addStudentId)
    if (!student) return
    setAddingStudent(true)
    await addBooking({ slotId, firstName: student.firstName, lastName: student.lastName, email: student.email, phone: student.phone })
    if (student.lessonCredits > 0) await decrementStudentCredits(student.id)
    setAddStudentId(''); setStudentSearch(''); setAddingStudent(false)
  }

  // ── Reusable render helpers ────────────────────────

  function renderStudentsPanel(slot: Slot): ReactNode {
    const bookedIds = new Set(slot.bookings.map(b => b.email))
    const available = students.filter(s => !bookedIds.has(s.email) && s.lessonCredits >= 1)
    return (
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
                <button className="btn-text btn-text--danger" onClick={() => { void deleteBooking(slot.id, b.id) }}>
                  Rimuovi
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="add-student-row">
          <span className="add-student-label">Aggiungi studente</span>
          <div className="add-student-controls">
            <div className="student-search-wrap">
              <input
                type="text" className="student-search-input" placeholder="Cerca per nome o email…"
                autoComplete="off" value={studentSearch}
                onChange={e => { setStudentSearch(e.target.value); setAddStudentId(''); setShowStudentDropdown(true) }}
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
                      <li key={s.id} className="student-search-option"
                        onMouseDown={() => { setAddStudentId(s.id); setStudentSearch(`${s.firstName} ${s.lastName}`); setShowStudentDropdown(false) }}>
                        <span className="student-search-name">{s.firstName} {s.lastName}</span>
                        <span className="student-search-meta">{s.email} · {s.lessonCredits > 0 ? `${s.lessonCredits} crediti` : 'nessun credito'}</span>
                      </li>
                    ))}
                  </ul>
                ) : <div className="student-search-empty">Nessuno studente trovato</div>
              })()}
            </div>
            <button className="btn-primary btn-sm" disabled={!addStudentId || addingStudent}
              onClick={() => handleAddStudent(slot.id)}>
              {addingStudent ? '…' : 'Aggiungi'}
            </button>
          </div>
          {slot.bookings.length >= slot.maxParticipants && (
            <p className="add-student-warning">La lezione è al completo — l'aggiunta manuale supererà il limite.</p>
          )}
        </div>
      </div>
    )
  }

  function renderDuplicatePanel(slot: Slot, onClose: () => void): ReactNode {
    return (
      <div className="slot-duplicate-panel">
        <span className="duplicate-label">Nuova data per la copia di <strong>{slot.title}</strong>:</span>
        <input type="date" value={duplicateDate} onChange={e => setDuplicateDate(e.target.value)} />
        <button className="btn-primary btn-sm" onClick={() => confirmDuplicate(slot.id)} disabled={!duplicateDate}>
          Conferma
        </button>
        <button className="btn-cancel-small" onClick={onClose}>Annulla</button>
      </div>
    )
  }

  function renderIconActions(slot: Slot, isExpanded: boolean, isDuplicating: boolean, isDeleteConfirm: boolean) {
    return (
      <div className="slot-icon-actions">
        <button className={`slot-icon-btn${isExpanded ? ' slot-icon-btn--active' : ''}`}
          onClick={() => toggleExpanded(slot.id)} title="Vedi studenti">
          <IconEye />
        </button>
        <button className={`slot-icon-btn${isDuplicating ? ' slot-icon-btn--active' : ''}`}
          onClick={() => startDuplicate(slot.id)} title="Duplica">
          <IconCopy />
        </button>
        <button className="slot-icon-btn" onClick={() => openEdit(slot)} title="Modifica">
          <IconEdit />
        </button>
        <button className={`slot-icon-btn slot-icon-btn--danger${isDeleteConfirm ? ' slot-icon-btn--danger-active' : ''}`}
          onClick={() => handleDelete(slot)} title="Elimina">
          <IconTrash />
        </button>
      </div>
    )
  }

  // ── Render ─────────────────────────────────────────

  return (
    <div className="slots-page">

      {/* ── Header ── */}
      <div className="slots-header">
        <div className="slots-header-left">
          <h1 className="slots-title">Lezioni</h1>
          <p className="slots-subtitle">
            {upcomingCount} {upcomingCount === 1 ? 'prossima' : 'prossime'} · {pastCount} {pastCount === 1 ? 'passata' : 'passate'}
          </p>
        </div>
        <div className="slots-header-right">
          <div className="slots-view-toggle">
            <button className={`view-btn${viewMode === 'list' ? ' view-btn--active' : ''}`}
              onClick={() => setViewMode('list')}>Lista</button>
            <button className={`view-btn${viewMode === 'week' ? ' view-btn--active' : ''}`}
              onClick={() => setViewMode('week')}>Settimana</button>
          </div>
          <button className={`btn-filtri${showFilters ? ' btn-filtri--open' : ''}`}
            onClick={() => setShowFilters(f => !f)}>
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6">
              <path d="M2 4h12M5 8h6M7 12h2" />
            </svg>
            Filtri
            {filterTypes.length > 0 && <span className="filter-active-badge">{filterTypes.length}</span>}
          </button>
          {!showForm && (
            <button className="btn-primary slots-new-btn" onClick={openCreate}>+ Nuova lezione</button>
          )}
        </div>
      </div>

      {/* ── Filter panel ── */}
      {showFilters && (
        <div className="filter-panel">
          <div className="filter-section">
            <span className="filter-label">Tipo di lezione</span>
            <div className="filter-pills-group">
              {TYPE_OPTIONS.map(type => (
                <button key={type}
                  className={`filter-pill${filterTypes.includes(type) ? ' filter-pill--active' : ''}`}
                  onClick={() => toggleFilterType(type)}>
                  {type}
                </button>
              ))}
            </div>
          </div>
          {filterTypes.length > 0 && (
            <button className="filter-clear" onClick={() => setFilterTypes([])}>
              × Rimuovi filtri
            </button>
          )}
        </div>
      )}

      {/* ── Create / Edit form ── */}
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
              <textarea name="notes" value={form.notes} onChange={handleChange} rows={3}
                placeholder="Informazioni aggiuntive per gli studenti…" />
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

      {/* ══════════════ LIST VIEW ══════════════ */}
      {viewMode === 'list' && (
        <>
          <div className="slot-tabs">
            <button className={`slot-tab${activeTab === 'upcoming' ? ' slot-tab--active' : ''}`}
              onClick={() => setActiveTab('upcoming')}>
              Prossime <span className="slot-tab-badge">{upcomingCount}</span>
            </button>
            <button className={`slot-tab${activeTab === 'past' ? ' slot-tab--active' : ''}`}
              onClick={() => setActiveTab('past')}>
              Passate <span className="slot-tab-badge">{pastCount}</span>
            </button>
          </div>

          {listSlots.length === 0 ? (
            <div className="slots-empty">
              <p>{filterTypes.length > 0
                ? 'Nessun risultato con i filtri selezionati.'
                : activeTab === 'upcoming' ? 'Nessuna lezione in programma.' : 'Nessuna lezione passata.'}</p>
              {activeTab === 'upcoming' && filterTypes.length === 0 && (
                <p className="slots-empty-sub">Crea la tua prima lezione usando il pulsante qui sopra.</p>
              )}
            </div>
          ) : (
            <div className="slots-list">
              {listSlots.map(slot => {
                const isExpanded     = expandedSlot === slot.id
                const isDuplicating  = duplicatingSlot === slot.id
                const isDeleteConfirm = deleteConfirm === slot.id
                const { dayNum, month, dayName } = parseDateParts(slot.date)
                const rate = slotFillRate(slot)
                const slotWaitlist = waitlist.filter(w => w.slotId === slot.id).length
                const MAX_AV = 4

                return (
                  <div key={slot.id} className={`slot-card${activeTab === 'past' ? ' slot-card--past' : ''}`}>

                    <div className="slot-main">
                      {/* Date */}
                      <div className="slot-date-col">
                        <span className="slot-date-num">{dayNum}</span>
                        <span className="slot-date-month">{month}</span>
                        <span className="slot-date-day">{dayName}</span>
                      </div>

                      {/* Info */}
                      <div className="slot-info-col">
                        <div className="slot-badges">
                          {slot.type && <span className="slot-type-pill">{slot.type}</span>}
                          {slotWaitlist > 0 && <span className="slot-waitlist-pill">{slotWaitlist} in attesa</span>}
                        </div>
                        <span className="slot-title">{slot.title}</span>
                        <div className="slot-meta">
                          <svg className="slot-meta-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                            <circle cx="8" cy="8" r="6"/><path d="M8 5v3l2 1.2"/>
                          </svg>
                          {slot.time} · {slot.duration} min · Laura P.
                        </div>
                      </div>

                      {/* Capacity */}
                      <div className="slot-cap-col">
                        <div className="slot-cap-header">
                          <span className="slot-cap-text">{slot.bookings.length} / {slot.maxParticipants} prenotati</span>
                          <span className="slot-cap-pct">{rate}%</span>
                        </div>
                        <div className="fill-bar-wrap">
                          <div className="fill-bar" style={{ width: `${rate}%`, background: fillBarColor(rate) }} />
                        </div>
                        <div className="slot-cap-footer">
                          <div className="slot-avatars">
                            {slot.bookings.slice(0, MAX_AV).map(b => (
                              <div key={b.id} className="slot-avatar"
                                style={{ background: avatarColor(`${b.firstName}${b.lastName}`) }}
                                title={`${b.firstName} ${b.lastName}`}>
                                {initials(b.firstName, b.lastName)}
                              </div>
                            ))}
                            {slot.bookings.length > MAX_AV && (
                              <div className="slot-avatar slot-avatar--more">+{slot.bookings.length - MAX_AV}</div>
                            )}
                          </div>
                          {renderIconActions(slot, isExpanded, isDuplicating, isDeleteConfirm)}
                        </div>
                      </div>
                    </div>

                    {isDeleteConfirm && (
                      <div className="slot-delete-confirm">
                        <span className="slot-delete-confirm-text">Eliminare questa lezione e tutte le sue prenotazioni?</span>
                        <button className="btn-confirm-delete" onClick={() => handleDelete(slot)}>Conferma</button>
                        <button className="btn-cancel-small" onClick={() => setDeleteConfirm(null)}>Annulla</button>
                      </div>
                    )}

                    {isDuplicating && renderDuplicatePanel(slot, cancelDuplicate)}

                    {isExpanded && renderStudentsPanel(slot)}
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}

      {/* ══════════════ WEEK VIEW ══════════════ */}
      {viewMode === 'week' && (
        <div className="week-view">

          {/* Week navigation */}
          <div className="week-nav">
            <button className="week-nav-btn" onClick={() => setWeekStart(d => addDays(d, -7))}>
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 12L6 8l4-4"/></svg>
            </button>
            <span className="week-nav-range">{weekRange}</span>
            <button className="week-nav-btn" onClick={() => setWeekStart(d => addDays(d, 7))}>
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 4l4 4-4 4"/></svg>
            </button>
            <button className="week-nav-today" onClick={() => setWeekStart(getMonday(new Date()))}>
              Oggi
            </button>
            <span className="week-nav-count">
              {typeFiltered.filter(s => weekDays.some(d => toISO(d) === s.date)).length} lezioni
            </span>
          </div>

          {/* 7-column grid */}
          <div className="week-grid-wrap">
            <div className="week-grid">
              {weekDays.map((day, i) => {
                const ds = toISO(day)
                const isToday = ds === today
                const isPast  = ds < today
                const daySlots = typeFiltered
                  .filter(s => s.date === ds)
                  .sort((a, b) => a.time.localeCompare(b.time))

                return (
                  <div key={ds} className={`week-col${isToday ? ' week-col--today' : ''}${isPast ? ' week-col--past' : ''}`}>
                    <div className="week-col-head">
                      <span className="week-col-label">{WEEK_LABELS[i]}</span>
                      <span className="week-col-num">{day.getDate()}</span>
                    </div>
                    <div className="week-col-body">
                      {daySlots.map(slot => {
                        const rate = slotFillRate(slot)
                        const isDelConfirm = deleteConfirm === slot.id
                        const isDup  = duplicatingSlot === slot.id
                        const isExp  = expandedSlot === slot.id

                        return (
                          <div key={slot.id}
                            className={`week-slot-card${isDelConfirm ? ' week-slot-card--delete' : ''}${isDup ? ' week-slot-card--dup' : ''}${isExp ? ' week-slot-card--exp' : ''}`}
                          >
                            {isDelConfirm ? (
                              <div className="week-slot-confirm">
                                <span>Eliminare?</span>
                                <div className="week-slot-confirm-btns">
                                  <button className="btn-confirm-delete btn-sm" onClick={() => handleDelete(slot)}>Sì</button>
                                  <button className="btn-cancel-small" onClick={() => setDeleteConfirm(null)}>No</button>
                                </div>
                              </div>
                            ) : (
                              <>
                                <div className="week-slot-head">
                                  <span className="week-slot-time">{slot.time}</span>
                                  <div className="week-slot-actions">
                                    <button className={`week-slot-icon-btn${isExp ? ' active' : ''}`}
                                      title="Studenti" onClick={() => toggleExpanded(slot.id)}><IconEye /></button>
                                    <button className={`week-slot-icon-btn${isDup ? ' active' : ''}`}
                                      title="Duplica" onClick={() => startDuplicate(slot.id)}><IconCopy /></button>
                                    <button className="week-slot-icon-btn"
                                      title="Modifica" onClick={() => openEdit(slot)}><IconEdit /></button>
                                    <button className="week-slot-icon-btn week-slot-icon-btn--danger"
                                      title="Elimina" onClick={() => handleDelete(slot)}><IconTrash /></button>
                                  </div>
                                </div>
                                <div className="week-slot-name">{slot.title}</div>
                                {slot.type && <span className="week-slot-type">{slot.type}</span>}
                                <div className="week-slot-fill">
                                  <div className="week-slot-bar-wrap">
                                    <div className="week-slot-bar" style={{ width: `${rate}%`, background: fillBarColor(rate) }} />
                                  </div>
                                  <span className="week-slot-count">{slot.bookings.length}/{slot.maxParticipants}</span>
                                </div>
                              </>
                            )}
                          </div>
                        )
                      })}
                      <button className="week-add-btn" onClick={openCreate} title="Aggiungi lezione">+</button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Panels below grid (expand / duplicate) */}
          {(() => {
            const dupSlot    = duplicatingSlot ? slots.find(s => s.id === duplicatingSlot) ?? null : null
            const activeSlot = expandedSlot    ? slots.find(s => s.id === expandedSlot)    ?? null : null
            return (
              <>
                {dupSlot && (
                  <div className="week-panel">
                    <div className="week-panel-head">
                      <span className="week-panel-title">Duplica — {dupSlot.title}</span>
                      <button className="week-panel-close" onClick={cancelDuplicate}>✕</button>
                    </div>
                    {renderDuplicatePanel(dupSlot, cancelDuplicate)}
                  </div>
                )}
                {activeSlot && (
                  <div className="week-panel">
                    <div className="week-panel-head">
                      <span className="week-panel-title">Studenti — {activeSlot.title}</span>
                      <button className="week-panel-close" onClick={() => setExpandedSlot(null)}>✕</button>
                    </div>
                    {renderStudentsPanel(activeSlot)}
                  </div>
                )}
              </>
            )
          })()}
        </div>
      )}
    </div>
  )
}

import { useState, useMemo, useRef, useEffect } from 'react'
import { useApp } from '../../context/AppContext'
import type { Student, Slot } from '../../types'
import { supabase } from '../../lib/supabase'
import './AdminStudents.css'

// ── Constants ───────────────────────────────────────────────────────────
const MONTH_SHORT = ['GEN','FEB','MAR','APR','MAG','GIU','LUG','AGO','SET','OTT','NOV','DIC']
const AVATAR_COLORS = ['#818569','#8b4a48','#c17f3b','#5c6148','#9a8878','#6e7258','#b0906e']

function avatarColor(name: string): string {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffff
  return AVATAR_COLORS[h % AVATAR_COLORS.length]
}

function initials(first: string, last: string): string {
  return `${first[0] ?? ''}${last[0] ?? ''}`.toUpperCase()
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function formatDateShort(iso: string): string {
  const d = new Date(iso)
  return `${String(d.getDate()).padStart(2, '0')}/${MONTH_SHORT[d.getMonth()]}`
}

// ── Student stats derived from slots ────────────────────────────────────
interface StudentStats {
  totalLessons: number
  pastLessons: number
  upcomingSlots: Slot[]
  preferredType: string | null
  lastLesson: Slot | null
}

function getStudentStats(email: string, slots: Slot[]): StudentStats {
  const today = new Date().toISOString().split('T')[0]
  const matched: Slot[] = []

  for (const slot of slots) {
    if (slot.bookings.some(b => b.email.toLowerCase() === email.toLowerCase())) {
      matched.push(slot)
    }
  }

  const pastSlots = matched.filter(s => s.date < today).sort((a, b) => b.date.localeCompare(a.date))
  const upcomingSlots = matched.filter(s => s.date >= today).sort((a, b) => a.date.localeCompare(b.date))

  const typeCount: Record<string, number> = {}
  matched.forEach(s => { if (s.type) typeCount[s.type] = (typeCount[s.type] || 0) + 1 })
  const preferredType = Object.entries(typeCount).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null

  return {
    totalLessons: matched.length,
    pastLessons: pastSlots.length,
    upcomingSlots,
    preferredType,
    lastLesson: pastSlots[0] ?? null,
  }
}

// ── CSV export ───────────────────────────────────────────────────────────
function exportCSV(students: Student[]) {
  const header = 'Nome,Cognome,Email,Telefono,Crediti,Iscritto il'
  const rows = students.map(s =>
    [s.firstName, s.lastName, s.email, s.phone, s.lessonCredits, formatDate(s.createdAt)]
      .map(v => `"${String(v).replace(/"/g, '""')}"`)
      .join(',')
  )
  const blob = new Blob([header + '\n' + rows.join('\n')], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'studenti.csv'
  a.click()
  URL.revokeObjectURL(url)
}

// ── Form types ───────────────────────────────────────────────────────────
interface StudentForm { firstName: string; lastName: string; email: string; phone: string }
const emptyForm: StudentForm = { firstName: '', lastName: '', email: '', phone: '' }

type FilterTab = 'all' | 'credits' | 'no-credits' | 'new' | 'inactive'

// ════════════════════════════════════════════════════════════════════════
export default function AdminStudents() {
  const { students, slots, createStudent, updateStudent, updateStudentCredits } = useApp()

  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<FilterTab>('all')
  const [selectedId, setSelectedId] = useState<string | null>(null)

  // New student modal
  const [showNewModal, setShowNewModal] = useState(false)
  const [newForm, setNewForm] = useState<StudentForm>(emptyForm)
  const [newError, setNewError] = useState('')
  const [newSaving, setNewSaving] = useState(false)

  // Edit student modal
  const [editId, setEditId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<StudentForm>(emptyForm)
  const [editError, setEditError] = useState('')
  const [editSaving, setEditSaving] = useState(false)
  const [welcomeSentId, setWelcomeSentId] = useState<string | null>(null)

  // Inline credit edit in detail panel
  const [creditEditing, setCreditEditing] = useState(false)
  const [creditVal, setCreditVal] = useState('')

  // Add credits modal
  const [showAddCredits, setShowAddCredits] = useState(false)
  const [addCreditsAmt, setAddCreditsAmt] = useState('1')
  const [addCreditsSaving, setAddCreditsSaving] = useState(false)

  // Three-dot menu
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  const today30 = useMemo(() => {
    const d = new Date(); d.setDate(d.getDate() - 30)
    return d.toISOString().split('T')[0]
  }, [])

  // Filtered students
  const filtered = useMemo(() => {
    let list = [...students]

    if (filter === 'credits') list = list.filter(s => s.lessonCredits > 0)
    else if (filter === 'no-credits') list = list.filter(s => s.lessonCredits === 0)
    else if (filter === 'new') list = list.filter(s => s.createdAt.split('T')[0] >= today30)
    else if (filter === 'inactive') {
      list = list.filter(s => {
        if (s.lessonCredits > 0) return false
        const stats = getStudentStats(s.email, slots)
        return stats.upcomingSlots.length === 0
      })
    }

    if (search.trim()) {
      const q = search.toLowerCase().trim()
      list = list.filter(s =>
        s.firstName.toLowerCase().includes(q) ||
        s.lastName.toLowerCase().includes(q) ||
        s.email.toLowerCase().includes(q) ||
        s.phone.includes(q)
      )
    }

    return list.sort((a, b) =>
      `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`, 'it')
    )
  }, [students, filter, search, slots, today30])

  const selected = students.find(s => s.id === selectedId) ?? null
  const selectedStats = useMemo(
    () => selected ? getStudentStats(selected.email, slots) : null,
    [selected, slots]
  )

  // Stats
  const totalCredits = useMemo(() => students.reduce((s, st) => s + st.lessonCredits, 0), [students])
  const newThisMonth = useMemo(() => students.filter(s => s.createdAt.split('T')[0] >= today30).length, [students, today30])

  // Close menu on outside click
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  // Sync credit edit value when selection changes
  useEffect(() => {
    if (selected) { setCreditVal(String(selected.lessonCredits)); setCreditEditing(false) }
  }, [selected?.id])

  // ── Handlers ────────────────────────────────────────────────────────
  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setNewError('')
    setNewSaving(true)
    const result = await createStudent(newForm)
    setNewSaving(false)
    if (result === 'email_taken') { setNewError('Questa email è già registrata.'); return }
    setNewForm(emptyForm)
    setShowNewModal(false)
  }

  function startEdit(s: Student) {
    setEditId(s.id)
    setEditForm({ firstName: s.firstName, lastName: s.lastName, email: s.email, phone: s.phone })
    setEditError('')
    setWelcomeSentId(null)
    setMenuOpen(false)
  }

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault()
    if (!editId) return
    setEditError('')
    setEditSaving(true)
    const emailChanged = students.find(s => s.id === editId)?.email.toLowerCase() !== editForm.email.toLowerCase()
    if (emailChanged) {
      const dup = students.find(s => s.id !== editId && s.email.toLowerCase() === editForm.email.toLowerCase())
      if (dup) { setEditError('Email già usata da un altro studente.'); setEditSaving(false); return }
    }
    await updateStudent(editId, editForm)
    setEditSaving(false)
    setEditId(null)
  }

  async function handleSendWelcome(s: Student) {
    await supabase.functions.invoke('send-email', {
      body: { type: 'welcome', studentEmail: s.email, studentName: `${s.firstName} ${s.lastName}` },
    })
    setWelcomeSentId(s.id)
    setMenuOpen(false)
  }

  async function handleCreditSave() {
    if (!selected) return
    const v = parseInt(creditVal, 10)
    if (isNaN(v) || v < 0) return
    await updateStudentCredits(selected.id, v)
    setCreditEditing(false)
  }

  async function handleAddCredits() {
    if (!selected) return
    const amt = parseInt(addCreditsAmt, 10)
    if (isNaN(amt) || amt < 1) return
    setAddCreditsSaving(true)
    await updateStudentCredits(selected.id, selected.lessonCredits + amt)
    setAddCreditsSaving(false)
    setShowAddCredits(false)
    setAddCreditsAmt('1')
  }

  // ── Render ───────────────────────────────────────────────────────────
  return (
    <div className="st-page">
      {/* Header */}
      <div className="st-header">
        <div>
          <h1 className="st-title">Studenti</h1>
          <p className="st-subtitle">
            {students.length} {students.length === 1 ? 'studente registrato' : 'studenti registrati'}
            {newThisMonth > 0 && <> · {newThisMonth} nuov{newThisMonth === 1 ? 'o' : 'i'} questo mese</>}
          </p>
        </div>
        <div className="st-header-actions">
          <button className="btn-esporta" onClick={() => exportCSV(students)}>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M3 12h10M8 2v8M5 7l3 3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Esporta
          </button>
          <button className="btn-nuovo-studente" onClick={() => { setShowNewModal(true); setNewForm(emptyForm); setNewError('') }}>
            + Nuovo studente
          </button>
        </div>
      </div>

      {/* Stats cards */}
      <div className="st-stats">
        <div className="st-stat">
          <span className="st-stat-label">Totale</span>
          <span className="st-stat-value">{students.length}</span>
        </div>
        <div className="st-stat">
          <span className="st-stat-label">Con crediti</span>
          <span className="st-stat-value">{students.filter(s => s.lessonCredits > 0).length}</span>
        </div>
        <div className="st-stat">
          <span className="st-stat-label">Senza crediti</span>
          <span className="st-stat-value">{students.filter(s => s.lessonCredits === 0).length}</span>
        </div>
        <div className="st-stat">
          <span className="st-stat-label">Crediti totali in circolo</span>
          <span className="st-stat-value">{totalCredits}</span>
        </div>
      </div>

      {/* Search + filter tabs */}
      <div className="st-toolbar">
        <div className="st-search-wrap">
          <svg className="st-search-icon" width="15" height="15" viewBox="0 0 16 16" fill="none">
            <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.5"/>
            <path d="M11 11l3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          <input
            className="st-search"
            type="search"
            placeholder="Cerca per nome, email, telefono…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="st-tabs">
          {([
            ['all', 'Tutti'],
            ['credits', 'Con crediti'],
            ['no-credits', 'Senza crediti'],
            ['new', 'Nuovi (30 gg)'],
            ['inactive', 'Inattivi'],
          ] as const).map(([key, label]) => (
            <button
              key={key}
              className={`st-tab ${filter === key ? 'st-tab--active' : ''}`}
              onClick={() => setFilter(key)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Main content: table + detail panel */}
      <div className={`st-body ${selected ? 'st-body--split' : ''}`}>
        {/* Table */}
        <div className="st-table-wrap">
          {students.length === 0 ? (
            <div className="st-empty-state">
              <p className="st-empty-title">Nessuno studente registrato</p>
              <p className="st-empty-sub">Gli studenti appariranno qui dopo la registrazione.</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="st-empty-state">
              <p className="st-empty-title">Nessun risultato</p>
              <p className="st-empty-sub">Prova a cambiare i filtri o la ricerca.</p>
            </div>
          ) : (
            <table className="st-table">
              <thead>
                <tr>
                  <th>Studente</th>
                  <th>Contatto</th>
                  <th>Iscritto il</th>
                  <th>Crediti</th>
                  <th>Lezioni</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(student => {
                  const stats = getStudentStats(student.email, slots)
                  const isSelected = selectedId === student.id
                  const color = avatarColor(`${student.firstName} ${student.lastName}`)
                  return (
                    <tr
                      key={student.id}
                      className={`st-row ${isSelected ? 'st-row--selected' : ''}`}
                      onClick={() => setSelectedId(isSelected ? null : student.id)}
                    >
                      <td>
                        <div className="st-student-cell">
                          <div className="st-avatar" style={{ background: color }}>
                            {initials(student.firstName, student.lastName)}
                          </div>
                          <div>
                            <div className="st-student-name">{student.firstName} {student.lastName}</div>
                            {stats.preferredType && (
                              <div className="st-student-pref">predilige {stats.preferredType}</div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td>
                        <div className="st-contact-email">{student.email}</div>
                        <div className="st-contact-phone">{student.phone}</div>
                      </td>
                      <td className="st-date-cell">{formatDate(student.createdAt)}</td>
                      <td>
                        <span className={`st-credit-badge ${student.lessonCredits === 0 ? 'st-credit-badge--zero' : ''}`}>
                          {student.lessonCredits}
                        </span>
                      </td>
                      <td className="st-lessons-cell">{stats.totalLessons}</td>
                      <td>
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="st-arrow">
                          <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Detail panel */}
        {selected && selectedStats && (
          <div className="st-detail">
            {/* Panel header image area */}
            <div className="st-detail-top">
              <button className="st-detail-icon-btn" onClick={() => startEdit(selected)}>
                <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
                  <path d="M11.5 2.5a1.414 1.414 0 012 2L5 13H3v-2L11.5 2.5z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/>
                </svg>
              </button>
              <div className="st-detail-menu-wrap" ref={menuRef}>
                <button className="st-detail-icon-btn" onClick={() => setMenuOpen(v => !v)}>
                  <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
                    <circle cx="8" cy="3" r="1.2" fill="currentColor"/>
                    <circle cx="8" cy="8" r="1.2" fill="currentColor"/>
                    <circle cx="8" cy="13" r="1.2" fill="currentColor"/>
                  </svg>
                </button>
                {menuOpen && (
                  <div className="st-dropdown">
                    <button className="st-dropdown-item" onClick={() => startEdit(selected)}>Modifica studente</button>
                    <button className="st-dropdown-item" onClick={() => { void handleSendWelcome(selected) }}>
                      {welcomeSentId === selected.id ? 'Email inviata ✓' : 'Reinvia benvenuto'}
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Identity */}
            <div className="st-detail-identity">
              <div className="st-detail-avatar" style={{ background: avatarColor(`${selected.firstName} ${selected.lastName}`) }}>
                {initials(selected.firstName, selected.lastName)}
              </div>
              <div>
                <div className="st-detail-name">{selected.firstName} {selected.lastName}</div>
                <div className="st-detail-since">iscritto il {formatDate(selected.createdAt)}</div>
              </div>
            </div>

            {/* Contacts */}
            <div className="st-detail-contacts">
              <div className="st-detail-contact-row">
                <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
                  <rect x="2" y="3" width="12" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.4"/>
                  <path d="M2 5l6 5 6-5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                </svg>
                <span>{selected.email}</span>
              </div>
              <div className="st-detail-contact-row">
                <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
                  <path d="M3 2.5h3l1.5 3.5-1.75 1.25A8.5 8.5 0 009.75 10.25L11 8.5l3.5 1.5V13A1 1 0 0113.5 14C6.5 14 2 7.5 2 3.5A1 1 0 013 2.5z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/>
                </svg>
                <span>{selected.phone}</span>
              </div>
            </div>

            {/* Stats grid */}
            <div className="st-detail-grid">
              <div className="st-detail-stat">
                <span className="st-detail-stat-label">Crediti residui</span>
                <div className="st-detail-stat-row">
                  {creditEditing ? (
                    <input
                      className="st-credit-input"
                      type="number"
                      min={0}
                      value={creditVal}
                      autoFocus
                      onChange={e => setCreditVal(e.target.value)}
                      onBlur={() => { void handleCreditSave() }}
                      onKeyDown={e => { if (e.key === 'Enter') void handleCreditSave() }}
                    />
                  ) : (
                    <>
                      <span className="st-detail-stat-value">{selected.lessonCredits}</span>
                      <button className="st-edit-link" onClick={() => { setCreditVal(String(selected.lessonCredits)); setCreditEditing(true) }}>
                        edit
                      </button>
                    </>
                  )}
                </div>
              </div>
              <div className="st-detail-stat">
                <span className="st-detail-stat-label">Lezioni svolte</span>
                <span className="st-detail-stat-value">{selectedStats.pastLessons}</span>
              </div>
              <div className="st-detail-stat">
                <span className="st-detail-stat-label">Ultima lezione</span>
                <span className="st-detail-stat-value st-detail-stat-value--italic">
                  {selectedStats.lastLesson ? formatDateShort(selectedStats.lastLesson.date) : '—'}
                </span>
              </div>
              <div className="st-detail-stat">
                <span className="st-detail-stat-label">Predilige</span>
                <span className="st-detail-stat-value st-detail-stat-value--italic">
                  {selectedStats.preferredType ?? '—'}
                </span>
              </div>
            </div>

            {/* Upcoming bookings */}
            <div className="st-detail-upcoming">
              <div className="st-detail-section-label">Prossime prenotazioni</div>
              {selectedStats.upcomingSlots.length === 0 ? (
                <p className="st-detail-empty">Nessuna prenotazione</p>
              ) : (
                <div className="st-detail-bookings">
                  {selectedStats.upcomingSlots.slice(0, 4).map(slot => {
                    const d = new Date(slot.date)
                    return (
                      <div key={slot.id} className="st-detail-booking-row">
                        <div className="st-detail-booking-date">
                          <span className="st-detail-booking-day">{d.getDate()}</span>
                          <span className="st-detail-booking-month">{MONTH_SHORT[d.getMonth()]}</span>
                        </div>
                        <div className="st-detail-booking-info">
                          <div className="st-detail-booking-title">{slot.title}</div>
                          <div className="st-detail-booking-sub">{slot.type} · {slot.time}</div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="st-detail-actions">
              <a
                className="btn-scrivi"
                href={`mailto:${selected.email}`}
              >
                <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
                  <rect x="2" y="3" width="12" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.4"/>
                  <path d="M2 5l6 5 6-5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                </svg>
                Scrivi
              </a>
              <div className="st-add-credits-wrap">
                <button className="btn-aggiungi-crediti" onClick={() => { setShowAddCredits(v => !v); setAddCreditsAmt('1') }}>
                  + Aggiungi crediti
                </button>
                {showAddCredits && (
                  <div className="st-add-credits-popup">
                    <p className="st-add-credits-label">Aggiungi crediti</p>
                    <div className="st-add-credits-row">
                      <button className="st-credits-adj" onClick={() => setAddCreditsAmt(v => String(Math.max(1, (parseInt(v) || 1) - 1)))}>−</button>
                      <input
                        className="st-credits-num"
                        type="number"
                        min={1}
                        value={addCreditsAmt}
                        onChange={e => setAddCreditsAmt(e.target.value)}
                      />
                      <button className="st-credits-adj" onClick={() => setAddCreditsAmt(v => String((parseInt(v) || 0) + 1))}>+</button>
                    </div>
                    <div className="st-add-credits-btns">
                      <button className="btn-cancel-sm" onClick={() => setShowAddCredits(false)}>Annulla</button>
                      <button className="btn-confirm-sm" disabled={addCreditsSaving} onClick={() => { void handleAddCredits() }}>
                        {addCreditsSaving ? 'Salvo…' : 'Conferma'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* New student modal */}
      {showNewModal && (
        <div className="st-modal-overlay" onClick={e => { if (e.target === e.currentTarget) setShowNewModal(false) }}>
          <div className="st-modal">
            <div className="st-modal-header">
              <h2 className="st-modal-title">Nuovo studente</h2>
              <button className="st-modal-close" onClick={() => setShowNewModal(false)}>✕</button>
            </div>
            {newError && <p className="st-form-error">{newError}</p>}
            <form onSubmit={handleCreate}>
              <div className="st-form-grid">
                <div className="st-field">
                  <label className="st-label">Nome</label>
                  <input type="text" required placeholder="Mario" value={newForm.firstName}
                    onChange={e => setNewForm(p => ({ ...p, firstName: e.target.value }))} />
                </div>
                <div className="st-field">
                  <label className="st-label">Cognome</label>
                  <input type="text" required placeholder="Rossi" value={newForm.lastName}
                    onChange={e => setNewForm(p => ({ ...p, lastName: e.target.value }))} />
                </div>
                <div className="st-field">
                  <label className="st-label">Email</label>
                  <input type="email" required placeholder="mario.rossi@email.com" value={newForm.email}
                    onChange={e => setNewForm(p => ({ ...p, email: e.target.value }))} />
                </div>
                <div className="st-field">
                  <label className="st-label">Telefono</label>
                  <input type="tel" required placeholder="+39 333 123 4567" value={newForm.phone}
                    onChange={e => setNewForm(p => ({ ...p, phone: e.target.value }))} />
                </div>
              </div>
              <div className="st-modal-actions">
                <button type="button" className="btn-cancel-modal" onClick={() => setShowNewModal(false)}>Annulla</button>
                <button type="submit" className="btn-save-modal" disabled={newSaving}>
                  {newSaving ? 'Salvataggio…' : 'Crea account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit student modal */}
      {editId && (
        <div className="st-modal-overlay" onClick={e => { if (e.target === e.currentTarget) setEditId(null) }}>
          <div className="st-modal">
            <div className="st-modal-header">
              <h2 className="st-modal-title">Modifica studente</h2>
              <button className="st-modal-close" onClick={() => setEditId(null)}>✕</button>
            </div>
            {editError && <p className="st-form-error">{editError}</p>}
            <form onSubmit={handleUpdate}>
              <div className="st-form-grid">
                <div className="st-field">
                  <label className="st-label">Nome</label>
                  <input type="text" required value={editForm.firstName}
                    onChange={e => setEditForm(p => ({ ...p, firstName: e.target.value }))} />
                </div>
                <div className="st-field">
                  <label className="st-label">Cognome</label>
                  <input type="text" required value={editForm.lastName}
                    onChange={e => setEditForm(p => ({ ...p, lastName: e.target.value }))} />
                </div>
                <div className="st-field">
                  <label className="st-label">Email</label>
                  <input type="email" required value={editForm.email}
                    onChange={e => setEditForm(p => ({ ...p, email: e.target.value }))} />
                </div>
                <div className="st-field">
                  <label className="st-label">Telefono</label>
                  <input type="tel" required value={editForm.phone}
                    onChange={e => setEditForm(p => ({ ...p, phone: e.target.value }))} />
                </div>
              </div>
              <div className="st-modal-actions">
                <button type="button" className="btn-cancel-modal" onClick={() => setEditId(null)}>Annulla</button>
                <button type="submit" className="btn-save-modal" disabled={editSaving}>
                  {editSaving ? 'Salvataggio…' : 'Salva modifiche'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

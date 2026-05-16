import { useState, useMemo } from 'react'
import { useApp } from '../../context/AppContext'
import { supabase } from '../../lib/supabase'
import './AdminStudents.css'

interface StudentForm {
  firstName: string
  lastName: string
  email: string
  phone: string
}

const emptyForm: StudentForm = { firstName: '', lastName: '', email: '', phone: '' }

export default function AdminStudents() {
  const { students, createStudent, updateStudent, updateStudentCredits } = useApp()
  const [search, setSearch] = useState('')
  const [showNewForm, setShowNewForm] = useState(false)
  const [newForm, setNewForm] = useState<StudentForm>(emptyForm)
  const [newError, setNewError] = useState('')
  const [newSaving, setNewSaving] = useState(false)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<StudentForm>(emptyForm)
  const [editError, setEditError] = useState('')
  const [editSaving, setEditSaving] = useState(false)
  const [welcomeSentId, setWelcomeSentId] = useState<string | null>(null)

  const [creditInputs, setCreditInputs] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {}
    students.forEach(s => { init[s.id] = String(s.lessonCredits) })
    return init
  })
  const [savedCreditIds, setSavedCreditIds] = useState<Set<string>>(new Set())

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    if (!q) return students
    return students.filter(s =>
      s.firstName.toLowerCase().includes(q) ||
      s.lastName.toLowerCase().includes(q) ||
      s.email.toLowerCase().includes(q) ||
      s.phone.includes(q)
    )
  }, [students, search])

  const sorted = useMemo(() =>
    [...filtered].sort((a, b) =>
      `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`, 'it')
    ), [filtered])

  function formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('it-IT', {
      day: '2-digit', month: '2-digit', year: 'numeric',
    })
  }

  // ── New student ──────────────────────────────────────────────
  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setNewError('')
    setNewSaving(true)
    const result = await createStudent(newForm)
    setNewSaving(false)
    if (result === 'email_taken') {
      setNewError('Questa email è già registrata.')
      return
    }
    setNewForm(emptyForm)
    setShowNewForm(false)
  }

  // ── Edit student ─────────────────────────────────────────────
  function startEdit(id: string) {
    const s = students.find(x => x.id === id)
    if (!s) return
    setEditingId(id)
    setEditForm({ firstName: s.firstName, lastName: s.lastName, email: s.email, phone: s.phone })
    setEditError('')
    setWelcomeSentId(null)
  }

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault()
    if (!editingId) return
    setEditError('')
    setEditSaving(true)
    const emailChanged = students.find(s => s.id === editingId)?.email.toLowerCase() !== editForm.email.toLowerCase()
    if (emailChanged) {
      const duplicate = students.find(s => s.id !== editingId && s.email.toLowerCase() === editForm.email.toLowerCase())
      if (duplicate) {
        setEditError('Questa email è già usata da un altro studente.')
        setEditSaving(false)
        return
      }
    }
    await updateStudent(editingId, editForm)
    setEditSaving(false)
    setEditingId(null)
  }

  async function handleSendWelcome(studentId: string) {
    const s = students.find(x => x.id === studentId)
    if (!s) return
    await supabase.functions.invoke('send-email', {
      body: {
        type: 'welcome',
        studentEmail: s.email,
        studentName: `${s.firstName} ${s.lastName}`,
      },
    })
    setWelcomeSentId(studentId)
  }

  // ── Credits ──────────────────────────────────────────────────
  function handleCreditChange(id: string, value: string) {
    setCreditInputs(prev => ({ ...prev, [id]: value }))
    setSavedCreditIds(prev => { const n = new Set(prev); n.delete(id); return n })
  }

  async function handleCreditSave(id: string) {
    const parsed = parseInt(creditInputs[id] ?? '0', 10)
    if (isNaN(parsed) || parsed < 0) return
    await updateStudentCredits(id, parsed)
    setSavedCreditIds(prev => new Set(prev).add(id))
  }

  return (
    <div className="students-page">
      <div className="students-header">
        <div>
          <h1 className="students-title">Studenti</h1>
          <p className="students-subtitle">{students.length} {students.length === 1 ? 'studente registrato' : 'studenti registrati'}</p>
        </div>
        <div className="students-header-actions">
          {students.length > 0 && (
            <input
              className="students-search"
              type="search"
              placeholder="Cerca per nome, email…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          )}
          <button
            className="btn-new-student"
            onClick={() => { setShowNewForm(v => !v); setNewForm(emptyForm); setNewError('') }}
          >
            {showNewForm ? 'Annulla' : '+ Nuovo studente'}
          </button>
        </div>
      </div>

      {showNewForm && (
        <form className="student-form-panel" onSubmit={handleCreate}>
          <h2 className="student-form-title">Nuovo studente</h2>
          {newError && <p className="student-form-error">{newError}</p>}
          <div className="student-form-grid">
            <div className="form-field">
              <label className="form-label">Nome</label>
              <input
                type="text" required placeholder="Mario"
                value={newForm.firstName}
                onChange={e => setNewForm(p => ({ ...p, firstName: e.target.value }))}
              />
            </div>
            <div className="form-field">
              <label className="form-label">Cognome</label>
              <input
                type="text" required placeholder="Rossi"
                value={newForm.lastName}
                onChange={e => setNewForm(p => ({ ...p, lastName: e.target.value }))}
              />
            </div>
            <div className="form-field">
              <label className="form-label">Email</label>
              <input
                type="email" required placeholder="mario.rossi@email.com"
                value={newForm.email}
                onChange={e => setNewForm(p => ({ ...p, email: e.target.value }))}
              />
            </div>
            <div className="form-field">
              <label className="form-label">Telefono</label>
              <input
                type="tel" required placeholder="+39 333 123 4567"
                value={newForm.phone}
                onChange={e => setNewForm(p => ({ ...p, phone: e.target.value }))}
              />
            </div>
          </div>
          <div className="student-form-actions">
            <button type="submit" className="btn-save-student" disabled={newSaving}>
              {newSaving ? 'Salvataggio…' : 'Crea account'}
            </button>
          </div>
        </form>
      )}

      {students.length === 0 && !showNewForm ? (
        <div className="students-empty-state">
          <p className="students-empty-title">Nessuno studente registrato</p>
          <p className="students-empty-sub">Gli studenti appariranno qui dopo la registrazione, oppure creali tu sopra.</p>
        </div>
      ) : filtered.length === 0 ? (
        <p className="students-empty">Nessun risultato per &ldquo;{search}&rdquo;</p>
      ) : (
        <div className="students-table-wrap">
          <table className="students-db-table">
            <thead>
              <tr>
                <th>Nome</th>
                <th>Email</th>
                <th className="col-phone">Telefono</th>
                <th className="col-date">Iscritto il</th>
                <th>Crediti</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {sorted.map(student => {
                const isEditing = editingId === student.id
                const creditVal = creditInputs[student.id] ?? String(student.lessonCredits)
                const creditSaved = savedCreditIds.has(student.id)
                const creditDirty = creditVal !== String(student.lessonCredits) && !creditSaved

                if (isEditing) {
                  return (
                    <tr key={student.id} className="student-row-editing">
                      <td colSpan={6}>
                        <form className="student-edit-form" onSubmit={handleUpdate}>
                          <div className="student-edit-grid">
                            <div className="form-field">
                              <label className="form-label">Nome</label>
                              <input
                                type="text" required
                                value={editForm.firstName}
                                onChange={e => setEditForm(p => ({ ...p, firstName: e.target.value }))}
                              />
                            </div>
                            <div className="form-field">
                              <label className="form-label">Cognome</label>
                              <input
                                type="text" required
                                value={editForm.lastName}
                                onChange={e => setEditForm(p => ({ ...p, lastName: e.target.value }))}
                              />
                            </div>
                            <div className="form-field">
                              <label className="form-label">Email</label>
                              <input
                                type="email" required
                                value={editForm.email}
                                onChange={e => setEditForm(p => ({ ...p, email: e.target.value }))}
                              />
                            </div>
                            <div className="form-field">
                              <label className="form-label">Telefono</label>
                              <input
                                type="tel" required
                                value={editForm.phone}
                                onChange={e => setEditForm(p => ({ ...p, phone: e.target.value }))}
                              />
                            </div>
                          </div>
                          {editError && <p className="student-form-error">{editError}</p>}
                          <div className="student-edit-actions">
                            <button type="submit" className="btn-save-student" disabled={editSaving}>
                              {editSaving ? 'Salvataggio…' : 'Salva modifiche'}
                            </button>
                            <button
                              type="button"
                              className="btn-welcome"
                              onClick={() => { void handleSendWelcome(student.id) }}
                            >
                              {welcomeSentId === student.id ? 'Email inviata ✓' : '↗ Reinvia benvenuto'}
                            </button>
                            <button
                              type="button"
                              className="btn-cancel-edit"
                              onClick={() => setEditingId(null)}
                            >
                              Annulla
                            </button>
                          </div>
                        </form>
                      </td>
                    </tr>
                  )
                }

                return (
                  <tr key={student.id}>
                    <td><span className="db-student-name">{student.firstName} {student.lastName}</span></td>
                    <td className="db-student-email">{student.email}</td>
                    <td className="db-student-phone col-phone">{student.phone}</td>
                    <td className="db-student-date col-date">{formatDate(student.createdAt)}</td>
                    <td>
                      <div className="credits-cell">
                        <input
                          className="credits-input"
                          type="number" min={0}
                          value={creditVal}
                          onChange={e => handleCreditChange(student.id, e.target.value)}
                        />
                        <button
                          className={`credits-save-btn ${creditSaved ? 'credits-save-btn--saved' : ''} ${!creditDirty && !creditSaved ? 'credits-save-btn--idle' : ''}`}
                          onClick={() => { void handleCreditSave(student.id) }}
                          disabled={!creditDirty && !creditSaved}
                        >
                          {creditSaved ? 'Salvato ✓' : 'Salva'}
                        </button>
                      </div>
                    </td>
                    <td className="bk-actions">
                      <button className="btn-edit-student" onClick={() => startEdit(student.id)}>
                        Modifica
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

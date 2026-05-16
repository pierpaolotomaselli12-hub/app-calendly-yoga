import { useState, useMemo } from 'react'
import { useApp } from '../../context/AppContext'
import './AdminStudents.css'

export default function AdminStudents() {
  const { students, updateStudentCredits } = useApp()
  const [search, setSearch] = useState('')
  const [creditInputs, setCreditInputs] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {}
    students.forEach(s => { initial[s.id] = String(s.lessonCredits) })
    return initial
  })
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set())

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

  function handleCreditChange(studentId: string, value: string) {
    setCreditInputs(prev => ({ ...prev, [studentId]: value }))
    setSavedIds(prev => { const n = new Set(prev); n.delete(studentId); return n })
  }

  async function handleCreditSave(studentId: string) {
    const raw = creditInputs[studentId]
    const parsed = parseInt(raw, 10)
    if (isNaN(parsed) || parsed < 0) return
    await updateStudentCredits(studentId, parsed)
    setSavedIds(prev => new Set(prev).add(studentId))
  }

  function formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('it-IT', {
      day: '2-digit', month: '2-digit', year: 'numeric',
    })
  }

  return (
    <div className="students-page">
      <div className="students-header">
        <div>
          <h1 className="students-title">Studenti</h1>
          <p className="students-subtitle">{students.length} {students.length === 1 ? 'studente registrato' : 'studenti registrati'}</p>
        </div>
        {students.length > 0 && (
          <input
            className="students-search"
            type="search"
            placeholder="Cerca per nome, email, telefono…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        )}
      </div>

      {students.length === 0 ? (
        <div className="students-empty-state">
          <p className="students-empty-title">Nessuno studente registrato</p>
          <p className="students-empty-sub">Gli studenti appariranno qui dopo la registrazione.</p>
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
                <th className="col-credits">Crediti lezione</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map(student => {
                const isSaved = savedIds.has(student.id)
                const currentVal = creditInputs[student.id] ?? String(student.lessonCredits)
                const isDirty = currentVal !== String(student.lessonCredits) && !isSaved
                return (
                  <tr key={student.id}>
                    <td>
                      <span className="db-student-name">{student.firstName} {student.lastName}</span>
                    </td>
                    <td className="db-student-email">{student.email}</td>
                    <td className="db-student-phone col-phone">{student.phone}</td>
                    <td className="db-student-date col-date">{formatDate(student.createdAt)}</td>
                    <td className="col-credits">
                      <div className="credits-cell">
                        <input
                          className="credits-input"
                          type="number"
                          min={0}
                          value={currentVal}
                          onChange={e => handleCreditChange(student.id, e.target.value)}
                        />
                        <button
                          className={`credits-save-btn ${isSaved ? 'credits-save-btn--saved' : ''} ${!isDirty && !isSaved ? 'credits-save-btn--idle' : ''}`}
                          onClick={() => { void handleCreditSave(student.id) }}
                          disabled={!isDirty && !isSaved}
                        >
                          {isSaved ? 'Salvato ✓' : 'Salva'}
                        </button>
                      </div>
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

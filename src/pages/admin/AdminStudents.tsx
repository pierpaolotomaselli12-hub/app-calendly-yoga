import { useState } from 'react'
import { useApp } from '../../context/AppContext'
import './AdminStudents.css'

function formatDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-')
  return `${d}/${m}/${y}`
}

function formatBookingDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('it-IT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

export default function AdminStudents() {
  const { slots, deleteBooking, waitlist, removeFromWaitlist, students, updateStudentCredits } = useApp()
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [creditInputs, setCreditInputs] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {}
    students.forEach(s => { initial[s.id] = String(s.lessonCredits) })
    return initial
  })

  const slotsWithBookings = [...slots]
    .sort((a, b) => b.date.localeCompare(a.date) || b.time.localeCompare(a.time))

  function toggleExpand(id: string) {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  async function handleDelete(slotId: string, bookingId: string) {
    const key = `${slotId}:${bookingId}`
    if (deleteConfirm === key) {
      await deleteBooking(slotId, bookingId)
      setDeleteConfirm(null)
    } else {
      setDeleteConfirm(key)
    }
  }

  function handleCreditChange(studentId: string, value: string) {
    setCreditInputs(prev => ({ ...prev, [studentId]: value }))
  }

  async function handleCreditSave(studentId: string) {
    const raw = creditInputs[studentId]
    const parsed = parseInt(raw, 10)
    if (isNaN(parsed) || parsed < 0) return
    await updateStudentCredits(studentId, parsed)
  }

  const totalBookings = slots.reduce((sum, s) => sum + s.bookings.length, 0)

  return (
    <div className="students-page">
      <div className="students-header">
        <h1 className="students-title">Studenti</h1>
        <span className="students-total">{totalBookings} prenotazioni totali</span>
      </div>

      <div className="students-registered-section">
        <h2 className="students-registered-title">Studenti Registrati</h2>
        {students.length === 0 ? (
          <p className="students-empty">Nessuno studente registrato.</p>
        ) : (
          <table className="students-registered-table">
            <thead>
              <tr>
                <th>Nome</th>
                <th>Email</th>
                <th>Telefono</th>
                <th>Crediti</th>
              </tr>
            </thead>
            <tbody>
              {students.map(student => (
                <tr key={student.id} className="student-row">
                  <td className="student-name">{student.firstName} {student.lastName}</td>
                  <td className="student-email">{student.email}</td>
                  <td className="student-phone">{student.phone}</td>
                  <td className="student-credits-cell">
                    <input
                      className="credits-input"
                      type="number"
                      min={0}
                      value={creditInputs[student.id] ?? String(student.lessonCredits)}
                      onChange={e => handleCreditChange(student.id, e.target.value)}
                    />
                    <button
                      className="credits-save-btn"
                      onClick={() => { void handleCreditSave(student.id) }}
                    >
                      Salva
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {slotsWithBookings.length === 0 ? (
        <p className="students-empty">Nessuna lezione creata.</p>
      ) : (
        <div className="students-list">
          {slotsWithBookings.map(slot => {
            const isOpen = expanded.has(slot.id)
            const slotWaitlist = waitlist.filter(w => w.slotId === slot.id)
            return (
              <div key={slot.id} className="students-slot">
                <button
                  className="slot-header-btn"
                  onClick={() => toggleExpand(slot.id)}
                >
                  <div className="slot-header-info">
                    <span className="slot-header-title">{slot.title}</span>
                    <span className="slot-header-meta">
                      {formatDate(slot.date)} &middot; {slot.time}
                    </span>
                  </div>
                  <div className="slot-header-right">
                    <span className="slot-header-count">
                      {slot.bookings.length} / {slot.maxParticipants}
                    </span>
                    <span className={`slot-chevron ${isOpen ? 'slot-chevron--open' : ''}`}>
                      ›
                    </span>
                  </div>
                </button>

                {isOpen && (
                  <div className="slot-students">
                    {slot.bookings.length === 0 ? (
                      <p className="no-students">Nessuna prenotazione per questa lezione.</p>
                    ) : (
                      <table className="students-table">
                        <thead>
                          <tr>
                            <th>Nome</th>
                            <th>Email</th>
                            <th>Telefono</th>
                            <th>Prenotato il</th>
                            <th></th>
                          </tr>
                        </thead>
                        <tbody>
                          {slot.bookings.map(booking => {
                            const key = `${slot.id}:${booking.id}`
                            return (
                              <tr key={booking.id}>
                                <td className="student-name">
                                  {booking.firstName} {booking.lastName}
                                </td>
                                <td className="student-email">{booking.email}</td>
                                <td className="student-phone">{booking.phone}</td>
                                <td className="student-date">
                                  {formatBookingDate(booking.createdAt)}
                                </td>
                                <td className="student-actions">
                                  {deleteConfirm === key ? (
                                    <>
                                      <button
                                        className="btn-confirm-delete-sm"
                                        onClick={() => { void handleDelete(slot.id, booking.id) }}
                                      >
                                        Conferma
                                      </button>
                                      <button
                                        className="btn-cancel-xs"
                                        onClick={() => setDeleteConfirm(null)}
                                      >
                                        No
                                      </button>
                                    </>
                                  ) : (
                                    <button
                                      className="btn-danger"
                                      onClick={() => { void handleDelete(slot.id, booking.id) }}
                                    >
                                      Rimuovi
                                    </button>
                                  )}
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    )}

                    {slotWaitlist.length > 0 && (
                      <div className="waitlist-section">
                        <h3 className="waitlist-section__title">Lista d&apos;attesa ({slotWaitlist.length})</h3>
                        <table className="students-table">
                          <thead>
                            <tr>
                              <th>Nome</th>
                              <th>Email</th>
                              <th>Telefono</th>
                              <th>Iscritto il</th>
                              <th></th>
                            </tr>
                          </thead>
                          <tbody>
                            {slotWaitlist.map(entry => (
                              <tr key={entry.id}>
                                <td className="student-name">
                                  {entry.firstName} {entry.lastName}
                                </td>
                                <td className="student-email">{entry.email}</td>
                                <td className="student-phone">{entry.phone}</td>
                                <td className="student-date">
                                  {formatBookingDate(entry.createdAt)}
                                </td>
                                <td className="student-actions">
                                  <button
                                    className="btn-danger"
                                    onClick={() => { void removeFromWaitlist(slot.id, entry.id) }}
                                  >
                                    Rimuovi
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
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

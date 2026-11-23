import { createContext, useContext, useState, useEffect, useMemo, useRef, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import type { Slot, Booking, WaitlistEntry, Student, YogaEvent, EventBooking, EventWaitlistEntry, EventFormData } from '../types'
import { supabase } from '../lib/supabase'

export type LoginResult = 'ok' | 'invalid' | 'no_profile' | 'not_admin' | 'not_confirmed'
export type RegisterResult = 'ok' | 'check_email' | 'email_taken' | 'weak_password' | 'invalid_email' | 'error'

interface AppContextType {
  slots: Slot[]
  waitlist: WaitlistEntry[]
  students: Student[]
  events: YogaEvent[]
  /** true finché non si conoscono sessione, ruolo e primi dati */
  loading: boolean
  addSlot: (data: Omit<Slot, 'id' | 'bookings'>) => Promise<void>
  updateSlot: (id: string, data: Omit<Slot, 'id' | 'bookings'>) => Promise<void>
  deleteSlot: (id: string) => Promise<void>
  duplicateSlot: (id: string, newDate: string) => Promise<void>
  addBooking: (data: Omit<Booking, 'id' | 'createdAt'>) => Promise<void>
  deleteBooking: (slotId: string, bookingId: string) => Promise<void>
  addToWaitlist: (data: Omit<WaitlistEntry, 'id' | 'createdAt'>) => Promise<void>
  removeFromWaitlist: (slotId: string, entryId: string) => Promise<void>
  isAdminLoggedIn: boolean
  adminLogin: (email: string, password: string) => Promise<LoginResult>
  adminSignUp: (email: string, password: string) => Promise<RegisterResult>
  adminLogout: () => Promise<void>
  currentStudent: Student | null
  /** utente Auth loggato (anche senza profilo studente) */
  sessionEmail: string | null
  studentRegister: (data: { firstName: string; lastName: string; email: string; phone: string; password: string }) => Promise<RegisterResult>
  studentLogin: (email: string, password: string) => Promise<LoginResult>
  studentLogout: () => Promise<void>
  requestPasswordReset: (email: string) => Promise<boolean>
  updatePassword: (password: string) => Promise<boolean>
  createStudent: (data: { firstName: string; lastName: string; email: string; phone: string }) => Promise<'ok' | 'email_taken'>
  updateStudent: (id: string, data: { firstName: string; lastName: string; email: string; phone: string }) => Promise<void>
  updateStudentCredits: (studentId: string, credits: number) => Promise<void>
  decrementStudentCredits: (studentId: string) => Promise<void>
  incrementStudentCredits: (studentId: string) => Promise<void>
  addEvent: (data: EventFormData) => Promise<void>
  updateEvent: (id: string, data: EventFormData) => Promise<void>
  deleteEvent: (id: string) => Promise<void>
  addEventBooking: (data: Omit<EventBooking, 'id' | 'createdAt'>) => Promise<void>
  deleteEventBooking: (eventId: string, bookingId: string) => Promise<void>
  addToEventWaitlist: (data: Omit<EventWaitlistEntry, 'id' | 'createdAt'>) => Promise<void>
  removeFromEventWaitlist: (eventId: string, entryId: string) => Promise<void>
}

/** Messaggi in italiano per gli errori delle funzioni del database. */
const ERROR_MESSAGES: Record<string, string> = {
  not_registered: 'Accedi o registrati per continuare.',
  not_found: 'Questa prenotazione non è più disponibile.',
  past: 'Questa lezione è già passata.',
  already_booked: 'Hai già una prenotazione per questa lezione.',
  already_waitlisted: "Sei già in lista d'attesa.",
  full: 'I posti sono finiti: puoi metterti in lista d\'attesa.',
  no_credits: 'Non hai crediti disponibili: chiedi a Laura di ricaricare il pacchetto.',
  too_late: 'La disdetta non è più possibile: scadeva alle 10:00 del giorno della lezione.',
}

/** Errore con messaggio già pronto da mostrare all'utente. */
// eslint-disable-next-line react-refresh/only-export-components
export class AppActionError extends Error {}

async function callRpc(name: string, args: Record<string, unknown>): Promise<void> {
  const { error } = await supabase.rpc(name, args)
  if (error) {
    const code = Object.keys(ERROR_MESSAGES).find(k => error.message.includes(k))
    throw new AppActionError(code ? ERROR_MESSAGES[code] : 'Qualcosa non ha funzionato. Riprova tra poco.')
  }
}

function mapRegisterError(message: string): RegisterResult {
  const m = message.toLowerCase()
  if (m.includes('already') || m.includes('registered') || m.includes('email_taken')) return 'email_taken'
  if (m.includes('password')) return 'weak_password'
  if (m.includes('email')) return 'invalid_email'
  return 'error'
}

/** Aggiunge voci anonime fino al totale, così .length conta tutti i posti occupati senza esporre dati altrui. */
function padTo<T>(own: T[], total: number, make: (i: number) => T): T[] {
  const extra = Math.max(0, total - own.length)
  return extra === 0 ? own : [...own, ...Array.from({ length: extra }, (_, i) => make(i))]
}

const AppContext = createContext<AppContextType | null>(null)

function mapBooking(raw: Record<string, unknown>): Booking {
  return {
    id: raw.id as string,
    slotId: raw.slot_id as string,
    firstName: raw.first_name as string,
    lastName: raw.last_name as string,
    email: raw.email as string,
    phone: raw.phone as string,
    createdAt: raw.created_at as string,
  }
}

function mapWaitlistEntry(raw: Record<string, unknown>): WaitlistEntry {
  return {
    id: raw.id as string,
    slotId: raw.slot_id as string,
    firstName: raw.first_name as string,
    lastName: raw.last_name as string,
    email: raw.email as string,
    phone: raw.phone as string,
    createdAt: raw.created_at as string,
  }
}

function mapSlot(raw: Record<string, unknown>): Slot {
  return {
    id: raw.id as string,
    title: raw.title as string,
    type: (raw.type as string) || '',
    date: raw.date as string,
    time: (raw.time as string).slice(0, 5),
    duration: raw.duration as number,
    maxParticipants: raw.max_participants as number,
    notes: (raw.notes as string) || '',
    imageUrl: (raw.image_url as string) || '',
    bookings: ((raw.bookings as Record<string, unknown>[]) || []).map(mapBooking),
  }
}

function mapStudent(raw: Record<string, unknown>): Student {
  return {
    id: raw.id as string,
    firstName: raw.first_name as string,
    lastName: raw.last_name as string,
    email: raw.email as string,
    phone: raw.phone as string,
    lessonCredits: raw.lesson_credits as number,
    createdAt: raw.created_at as string,
    userId: (raw.user_id as string | null) ?? null,
  }
}

function mapEventBooking(raw: Record<string, unknown>): EventBooking {
  return {
    id: raw.id as string,
    eventId: raw.event_id as string,
    firstName: raw.first_name as string,
    lastName: raw.last_name as string,
    email: raw.email as string,
    phone: raw.phone as string,
    createdAt: raw.created_at as string,
  }
}

function mapEventWaitlistEntry(raw: Record<string, unknown>): EventWaitlistEntry {
  return {
    id: raw.id as string,
    eventId: raw.event_id as string,
    firstName: raw.first_name as string,
    lastName: raw.last_name as string,
    email: raw.email as string,
    phone: raw.phone as string,
    createdAt: raw.created_at as string,
  }
}

function mapEvent(raw: Record<string, unknown>): YogaEvent {
  return {
    id: raw.id as string,
    title: raw.title as string,
    description: (raw.description as string) || '',
    date: raw.date as string,
    time: (raw.time as string).slice(0, 5),
    location: (raw.location as string) || '',
    price: (raw.price as string) || '',
    notes: (raw.notes as string) || '',
    imageUrl: (raw.image_url as string) || '',
    maxParticipants: (raw.max_participants as number) || 0,
    bookings: ((raw.event_bookings as Record<string, unknown>[]) || []).map(mapEventBooking),
    waitlist: ((raw.event_waitlist as Record<string, unknown>[]) || []).map(mapEventWaitlistEntry),
    createdAt: raw.created_at as string,
  }
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [slots, setSlots] = useState<Slot[]>([])
  const [waitlist, setWaitlist] = useState<WaitlistEntry[]>([])
  const [students, setStudents] = useState<Student[]>([])
  const [events, setEvents] = useState<YogaEvent[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState<boolean>(false)
  /** undefined = sessione non ancora letta */
  const [session, setSession] = useState<Session | null | undefined>(undefined)
  const isAdminRef = useRef(false)

  // Pulizia delle vecchie "sessioni" salvate nel browser prima di Supabase Auth
  useEffect(() => {
    try {
      localStorage.removeItem('yoga_admin')
      localStorage.removeItem('yoga_student_session')
    } catch { /* storage non disponibile */ }
  }, [])

  async function fetchAll(): Promise<void> {
    const [
      { data: slotsData },
      { data: waitlistData },
      { data: studentsData },
      { data: eventsData },
      { data: slotCounts },
      { data: eventCounts },
    ] = await Promise.all([
      supabase.from('slots').select('*, bookings(*)').order('date', { ascending: true }),
      supabase.from('waitlist').select('*').order('created_at', { ascending: true }),
      supabase.from('students').select('*').order('created_at', { ascending: true }),
      supabase.from('events').select('*, event_bookings(*), event_waitlist(*)').order('date', { ascending: true }),
      supabase.rpc('slot_counts'),
      supabase.rpc('event_counts'),
    ])

    const slotTotals = new Map<string, number>(
      ((slotCounts ?? []) as { slot_id: string; booked: number }[]).map(c => [c.slot_id, c.booked]),
    )
    const eventTotals = new Map<string, { booked: number; waiting: number }>(
      ((eventCounts ?? []) as { event_id: string; booked: number; waiting: number }[]).map(c => [c.event_id, c]),
    )

    // Chi non è admin vede solo le proprie prenotazioni: completiamo con voci anonime fino al totale
    setSlots((slotsData ?? []).map(raw => {
      const s = mapSlot(raw as Record<string, unknown>)
      const total = slotTotals.get(s.id) ?? s.bookings.length
      return {
        ...s,
        bookings: padTo(s.bookings, total, i => ({
          id: `anon-${s.id}-${i}`, slotId: s.id, firstName: '', lastName: '', email: '', phone: '', createdAt: '',
        })),
      }
    }))
    setWaitlist((waitlistData ?? []).map(w => mapWaitlistEntry(w as Record<string, unknown>)))
    setStudents((studentsData ?? []).map(s => mapStudent(s as Record<string, unknown>)))
    setEvents((eventsData ?? []).map(raw => {
      const e = mapEvent(raw as Record<string, unknown>)
      const t = eventTotals.get(e.id)
      return {
        ...e,
        bookings: padTo(e.bookings, t?.booked ?? e.bookings.length, i => ({
          id: `anon-${e.id}-b${i}`, eventId: e.id, firstName: '', lastName: '', email: '', phone: '', createdAt: '',
        })),
        waitlist: padTo(e.waitlist, t?.waiting ?? e.waitlist.length, i => ({
          id: `anon-${e.id}-w${i}`, eventId: e.id, firstName: '', lastName: '', email: '', phone: '', createdAt: '',
        })),
      }
    }))
  }

  // Sessione Supabase Auth
  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  // A ogni cambio di utente: ruolo admin verificato dal server + dati ricaricati
  const userId = session?.user.id ?? null
  useEffect(() => {
    if (session === undefined) return
    let cancelled = false
    void (async () => {
      let admin = false
      if (userId) {
        const { data } = await supabase.rpc('is_admin')
        admin = data === true
      }
      await fetchAll()
      if (cancelled) return
      isAdminRef.current = admin
      setIsAdminLoggedIn(admin)
      setLoading(false)
    })()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, session === undefined])

  // Aggiornamenti in tempo reale
  useEffect(() => {
    const channel = supabase
      .channel('db-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'slots' }, () => { void fetchAll() })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, () => { void fetchAll() })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'waitlist' }, () => { void fetchAll() })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'students' }, () => { void fetchAll() })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'events' }, () => { void fetchAll() })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'event_bookings' }, () => { void fetchAll() })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'event_waitlist' }, () => { void fetchAll() })
      .subscribe()
    return () => { void supabase.removeChannel(channel) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const currentStudent = useMemo<Student | null>(
    () => (userId ? students.find(s => s.userId === userId) ?? null : null),
    [students, userId],
  )
  const sessionEmail = session?.user.email ?? null

  // ── Lezioni (solo admin, protette dalle policy) ──

  async function addSlot(data: Omit<Slot, 'id' | 'bookings'>) {
    await supabase.from('slots').insert({
      title: data.title, type: data.type, date: data.date, time: data.time,
      duration: data.duration, max_participants: data.maxParticipants, notes: data.notes,
      ...(data.imageUrl ? { image_url: data.imageUrl } : {}),
    })
    await fetchAll()
  }

  async function updateSlot(id: string, data: Omit<Slot, 'id' | 'bookings'>) {
    await supabase.from('slots').update({
      title: data.title, type: data.type, date: data.date, time: data.time,
      duration: data.duration, max_participants: data.maxParticipants, notes: data.notes,
      ...(data.imageUrl ? { image_url: data.imageUrl } : { image_url: null }),
    }).eq('id', id)
    await fetchAll()
  }

  async function deleteSlot(id: string) {
    await supabase.from('slots').delete().eq('id', id)
    await fetchAll()
  }

  async function duplicateSlot(id: string, newDate: string) {
    const original = slots.find(s => s.id === id)
    if (!original) return
    await supabase.from('slots').insert({
      title: original.title, type: original.type, date: newDate, time: original.time,
      duration: original.duration, max_participants: original.maxParticipants, notes: original.notes,
      ...(original.imageUrl ? { image_url: original.imageUrl } : {}),
    })
    await fetchAll()
  }

  // ── Prenotazioni: l'admin scrive direttamente, lo studente passa dalle funzioni del database ──

  async function addBooking(data: Omit<Booking, 'id' | 'createdAt'>) {
    if (isAdminRef.current) {
      await supabase.from('bookings').insert({
        slot_id: data.slotId, first_name: data.firstName, last_name: data.lastName,
        email: data.email, phone: data.phone,
      })
    } else {
      await callRpc('book_slot', { p_slot_id: data.slotId }) // scala anche il credito
    }
    await fetchAll()
  }

  async function deleteBooking(_slotId: string, bookingId: string) {
    if (isAdminRef.current) {
      await supabase.from('bookings').delete().eq('id', bookingId)
    } else {
      await callRpc('cancel_booking', { p_booking_id: bookingId }) // restituisce anche il credito
    }
    await fetchAll()
  }

  async function addToWaitlist(data: Omit<WaitlistEntry, 'id' | 'createdAt'>) {
    if (isAdminRef.current) {
      await supabase.from('waitlist').insert({
        slot_id: data.slotId, first_name: data.firstName, last_name: data.lastName,
        email: data.email, phone: data.phone,
      })
    } else {
      await callRpc('join_waitlist', { p_slot_id: data.slotId })
    }
    await fetchAll()
  }

  async function removeFromWaitlist(_slotId: string, entryId: string) {
    if (isAdminRef.current) {
      await supabase.from('waitlist').delete().eq('id', entryId)
    } else {
      await callRpc('leave_waitlist', { p_entry_id: entryId })
    }
    await fetchAll()
  }

  // ── Accesso ──

  async function adminLogin(email: string, password: string): Promise<LoginResult> {
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    if (error) return error.message.toLowerCase().includes('not confirmed') ? 'not_confirmed' : 'invalid'
    const { data } = await supabase.rpc('is_admin')
    if (data !== true) {
      await supabase.auth.signOut()
      return 'not_admin'
    }
    isAdminRef.current = true
    setIsAdminLoggedIn(true)
    return 'ok'
  }

  async function adminSignUp(email: string, password: string): Promise<RegisterResult> {
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(), password,
      options: { emailRedirectTo: `${window.location.origin}/admin/login` },
    })
    if (error) return mapRegisterError(error.message)
    if (!data.session) return 'check_email'
    await supabase.auth.signOut() // l'accesso admin va abilitato prima di poter entrare
    return 'ok'
  }

  async function adminLogout() {
    await supabase.auth.signOut()
    isAdminRef.current = false
    setIsAdminLoggedIn(false)
  }

  async function studentRegister(data: { firstName: string; lastName: string; email: string; phone: string; password: string }): Promise<RegisterResult> {
    const email = data.email.trim()
    const { data: res, error } = await supabase.auth.signUp({
      email,
      password: data.password,
      options: {
        // il profilo studente lo crea il database alla conferma dell'email (trigger on_auth_user_confirmed)
        data: { first_name: data.firstName.trim(), last_name: data.lastName.trim(), phone: data.phone.trim() },
        emailRedirectTo: `${window.location.origin}/accedi`,
      },
    })
    if (error) return mapRegisterError(error.message)
    // Supabase non rivela se l'email esiste già: in quel caso restituisce un utente senza identità
    if (res.user && res.user.identities && res.user.identities.length === 0) return 'email_taken'
    if (!res.session) return 'check_email'
    // conferma email disattivata sul progetto: profilo creato subito
    const { error: regError } = await supabase.rpc('register_student', {
      p_first_name: data.firstName.trim(), p_last_name: data.lastName.trim(), p_phone: data.phone.trim(),
    })
    if (regError) {
      await supabase.auth.signOut()
      return regError.message.includes('email_taken') ? 'email_taken' : 'error'
    }
    await fetchAll()
    return 'ok'
  }

  async function studentLogin(email: string, password: string): Promise<LoginResult> {
    const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    if (error) return error.message.toLowerCase().includes('not confirmed') ? 'not_confirmed' : 'invalid'
    if (!data.user) return 'invalid'
    const { data: row } = await supabase.from('students').select('id').eq('user_id', data.user.id).maybeSingle()
    await fetchAll()
    return row ? 'ok' : 'no_profile'
  }

  async function studentLogout() {
    await supabase.auth.signOut()
  }

  async function requestPasswordReset(email: string): Promise<boolean> {
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reimposta-password`,
    })
    return !error
  }

  async function updatePassword(password: string): Promise<boolean> {
    const { error } = await supabase.auth.updateUser({ password })
    return !error
  }

  // ── Crediti: modificabili solo dall'admin; per lo studente li gestiscono le funzioni del database ──

  async function updateStudentCredits(studentId: string, credits: number) {
    await supabase.from('students').update({ lesson_credits: credits }).eq('id', studentId)
    await fetchAll()
  }

  async function decrementStudentCredits(studentId: string) {
    if (isAdminRef.current) {
      const target = students.find(s => s.id === studentId)
      if (target && target.lessonCredits > 0) {
        await supabase.from('students').update({ lesson_credits: target.lessonCredits - 1 }).eq('id', studentId)
      }
    }
    await fetchAll()
  }

  async function incrementStudentCredits(studentId: string) {
    if (isAdminRef.current) {
      const target = students.find(s => s.id === studentId)
      if (target) {
        await supabase.from('students').update({ lesson_credits: target.lessonCredits + 1 }).eq('id', studentId)
      }
    }
    await fetchAll()
  }

  async function createStudent(data: { firstName: string; lastName: string; email: string; phone: string }): Promise<'ok' | 'email_taken'> {
    const existing = students.find(s => s.email.toLowerCase() === data.email.toLowerCase())
    if (existing) return 'email_taken'
    await supabase.from('students').insert({
      first_name: data.firstName, last_name: data.lastName, email: data.email.trim().toLowerCase(), phone: data.phone,
    })
    await fetchAll()
    return 'ok'
  }

  async function updateStudent(id: string, data: { firstName: string; lastName: string; email: string; phone: string }) {
    await supabase.from('students').update({
      first_name: data.firstName, last_name: data.lastName, email: data.email, phone: data.phone,
    }).eq('id', id)
    await fetchAll()
  }

  // ── Eventi ──

  async function addEvent(data: EventFormData) {
    await supabase.from('events').insert({
      title: data.title, description: data.description, date: data.date, time: data.time,
      location: data.location, price: data.price, notes: data.notes, max_participants: data.maxParticipants,
      ...(data.imageUrl ? { image_url: data.imageUrl } : {}),
    })
    await fetchAll()
  }

  async function updateEvent(id: string, data: EventFormData) {
    await supabase.from('events').update({
      title: data.title, description: data.description, date: data.date, time: data.time,
      location: data.location, price: data.price, notes: data.notes, max_participants: data.maxParticipants,
      ...(data.imageUrl ? { image_url: data.imageUrl } : { image_url: null }),
    }).eq('id', id)
    await fetchAll()
  }

  async function deleteEvent(id: string) {
    await supabase.from('events').delete().eq('id', id)
    await fetchAll()
  }

  async function addEventBooking(data: Omit<EventBooking, 'id' | 'createdAt'>) {
    if (isAdminRef.current) {
      await supabase.from('event_bookings').insert({
        event_id: data.eventId, first_name: data.firstName, last_name: data.lastName,
        email: data.email, phone: data.phone,
      })
    } else {
      await callRpc('book_event', { p_event_id: data.eventId })
    }
    await fetchAll()
  }

  async function deleteEventBooking(_eventId: string, bookingId: string) {
    if (isAdminRef.current) {
      await supabase.from('event_bookings').delete().eq('id', bookingId)
    } else {
      await callRpc('cancel_event_booking', { p_booking_id: bookingId })
    }
    await fetchAll()
  }

  async function addToEventWaitlist(data: Omit<EventWaitlistEntry, 'id' | 'createdAt'>) {
    if (isAdminRef.current) {
      await supabase.from('event_waitlist').insert({
        event_id: data.eventId, first_name: data.firstName, last_name: data.lastName,
        email: data.email, phone: data.phone,
      })
    } else {
      await callRpc('join_event_waitlist', { p_event_id: data.eventId })
    }
    await fetchAll()
  }

  async function removeFromEventWaitlist(_eventId: string, entryId: string) {
    if (isAdminRef.current) {
      await supabase.from('event_waitlist').delete().eq('id', entryId)
    } else {
      await callRpc('leave_event_waitlist', { p_entry_id: entryId })
    }
    await fetchAll()
  }

  return (
    <AppContext.Provider value={{
      slots, waitlist, students, events, loading,
      addSlot, updateSlot, deleteSlot, duplicateSlot,
      addBooking, deleteBooking, addToWaitlist, removeFromWaitlist,
      isAdminLoggedIn, adminLogin, adminSignUp, adminLogout,
      currentStudent, sessionEmail, studentRegister, studentLogin, studentLogout,
      requestPasswordReset, updatePassword,
      createStudent, updateStudent,
      updateStudentCredits, decrementStudentCredits, incrementStudentCredits,
      addEvent, updateEvent, deleteEvent,
      addEventBooking, deleteEventBooking, addToEventWaitlist, removeFromEventWaitlist,
    }}>
      {children}
    </AppContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useApp(): AppContextType {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used within AppProvider')
  return ctx
}

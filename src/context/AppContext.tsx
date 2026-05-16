import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'
import type { Slot, Booking, WaitlistEntry, Student, YogaEvent } from '../types'
import { supabase } from '../lib/supabase'

interface AppContextType {
  slots: Slot[]
  waitlist: WaitlistEntry[]
  students: Student[]
  events: YogaEvent[]
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
  adminLogin: (password: string) => boolean
  adminLogout: () => void
  currentStudent: Student | null
  studentRegister: (data: { firstName: string; lastName: string; email: string; phone: string }) => Promise<'ok' | 'email_taken'>
  studentLogin: (email: string) => Promise<Student | null>
  studentLogout: () => void
  createStudent: (data: { firstName: string; lastName: string; email: string; phone: string }) => Promise<'ok' | 'email_taken'>
  updateStudent: (id: string, data: { firstName: string; lastName: string; email: string; phone: string }) => Promise<void>
  updateStudentCredits: (studentId: string, credits: number) => Promise<void>
  decrementStudentCredits: (studentId: string) => Promise<void>
  incrementStudentCredits: (studentId: string) => Promise<void>
  addEvent: (data: Omit<YogaEvent, 'id' | 'createdAt'>) => Promise<void>
  updateEvent: (id: string, data: Omit<YogaEvent, 'id' | 'createdAt'>) => Promise<void>
  deleteEvent: (id: string) => Promise<void>
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
  }
}

function loadAdminStatus(): boolean {
  return localStorage.getItem('yoga_admin') === 'true'
}

function loadCurrentStudent(): Student | null {
  try {
    const raw = localStorage.getItem('yoga_student_session')
    if (!raw) return null
    return JSON.parse(raw) as Student
  } catch {
    return null
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
    createdAt: raw.created_at as string,
  }
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [slots, setSlots] = useState<Slot[]>([])
  const [waitlist, setWaitlist] = useState<WaitlistEntry[]>([])
  const [students, setStudents] = useState<Student[]>([])
  const [events, setEvents] = useState<YogaEvent[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState<boolean>(loadAdminStatus)
  const [currentStudent, setCurrentStudent] = useState<Student | null>(loadCurrentStudent)

  useEffect(() => {
    localStorage.setItem('yoga_admin', String(isAdminLoggedIn))
  }, [isAdminLoggedIn])

  async function fetchAll(): Promise<Student[]> {
    setLoading(true)

    const { data: slotsData } = await supabase
      .from('slots')
      .select('*, bookings(*)')
      .order('date', { ascending: true })

    const { data: waitlistData } = await supabase
      .from('waitlist')
      .select('*')
      .order('created_at', { ascending: true })

    const { data: studentsData } = await supabase
      .from('students')
      .select('*')
      .order('created_at', { ascending: true })

    const { data: eventsData } = await supabase
      .from('events')
      .select('*')
      .order('date', { ascending: true })

    setSlots((slotsData ?? []).map(s => mapSlot(s as Record<string, unknown>)))
    setWaitlist((waitlistData ?? []).map(w => mapWaitlistEntry(w as Record<string, unknown>)))
    const freshStudents = (studentsData ?? []).map(s => mapStudent(s as Record<string, unknown>))
    setStudents(freshStudents)
    setEvents((eventsData ?? []).map(e => mapEvent(e as Record<string, unknown>)))
    setLoading(false)
    return freshStudents
  }

  function applySyncCurrentStudent(freshStudents: Student[], prev: Student | null): Student | null {
    if (!prev) return null
    const updated = freshStudents.find(s => s.id === prev.id)
    if (!updated) return prev
    localStorage.setItem('yoga_student_session', JSON.stringify(updated))
    return updated
  }

  useEffect(() => {
    void fetchAll().then(fresh => {
      setCurrentStudent(prev => applySyncCurrentStudent(fresh, prev))
    })
  }, [])

  useEffect(() => {
    const channel = supabase
      .channel('db-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'slots' }, () => { void fetchAll() })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, () => { void fetchAll() })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'waitlist' }, () => { void fetchAll() })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'students' }, () => {
        void fetchAll().then(fresh => {
          setCurrentStudent(prev => applySyncCurrentStudent(fresh, prev))
        })
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'events' }, () => { void fetchAll() })
      .subscribe()

    return () => { void supabase.removeChannel(channel) }
  }, [])

  async function addSlot(data: Omit<Slot, 'id' | 'bookings'>) {
    await supabase.from('slots').insert({
      title: data.title,
      type: data.type,
      date: data.date,
      time: data.time,
      duration: data.duration,
      max_participants: data.maxParticipants,
      notes: data.notes,
    })
    await fetchAll()
  }

  async function updateSlot(id: string, data: Omit<Slot, 'id' | 'bookings'>) {
    await supabase.from('slots').update({
      title: data.title,
      type: data.type,
      date: data.date,
      time: data.time,
      duration: data.duration,
      max_participants: data.maxParticipants,
      notes: data.notes,
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
      title: original.title,
      type: original.type,
      date: newDate,
      time: original.time,
      duration: original.duration,
      max_participants: original.maxParticipants,
      notes: original.notes,
    })
    await fetchAll()
  }

  async function addBooking(data: Omit<Booking, 'id' | 'createdAt'>) {
    await supabase.from('bookings').insert({
      slot_id: data.slotId,
      first_name: data.firstName,
      last_name: data.lastName,
      email: data.email,
      phone: data.phone,
    })
    await fetchAll()
  }

  async function deleteBooking(_slotId: string, bookingId: string) {
    await supabase.from('bookings').delete().eq('id', bookingId)
    await fetchAll()
  }

  async function addToWaitlist(data: Omit<WaitlistEntry, 'id' | 'createdAt'>) {
    await supabase.from('waitlist').insert({
      slot_id: data.slotId,
      first_name: data.firstName,
      last_name: data.lastName,
      email: data.email,
      phone: data.phone,
    })
    await fetchAll()
  }

  async function removeFromWaitlist(_slotId: string, entryId: string) {
    await supabase.from('waitlist').delete().eq('id', entryId)
    await fetchAll()
  }

  function adminLogin(password: string): boolean {
    if (password === 'yoga2024') {
      setIsAdminLoggedIn(true)
      return true
    }
    return false
  }

  function adminLogout() {
    setIsAdminLoggedIn(false)
  }

  async function studentRegister(data: { firstName: string; lastName: string; email: string; phone: string }): Promise<'ok' | 'email_taken'> {
    const existing = students.find(s => s.email.toLowerCase() === data.email.toLowerCase())
    if (existing) return 'email_taken'
    await supabase.from('students').insert({
      first_name: data.firstName,
      last_name: data.lastName,
      email: data.email,
      phone: data.phone,
    })
    await fetchAll()
    return 'ok'
  }

  async function studentLogin(email: string): Promise<Student | null> {
    const { data } = await supabase
      .from('students')
      .select('*')
      .ilike('email', email)
      .maybeSingle()

    if (!data) return null
    const student = mapStudent(data as Record<string, unknown>)
    setCurrentStudent(student)
    localStorage.setItem('yoga_student_session', JSON.stringify(student))
    return student
  }

  function studentLogout() {
    localStorage.removeItem('yoga_student_session')
    setCurrentStudent(null)
  }

  async function updateStudentCredits(studentId: string, credits: number) {
    await supabase
      .from('students')
      .update({ lesson_credits: credits })
      .eq('id', studentId)
    const fresh = await fetchAll()
    setCurrentStudent(prev => applySyncCurrentStudent(fresh, prev))
  }

  async function decrementStudentCredits(studentId: string) {
    const target = students.find(s => s.id === studentId)
    if (!target || target.lessonCredits <= 0) return
    await supabase
      .from('students')
      .update({ lesson_credits: target.lessonCredits - 1 })
      .eq('id', studentId)
    const fresh = await fetchAll()
    setCurrentStudent(prev => applySyncCurrentStudent(fresh, prev))
  }

  async function incrementStudentCredits(studentId: string) {
    const target = students.find(s => s.id === studentId)
    if (!target) return
    await supabase
      .from('students')
      .update({ lesson_credits: target.lessonCredits + 1 })
      .eq('id', studentId)
    const fresh = await fetchAll()
    setCurrentStudent(prev => applySyncCurrentStudent(fresh, prev))
  }

  async function createStudent(data: { firstName: string; lastName: string; email: string; phone: string }): Promise<'ok' | 'email_taken'> {
    const existing = students.find(s => s.email.toLowerCase() === data.email.toLowerCase())
    if (existing) return 'email_taken'
    await supabase.from('students').insert({
      first_name: data.firstName,
      last_name: data.lastName,
      email: data.email,
      phone: data.phone,
    })
    await fetchAll()
    return 'ok'
  }

  async function updateStudent(id: string, data: { firstName: string; lastName: string; email: string; phone: string }) {
    await supabase.from('students').update({
      first_name: data.firstName,
      last_name: data.lastName,
      email: data.email,
      phone: data.phone,
    }).eq('id', id)
    const fresh = await fetchAll()
    setCurrentStudent(prev => applySyncCurrentStudent(fresh, prev))
  }

  async function addEvent(data: Omit<YogaEvent, 'id' | 'createdAt'>) {
    await supabase.from('events').insert({
      title: data.title,
      description: data.description,
      date: data.date,
      time: data.time,
      location: data.location,
      price: data.price,
      notes: data.notes,
    })
    await fetchAll()
  }

  async function updateEvent(id: string, data: Omit<YogaEvent, 'id' | 'createdAt'>) {
    await supabase.from('events').update({
      title: data.title,
      description: data.description,
      date: data.date,
      time: data.time,
      location: data.location,
      price: data.price,
      notes: data.notes,
    }).eq('id', id)
    await fetchAll()
  }

  async function deleteEvent(id: string) {
    await supabase.from('events').delete().eq('id', id)
    await fetchAll()
  }

  return (
    <AppContext.Provider
      value={{
        slots,
        waitlist,
        students,
        events,
        loading,
        addSlot,
        updateSlot,
        deleteSlot,
        duplicateSlot,
        addBooking,
        deleteBooking,
        addToWaitlist,
        removeFromWaitlist,
        isAdminLoggedIn,
        adminLogin,
        adminLogout,
        currentStudent,
        studentRegister,
        studentLogin,
        studentLogout,
        createStudent,
        updateStudent,
        updateStudentCredits,
        decrementStudentCredits,
        incrementStudentCredits,
        addEvent,
        updateEvent,
        deleteEvent,
      }}
    >
      {children}
    </AppContext.Provider>
  )
}

export function useApp(): AppContextType {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used within AppProvider')
  return ctx
}

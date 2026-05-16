import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'
import type { Slot, Booking, WaitlistEntry } from '../types'
import { supabase } from '../lib/supabase'

interface AppContextType {
  slots: Slot[]
  waitlist: WaitlistEntry[]
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

function loadAdminStatus(): boolean {
  return localStorage.getItem('yoga_admin') === 'true'
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [slots, setSlots] = useState<Slot[]>([])
  const [waitlist, setWaitlist] = useState<WaitlistEntry[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState<boolean>(loadAdminStatus)

  useEffect(() => {
    localStorage.setItem('yoga_admin', String(isAdminLoggedIn))
  }, [isAdminLoggedIn])

  async function fetchAll() {
    setLoading(true)

    const { data: slotsData } = await supabase
      .from('slots')
      .select('*, bookings(*)')
      .order('date', { ascending: true })

    const { data: waitlistData } = await supabase
      .from('waitlist')
      .select('*')
      .order('created_at', { ascending: true })

    setSlots((slotsData ?? []).map(s => mapSlot(s as Record<string, unknown>)))
    setWaitlist((waitlistData ?? []).map(w => mapWaitlistEntry(w as Record<string, unknown>)))
    setLoading(false)
  }

  useEffect(() => {
    fetchAll()
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

  return (
    <AppContext.Provider
      value={{
        slots,
        waitlist,
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

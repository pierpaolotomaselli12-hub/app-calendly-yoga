import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'
import type { Slot, Booking, WaitlistEntry } from '../types'

interface AppContextType {
  slots: Slot[]
  addSlot: (slot: Omit<Slot, 'id' | 'bookings'>) => void
  deleteSlot: (id: string) => void
  updateSlot: (id: string, data: Omit<Slot, 'id' | 'bookings'>) => void
  duplicateSlot: (id: string, newDate: string) => void
  addBooking: (booking: Omit<Booking, 'id' | 'createdAt'>) => void
  deleteBooking: (slotId: string, bookingId: string) => void
  waitlist: WaitlistEntry[]
  addToWaitlist: (entry: Omit<WaitlistEntry, 'id' | 'createdAt'>) => void
  removeFromWaitlist: (slotId: string, entryId: string) => void
  isAdminLoggedIn: boolean
  adminLogin: (password: string) => boolean
  adminLogout: () => void
}

const AppContext = createContext<AppContextType | null>(null)

function migrateSlot(raw: Slot): Slot {
  return {
    ...raw,
    type: raw.type ?? '',
  }
}

function loadSlots(): Slot[] {
  try {
    const raw = localStorage.getItem('yoga_slots')
    const parsed: Slot[] = raw ? JSON.parse(raw) : []
    return parsed.map(migrateSlot)
  } catch {
    return []
  }
}

function loadWaitlist(): WaitlistEntry[] {
  try {
    const raw = localStorage.getItem('yoga_waitlist')
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function loadAdminStatus(): boolean {
  return localStorage.getItem('yoga_admin') === 'true'
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [slots, setSlots] = useState<Slot[]>(loadSlots)
  const [waitlist, setWaitlist] = useState<WaitlistEntry[]>(loadWaitlist)
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState<boolean>(loadAdminStatus)

  useEffect(() => {
    localStorage.setItem('yoga_slots', JSON.stringify(slots))
  }, [slots])

  useEffect(() => {
    localStorage.setItem('yoga_waitlist', JSON.stringify(waitlist))
  }, [waitlist])

  useEffect(() => {
    localStorage.setItem('yoga_admin', String(isAdminLoggedIn))
  }, [isAdminLoggedIn])

  function addSlot(slotData: Omit<Slot, 'id' | 'bookings'>) {
    const newSlot: Slot = {
      ...slotData,
      id: crypto.randomUUID(),
      bookings: [],
    }
    setSlots(prev => [...prev, newSlot])
  }

  function deleteSlot(id: string) {
    setSlots(prev => prev.filter(s => s.id !== id))
  }

  function updateSlot(id: string, data: Omit<Slot, 'id' | 'bookings'>) {
    setSlots(prev =>
      prev.map(s =>
        s.id === id ? { ...s, ...data } : s
      )
    )
  }

  function duplicateSlot(id: string, newDate: string) {
    const original = slots.find(s => s.id === id)
    if (!original) return
    const copy: Slot = {
      ...original,
      id: crypto.randomUUID(),
      date: newDate,
      bookings: [],
    }
    setSlots(prev => [...prev, copy])
  }

  function addBooking(bookingData: Omit<Booking, 'id' | 'createdAt'>) {
    const newBooking: Booking = {
      ...bookingData,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    }
    setSlots(prev =>
      prev.map(s =>
        s.id === bookingData.slotId
          ? { ...s, bookings: [...s.bookings, newBooking] }
          : s
      )
    )
  }

  function deleteBooking(slotId: string, bookingId: string) {
    setSlots(prev =>
      prev.map(s =>
        s.id === slotId
          ? { ...s, bookings: s.bookings.filter(b => b.id !== bookingId) }
          : s
      )
    )
  }

  function addToWaitlist(entryData: Omit<WaitlistEntry, 'id' | 'createdAt'>) {
    const newEntry: WaitlistEntry = {
      ...entryData,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    }
    setWaitlist(prev => [...prev, newEntry])
  }

  function removeFromWaitlist(slotId: string, entryId: string) {
    setWaitlist(prev =>
      prev.filter(e => !(e.slotId === slotId && e.id === entryId))
    )
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
        addSlot,
        deleteSlot,
        updateSlot,
        duplicateSlot,
        addBooking,
        deleteBooking,
        waitlist,
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

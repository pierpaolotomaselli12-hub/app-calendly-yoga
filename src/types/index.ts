export interface Booking {
  id: string
  slotId: string
  firstName: string
  lastName: string
  email: string
  phone: string
  createdAt: string
}

export interface Slot {
  id: string
  title: string
  date: string
  time: string
  duration: number
  maxParticipants: number
  notes: string
  bookings: Booking[]
}

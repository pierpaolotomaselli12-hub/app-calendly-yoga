export interface Student {
  id: string
  firstName: string
  lastName: string
  email: string
  phone: string
  lessonCredits: number
  createdAt: string
}

export interface Booking {
  id: string
  slotId: string
  firstName: string
  lastName: string
  email: string
  phone: string
  createdAt: string
}

export interface WaitlistEntry {
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
  type: string
  date: string
  time: string
  duration: number
  maxParticipants: number
  notes: string
  imageUrl: string
  bookings: Booking[]
}

export interface EventBooking {
  id: string
  eventId: string
  firstName: string
  lastName: string
  email: string
  phone: string
  createdAt: string
}

export interface EventWaitlistEntry {
  id: string
  eventId: string
  firstName: string
  lastName: string
  email: string
  phone: string
  createdAt: string
}

export interface YogaEvent {
  id: string
  title: string
  description: string
  date: string
  time: string
  location: string
  price: string
  notes: string
  imageUrl: string
  maxParticipants: number
  bookings: EventBooking[]
  waitlist: EventWaitlistEntry[]
  createdAt: string
}

export type EventFormData = Omit<YogaEvent, 'id' | 'createdAt' | 'bookings' | 'waitlist'>

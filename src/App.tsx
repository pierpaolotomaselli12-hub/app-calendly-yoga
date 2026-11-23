import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AppProvider } from './context/AppContext'
import AdminLogin from './pages/admin/AdminLogin'
import AdminDashboard from './pages/admin/AdminDashboard'
import AdminSlots from './pages/admin/AdminSlots'
import AdminStudents from './pages/admin/AdminStudents'
import AdminBookings from './pages/admin/AdminBookings'
import AdminEvents from './pages/admin/AdminEvents'
import AdminLayout from './components/admin/AdminLayout'
import Home from './pages/public/Home'
import Landing from './pages/public/Landing'
import { LESSONS_PATH } from './lib/navigation'
import BookingPage from './pages/public/BookingPage'
import EventBookingPage from './pages/public/EventBookingPage'
import BookingConfirmed from './pages/public/BookingConfirmed'
import CancelPage from './pages/public/CancelPage'
import RegisterPage from './pages/public/RegisterPage'
import StudentLoginPage from './pages/public/StudentLoginPage'

function App() {
  return (
    <AppProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path={LESSONS_PATH} element={<Home />} />
          <Route path="/book/:slotId" element={<BookingPage />} />
          <Route path="/eventi/:eventId" element={<EventBookingPage />} />
          <Route path="/booking-confirmed" element={<BookingConfirmed />} />
          <Route path="/cancella" element={<CancelPage />} />
          <Route path="/registrati" element={<RegisterPage />} />
          <Route path="/accedi" element={<StudentLoginPage />} />
          <Route path="/admin/login" element={<AdminLogin />} />
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<AdminDashboard />} />
            <Route path="slots" element={<AdminSlots />} />
            <Route path="bookings" element={<AdminBookings />} />
            <Route path="students" element={<AdminStudents />} />
            <Route path="events" element={<AdminEvents />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AppProvider>
  )
}

export default App

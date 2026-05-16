import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AppProvider } from './context/AppContext'
import AdminLogin from './pages/admin/AdminLogin'
import AdminDashboard from './pages/admin/AdminDashboard'
import AdminSlots from './pages/admin/AdminSlots'
import AdminStudents from './pages/admin/AdminStudents'
import AdminLayout from './components/admin/AdminLayout'
import Home from './pages/public/Home'
import BookingPage from './pages/public/BookingPage'
import BookingConfirmed from './pages/public/BookingConfirmed'

function App() {
  return (
    <AppProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/book/:slotId" element={<BookingPage />} />
          <Route path="/booking-confirmed" element={<BookingConfirmed />} />
          <Route path="/admin/login" element={<AdminLogin />} />
          <Route path="/admin" element={<AdminLayout />}>
            <Route path="dashboard" element={<AdminDashboard />} />
            <Route path="slots" element={<AdminSlots />} />
            <Route path="students" element={<AdminStudents />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AppProvider>
  )
}

export default App

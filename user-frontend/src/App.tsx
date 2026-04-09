import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './store/authStore'
import MainLayout from './components/layout/MainLayout'
import Login from './pages/Login'
import Register from './pages/Register'
import ForgotPassword from './pages/ForgotPassword'
import Chat from './pages/Chat'
import Contacts from './pages/Contacts'
import Groups from './pages/Groups'
import Meetings from './pages/Meetings'
import Favorites from './pages/Favorites'
import Files from './pages/Files'
import Settings from './pages/Settings'

// Protected Route component
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { token } = useAuthStore()

  if (!token) {
    return <Navigate to="/login" replace />
  }

  return <>{children}</>
}

// Public Route component (redirect if already logged in)
function PublicRoute({ children }: { children: React.ReactNode }) {
  const { token } = useAuthStore()

  if (token) {
    return <Navigate to="/chat" replace />
  }

  return <>{children}</>
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public routes */}
        <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
        <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />
        <Route path="/forgot-password" element={<PublicRoute><ForgotPassword /></PublicRoute>} />

        {/* Protected routes */}
        <Route path="/" element={<ProtectedRoute><MainLayout /></ProtectedRoute>}>
          <Route index element={<Navigate to="/chat" replace />} />
          <Route path="chat" element={<Chat />} />
          <Route path="contacts" element={<Contacts />} />
          <Route path="groups" element={<Groups />} />
          <Route path="meetings" element={<Meetings />} />
          <Route path="favorites" element={<Favorites />} />
          <Route path="files" element={<Files />} />
          <Route path="settings" element={<Settings />} />
        </Route>

        {/* Catch all */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App

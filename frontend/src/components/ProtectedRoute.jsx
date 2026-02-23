import { Navigate } from 'react-router-dom'
import { getToken, getUser } from '../lib/auth'

export default function ProtectedRoute({ children, requireAdmin = false }) {
  const token = getToken()
  const user = getUser()

  if (!token || !user) {
    return <Navigate to="/" replace />
  }

  if (requireAdmin && !user.is_staff) {
    return <Navigate to="/user" replace />
  }

  if (!requireAdmin && user.is_staff) {
    return <Navigate to="/admin" replace />
  }

  return children
}

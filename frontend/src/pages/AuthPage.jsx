import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { Eye, EyeOff } from 'lucide-react'
import { loginUser, registerUser } from '../lib/api'
import { saveAuth } from '../lib/auth'

const defaultForm = {
  ime: '',
  email: '',
  password: '',
  is_vlasnik: false,
}

export default function AuthPage() {
  const navigate = useNavigate()
  const [isRegister, setIsRegister] = useState(false)
  const [form, setForm] = useState(defaultForm)
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  function handleChange(event) {
    const { name, value, type, checked } = event.target
    setForm((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }))
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setLoading(true)
    try {
      const payload = isRegister
        ? { ime: form.ime, email: form.email, password: form.password, is_vlasnik: form.is_vlasnik }
        : { email: form.email, password: form.password }

      const response = isRegister ? await registerUser(payload) : await loginUser(payload)
      saveAuth(response.token, response.user)

      if (response.user.is_staff) {
        navigate('/admin')
        return
      }
      navigate('/user')
    } catch (err) {
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">
          {isRegister && form.is_vlasnik ? 'Portal za vlasnike' : 'Dobrodošli na BookFast'}
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          {isRegister
            ? form.is_vlasnik
              ? 'Registrirajte svoj salon'
              : 'Pronađite i rezervirajte termine'
            : 'Prijavite se u svoj korisnički račun'}
        </p>

        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          {isRegister && (
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Ime i prezime</label>
              <input
                required
                name="ime"
                value={form.ime}
                onChange={handleChange}
                className="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-indigo-500"
              />
            </div>
          )}

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Email</label>
            <input
              required
              type="email"
              name="email"
              value={form.email}
              onChange={handleChange}
              className="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Lozinka</label>
            <div className="relative">
              <input
                required
                type={showPassword ? 'text' : 'password'}
                name="password"
                value={form.password}
                onChange={handleChange}
                className="w-full rounded-md border border-slate-300 px-3 py-2 pr-10 outline-none focus:border-indigo-500"
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-slate-500 hover:text-slate-700"
                aria-label={showPassword ? 'Skrij lozinku' : 'Prikaži lozinku'}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {isRegister && (
            <div className="flex items-center mt-2">
              <input
                type="checkbox"
                id="is_vlasnik"
                name="is_vlasnik"
                checked={form.is_vlasnik}
                onChange={handleChange}
                className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
              <label htmlFor="is_vlasnik" className="ml-2 block text-sm text-slate-700">
                Ja sam vlasnik salona
              </label>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md bg-indigo-600 px-4 py-2 font-medium text-white hover:bg-indigo-500 disabled:opacity-70"
          >
            {loading ? 'Učitavanje...' : isRegister ? 'Registrirajte se' : 'Prijavite se'}
          </button>
        </form>

        <button
          type="button"
          onClick={() => setIsRegister((prev) => !prev)}
          className="mt-4 text-sm text-indigo-600 hover:text-indigo-500"
        >
          {isRegister ? 'Imate račun? Prijavite se' : 'Nemate račun? Registrirajte se'}
        </button>
      </div>
    </div>
  )
}

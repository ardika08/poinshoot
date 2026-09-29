import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Shield, ArrowLeft } from 'lucide-react'
import api, { adminToken } from '../lib/api'

const AdminLoginPage = () => {
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (isLoading) return

    setError('')
    setIsLoading(true)

    try {
      const data = await api.adminLogin(username, password)
      adminToken.set(data.token)
      localStorage.setItem('shoot_admin', JSON.stringify(data.admin))
      navigate('/admin/dashboard')
    } catch (err) {
      setError(err.message || 'Gagal login. Coba lagi.')
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-indigo-100 px-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
        className="w-full max-w-sm"
      >
        {/* Back Button */}
        <Link to="/" className="inline-flex items-center space-x-1.5 text-gray-600 hover:text-primary-600 mb-4 transition-colors text-sm">
          <ArrowLeft className="w-4 h-4" />
          <span>Kembali ke Home</span>
        </Link>

        {/* Login Card */}
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-primary-600 to-primary-800 p-6 text-center">
            <div className="bg-white/20 backdrop-blur-sm w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-3">
              <Shield className="w-7 h-7 text-white" />
            </div>
            <h1 className="text-lg font-display font-bold text-white">Admin Login</h1>
            <p className="text-primary-100 text-xs mt-0.5">Shoot Points Dashboard</p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-4">
            <div>
              <label htmlFor="username" className="block text-xs font-medium text-gray-700 mb-1.5">
                Username
              </label>
              <input
                type="text"
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Masukkan username"
                className="input-field"
                autoComplete="username"
                required
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-xs font-medium text-gray-700 mb-1.5">
                Password
              </label>
              <input
                type="password"
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Masukkan password"
                className="input-field"
                autoComplete="current-password"
                required
              />
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2.5 rounded-lg text-xs">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="btn-primary w-full inline-flex items-center justify-center space-x-2"
            >
              {isLoading ? (
                <>
                  <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span>Loading...</span>
                </>
              ) : (
                <>
                  <Shield className="w-4 h-4" />
                  <span>Login</span>
                </>
              )}
            </button>

            {/* Demo Credentials */}
            <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 text-center">
              <p className="text-xs text-blue-700 font-semibold mb-1">🔑 Demo Login:</p>
              <p className="text-xs text-blue-600">
                User: <code className="font-mono bg-white px-1.5 py-0.5 rounded text-xs">admin</code>
                {' | '}
                Pass: <code className="font-mono bg-white px-1.5 py-0.5 rounded text-xs">admin123</code>
              </p>
            </div>
          </form>
        </div>
      </motion.div>
    </div>
  )
}

export default AdminLoginPage

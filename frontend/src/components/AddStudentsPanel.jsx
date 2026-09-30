import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { UserPlus, ChevronDown, AlertCircle, CheckCircle2 } from 'lucide-react'
import api, { ApiError } from '../lib/api'

const ROMBELS = [1, 2, 3, 4, 5, 6].flatMap((k) => ['A', 'B'].map((r) => `${k}${r}`))

/**
 * Panel admin untuk menyiapkan daftar siswa (nama + rombel) sebelum acara.
 *
 * Tujuan: supaya guru bisa input skor manual di lapangan A walaupun siswa belum
 * pernah membuka app, dan supaya siswa di lapangan B tinggal memilih namanya.
 *
 * Mendukung tempel banyak nama sekaligus — satu nama per baris.
 */
const AddStudentsPanel = ({ onAdded }) => {
  const [isOpen, setIsOpen] = useState(false)
  const [rombel, setRombel] = useState('')
  const [text, setText] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')

  const names = text.split('\n').map((s) => s.trim()).filter(Boolean)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (isSubmitting) return

    setError('')
    setResult(null)

    if (!/^[1-6][A-Z]$/.test(rombel)) {
      setError('Pilih rombel dulu (contoh 4A)')
      return
    }

    if (names.length === 0) {
      setError('Isi minimal satu nama')
      return
    }

    setIsSubmitting(true)

    try {
      const data = await api.adminAddPlayers(rombel, text)
      setResult(data)
      setText('')
      onAdded?.(data)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal menyimpan daftar siswa')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 mb-3">
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <span className="flex items-center space-x-2">
          <UserPlus className="w-4 h-4 text-primary-600" />
          <span className="text-sm font-semibold text-gray-900">Tambah Siswa</span>
          <span className="text-xs text-gray-400">siapkan daftar sebelum acara</span>
        </span>
        <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="overflow-hidden"
          >
            <form onSubmit={handleSubmit} className="px-4 pb-4 space-y-3 border-t border-gray-100 pt-3">
              <div className="flex gap-2">
                <select
                  value={rombel}
                  onChange={(e) => { setRombel(e.target.value); setError(''); setResult(null) }}
                  className="px-2 py-2 border border-gray-200 rounded-lg text-sm bg-white"
                >
                  <option value="">-- Rombel --</option>
                  {ROMBELS.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
                <p className="text-xs text-gray-500 self-center">
                  Nama yang sudah ada tidak akan dibuat dua kali.
                </p>
              </div>

              <textarea
                value={text}
                onChange={(e) => { setText(e.target.value); setError('') }}
                rows={5}
                placeholder={'Tempel daftar nama, satu nama per baris:\nBudi Santoso\nSiti Aminah\nRina Wati'}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-100 resize-y"
              />

              {error && (
                <div className="flex items-start space-x-2 bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-xs">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              {result && (
                <div className="bg-green-50 border border-green-200 text-green-800 px-3 py-2.5 rounded-lg text-xs space-y-1">
                  <div className="flex items-start space-x-2">
                    <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                    <span className="font-semibold">
                      {result.added} siswa ditambahkan ke rombel {result.rombel} — total {result.total_in_rombel} siswa.
                    </span>
                  </div>
                  {result.duplicate > 0 && (
                    <p className="pl-6 text-green-700">
                      Dilewati (sudah ada): {result.duplicate_names.join(', ')}
                    </p>
                  )}
                  {result.invalid > 0 && (
                    <p className="pl-6 text-amber-700">
                      Nama terlalu pendek: {result.invalid_names.join(', ')}
                    </p>
                  )}
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                className="btn-primary w-full flex items-center justify-center space-x-2 disabled:opacity-60"
              >
                {isSubmitting ? (
                  <>
                    <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <span>Menyimpan...</span>
                  </>
                ) : (
                  <span>Tambah {names.length > 0 ? `${names.length} ` : ''}Siswa</span>
                )}
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default AddStudentsPanel

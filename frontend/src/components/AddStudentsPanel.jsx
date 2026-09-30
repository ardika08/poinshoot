import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  UserPlus, ChevronDown, AlertCircle, CheckCircle2, ClipboardPaste,
  FileSpreadsheet, Upload, X, Loader2, Info,
} from 'lucide-react'
import api, { ApiError } from '../lib/api'

// Saran rombel untuk kolom "rombel bawaan" (1A-6B).
const ROMBELS = [1, 2, 3, 4, 5, 6].flatMap((k) => ['A', 'B'].map((r) => `${k}${r}`))

const CONTOH_TEMPEL = `Tempel di sini (Ctrl+V), contoh:

Budi Santoso\t4A
Siti Aminah\t4A
Rina Wati\t4B

Boleh juga hanya nama saja — asal kolom rombel di atas dipilih.`

const petaRombel = (byRombel) =>
  Object.entries(byRombel || {})
    .map(([r, n]) => `${r} (${n})`)
    .join(', ')

/**
 * Panel admin untuk menyiapkan daftar siswa (nama + rombel) sebelum acara.
 *
 * Tujuan: supaya guru bisa input skor manual di lapangan A walaupun siswa belum
 * pernah membuka app, dan supaya siswa di lapangan B tinggal memilih namanya.
 *
 * Dua cara masuk:
 *  1. Tempel dari Excel / Google Sheets — blok sel, Ctrl+C, Ctrl+V. Paling cepat.
 *  2. Unggah berkas .xlsx / .csv / .txt — untuk file yang dikirim dari luar.
 *
 * Sebelum disimpan, daftarnya DIPERIKSA dulu (dry run) supaya operator melihat
 * berapa siswa yang akan masuk dan siapa saja yang dilewati.
 */
const AddStudentsPanel = ({ onAdded }) => {
  const [isOpen, setIsOpen] = useState(false)
  const [mode, setMode] = useState('paste')
  const [rombel, setRombel] = useState('')
  const [text, setText] = useState('')
  const [file, setFile] = useState(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [preview, setPreview] = useState(null)
  const [isPreviewing, setIsPreviewing] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')

  const fileInputRef = useRef(null)
  const previewSeq = useRef(0)

  const hasSource = mode === 'paste' ? text.trim().length > 0 : Boolean(file)
  const namaFile = file?.name || ''

  const resetHasil = () => {
    setResult(null)
    setError('')
  }

  /**
   * Periksa isi daftar (dry run) setiap kali sumber berubah. Ditunda 500 ms
   * supaya tidak memanggil server pada tiap ketukan tombol.
   */
  useEffect(() => {
    if (!hasSource) {
      setPreview(null)
      setIsPreviewing(false)
      return undefined
    }

    const seq = previewSeq.current + 1
    previewSeq.current = seq

    const timer = setTimeout(async () => {
      setIsPreviewing(true)

      try {
        const data = await api.adminImportPlayers({ text, file, rombel, dryRun: true })
        if (previewSeq.current !== seq) return // jawaban basi, abaikan
        setPreview(data)
        setError('')
      } catch (err) {
        if (previewSeq.current !== seq) return
        setPreview(null)
        setError(err instanceof ApiError ? err.message : 'Gagal membaca daftar siswa')
      } finally {
        if (previewSeq.current === seq) setIsPreviewing(false)
      }
    }, 500)

    return () => clearTimeout(timer)
  }, [text, file, rombel, mode, hasSource])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (isSubmitting) return

    if (!hasSource) {
      setError(mode === 'paste' ? 'Tempel daftar nama dulu' : 'Pilih file dulu')
      return
    }

    setIsSubmitting(true)
    resetHasil()

    try {
      const data = await api.adminImportPlayers({ text, file, rombel, dryRun: false })
      setResult(data)
      setText('')
      setFile(null)
      setPreview(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
      onAdded?.(data)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal menyimpan daftar siswa')
    } finally {
      setIsSubmitting(false)
    }
  }

  const gantiMode = (next) => {
    if (next === mode) return
    setMode(next)
    resetHasil()
    setPreview(null)
  }

  const belumAdaRombel =
    preview && preview.invalid > 0 && !rombel && preview.added === 0

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
          <span className="text-xs text-gray-400">tempel dari Excel atau unggah file</span>
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
              {/* Dua cara memasukkan daftar */}
              <div className="flex gap-1 p-1 bg-gray-100 rounded-lg">
                <button
                  type="button"
                  onClick={() => gantiMode('paste')}
                  className={`flex-1 flex items-center justify-center space-x-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                    mode === 'paste' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <ClipboardPaste className="w-3.5 h-3.5" />
                  <span>Tempel dari Excel</span>
                </button>
                <button
                  type="button"
                  onClick={() => gantiMode('file')}
                  className={`flex-1 flex items-center justify-center space-x-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                    mode === 'file' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  <span>Unggah File</span>
                </button>
              </div>

              {/* Rombel bawaan — opsional, karena rombel boleh ikut di dalam data */}
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={rombel}
                  onChange={(e) => { setRombel(e.target.value); resetHasil() }}
                  className="px-2 py-2 border border-gray-200 rounded-lg text-sm bg-white"
                >
                  <option value="">Rombel bawaan: tidak dipilih</option>
                  {ROMBELS.map((r) => <option key={r} value={r}>Rombel bawaan: {r}</option>)}
                </select>
                <p className="text-xs text-gray-500 flex-1 min-w-[12rem]">
                  Dipakai hanya untuk nama yang rombelnya tidak tertulis di data.
                </p>
              </div>

              {mode === 'paste' ? (
                <textarea
                  value={text}
                  onChange={(e) => { setText(e.target.value); resetHasil() }}
                  rows={6}
                  placeholder={CONTOH_TEMPEL}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary-100 resize-y"
                />
              ) : (
                <div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx,.csv,.txt"
                    onChange={(e) => { setFile(e.target.files?.[0] || null); resetHasil() }}
                    className="hidden"
                    id="add-students-file"
                  />
                  {file ? (
                    <div className="flex items-center justify-between gap-2 px-3 py-2.5 border border-primary-200 bg-primary-50/50 rounded-lg">
                      <span className="flex items-center space-x-2 min-w-0">
                        <FileSpreadsheet className="w-4 h-4 text-primary-600 shrink-0" />
                        <span className="text-xs text-gray-800 truncate">{namaFile}</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => { setFile(null); resetHasil(); if (fileInputRef.current) fileInputRef.current.value = '' }}
                        className="p-1 text-gray-400 hover:text-gray-700"
                        aria-label="Hapus file"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <label
                      htmlFor="add-students-file"
                      className="flex flex-col items-center justify-center gap-1.5 px-4 py-6 border-2 border-dashed border-gray-200 rounded-lg cursor-pointer hover:border-primary-300 hover:bg-gray-50 transition-colors"
                    >
                      <Upload className="w-5 h-5 text-gray-400" />
                      <span className="text-xs font-medium text-gray-700">Pilih file .xlsx, .csv, atau .txt</span>
                      <span className="text-[11px] text-gray-400">File .xls lama: buka di Excel lalu Simpan Sebagai .xlsx</span>
                    </label>
                  )}
                </div>
              )}

              {error && (
                <div className="flex items-start space-x-2 bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-xs">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              {/* Hasil pemeriksaan sebelum disimpan */}
              {isPreviewing && (
                <div className="flex items-center space-x-2 text-xs text-gray-500 px-1">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Memeriksa daftar...</span>
                </div>
              )}

              {preview && !isPreviewing && (
                <div className="bg-blue-50 border border-blue-100 rounded-lg px-3 py-2.5 text-xs space-y-1">
                  <div className="flex items-start space-x-2">
                    <Info className="w-4 h-4 shrink-0 mt-0.5 text-blue-600" />
                    <div className="space-y-0.5">
                      <p className="font-semibold text-blue-900">
                        {preview.added > 0
                          ? `Terdeteksi ${preview.added} siswa baru`
                          : 'Tidak ada siswa baru yang bisa ditambahkan'}
                      </p>
                      {preview.added > 0 && (
                        <p className="text-blue-800">Rombel: {petaRombel(preview.by_rombel)}</p>
                      )}
                      {preview.duplicate > 0 && (
                        <p className="text-blue-800">
                          {preview.duplicate} nama sudah terdaftar — akan dilewati.
                        </p>
                      )}
                      {preview.invalid > 0 && (
                        <p className="text-amber-700">
                          {preview.invalid} baris tidak terbaca
                          {preview.invalid_names?.length ? `: ${preview.invalid_names.slice(0, 8).join(', ')}` : ''}
                        </p>
                      )}
                    </div>
                  </div>

                  {belumAdaRombel && (
                    <p className="pl-6 text-amber-700 font-medium">
                      Sepertinya daftar ini belum menyebut rombel. Pilih &quot;Rombel bawaan&quot; di atas, lalu periksa lagi.
                    </p>
                  )}
                </div>
              )}

              {result && (
                <div className="bg-green-50 border border-green-200 text-green-800 px-3 py-2.5 rounded-lg text-xs space-y-1">
                  <div className="flex items-start space-x-2">
                    <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                    <span className="font-semibold">
                      {result.added} siswa ditambahkan
                      {Object.keys(result.by_rombel || {}).length > 0
                        ? ` — ${petaRombel(result.by_rombel)}.`
                        : '.'}
                    </span>
                  </div>
                  {result.duplicate > 0 && (
                    <p className="pl-6 text-green-700">
                      Dilewati (sudah ada): {result.duplicate_names.slice(0, 10).join(', ')}
                      {result.duplicate_names.length > 10 ? ` +${result.duplicate_names.length - 10} lagi` : ''}
                    </p>
                  )}
                  {result.invalid > 0 && (
                    <p className="pl-6 text-amber-700">
                      Tidak terbaca: {result.invalid_names.slice(0, 10).join(', ')}
                    </p>
                  )}
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting || !preview || preview.added === 0}
                className="btn-primary w-full flex items-center justify-center space-x-2 disabled:opacity-60"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Menyimpan...</span>
                  </>
                ) : (
                  <span>
                    {preview && preview.added > 0
                      ? `Simpan ${preview.added} Siswa`
                      : 'Simpan Siswa'}
                  </span>
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

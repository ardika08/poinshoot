import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Target, Trophy, Gamepad2, Users, Zap, ArrowRight, Star, ClipboardCheck, CheckCircle2 } from 'lucide-react'
import api, { ApiError, playerStorage } from '../lib/api'
import useBoardConfig from '../hooks/useBoardConfig'
import HeroAnimation from '../components/HeroAnimation'

const HomePage = () => {
  const navigate = useNavigate()
  const { board } = useBoardConfig()
  const maxAttempts = board.max_attempts
  const [formData, setFormData] = useState({
    name: '',
    rombel: ''
  })
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [stats, setStats] = useState(null)
  const [roster, setRoster] = useState([])
  const [isLoadingRoster, setIsLoadingRoster] = useState(false)

  // Ambil statistik publik
  useEffect(() => {
    const controller = new AbortController()
    api.getPublicStats(controller.signal)
      .then(setStats)
      .catch(err => {
        if (err.name !== 'AbortError') console.error('Gagal memuat statistik:', err.message)
      })
    return () => controller.abort()
  }, [])

  // Setelah rombel dipilih, tampilkan daftar nama siswa rombel itu.
  // Siswa tinggal memilih namanya → tidak perlu mengetik → tidak ada akun ganda
  // karena salah ejaan, dan skor manual dari lapangan A pasti tersambung.
  useEffect(() => {
    if (!/^[1-6][A-Z]$/.test(formData.rombel)) {
      setRoster([])
      setIsLoadingRoster(false)
      return undefined
    }

    const controller = new AbortController()
    setIsLoadingRoster(true)

    api.getRoster(formData.rombel, controller.signal)
      .then((data) => setRoster(data.players || []))
      .catch((err) => {
        if (err.name !== 'AbortError') setRoster([])
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoadingRoster(false)
      })

    return () => controller.abort()
  }, [formData.rombel])

  const validateForm = () => {
    if (!formData.name || formData.name.trim().length < 3) {
      setError('Nama minimal 3 karakter')
      return false
    }
    if (!/^[1-6][A-Z]$/.test(formData.rombel)) {
      setError('Pilih rombel siswa, contoh 4A atau 4B')
      return false
    }
    setError('')
    return true
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!validateForm() || isSubmitting) return

    setIsSubmitting(true)
    setError('')

    try {
      const player = await api.registerPlayer(formData.name.trim(), formData.rombel)
      playerStorage.set({
        id: player.id,
        name: player.name,
        rombel: player.rombel,
        registeredAt: player.created_at,
      })
      setSuccess(true)
      setTimeout(() => navigate('/play'), 1200)
    } catch (err) {
      if (err instanceof ApiError && err.code === 'DUPLICATE_PLAYER') {
        // Nama + rombel ini sudah terdaftar → siswa yang sama mendaftar ulang.
        // Lanjutkan ke akun yang sudah ada supaya skor manual + simulasi menyatu.
        try {
          const { player: existing } = await api.lookupPlayer(formData.name.trim(), formData.rombel)
          if (existing) {
            playerStorage.set({
              id: existing.id,
              name: existing.name,
              rombel: existing.rombel,
              registeredAt: existing.created_at,
            })
            setSuccess(true)
            setTimeout(() => navigate('/play'), 1200)
            return
          }
        } catch {
          // fallthrough ke pesan error
        }
        setError('Nama ini sudah terdaftar di rombel tersebut. Hubungi admin jika ini bukan kamu.')
      } else {
        setError(err.message || 'Gagal mendaftar. Coba lagi.')
      }
      setIsSubmitting(false)
    }
  }

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
    setError('')
  }

  const features = [
    { icon: Target, title: '20 Lubang', description: 'Poin bervariasi, jackpot 100' },
    { icon: Trophy, title: 'Leaderboard', description: 'Ranking top 3 semua waktu' },
    { icon: Gamepad2, title: 'Mobile Friendly', description: 'Touch-friendly untuk HP' },
    { icon: Users, title: 'Gratis', description: 'Proyek edukasi untuk siswa SD' }
  ]

  return (
    <div className="pb-8">
      {/* ====== HERO SECTION (Mobile-First) ====== */}
      <section className="relative overflow-hidden pt-6 pb-10 sm:pt-12 sm:pb-16">
        {/* Background decorations */}
        <div className="absolute inset-0 -z-10">
          <div className="absolute top-4 left-1/4 w-48 h-48 bg-primary-200 rounded-full mix-blend-multiply filter blur-xl opacity-50" />
          <div className="absolute top-8 right-1/4 w-48 h-48 bg-yellow-200 rounded-full mix-blend-multiply filter blur-xl opacity-50" />
        </div>

        <div className="container-mobile relative">
          {/* Mobile: Stack vertical (animation first, then text) */}
          {/* Desktop: Two columns (text left, animation right) */}
          <div className="grid md:grid-cols-2 gap-6 md:gap-8 items-center">
            {/* Left: Content */}
            <div className="flex flex-col items-center text-center space-y-5 sm:space-y-6 md:items-start md:text-left">
              {/* Badge */}
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="inline-flex items-center space-x-2 bg-white/80 backdrop-blur-sm px-3 py-1.5 rounded-full shadow-sm"
              >
                <Zap className="w-4 h-4 text-yellow-500" fill="currentColor" />
                <span className="text-xs font-semibold text-gray-700">Project Edukasi Gratis</span>
              </motion.div>

              {/* Headline */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
              >
                <h1 className="text-2xl sm:text-4xl font-display font-bold text-gray-900 leading-tight">
                  Game Lempar Bola
                  <span className="block text-transparent bg-clip-text bg-gradient-to-r from-primary-600 to-primary-800 mt-1">
                    Poin & Leaderboard
                  </span>
                </h1>
                <p className="text-sm sm:text-base text-gray-600 mt-3 max-w-md mx-auto md:mx-0 leading-relaxed">
                  Mainkan permainan lempar bola ke lubang yang seru! Kumpulkan poin dan raih posisi juara di leaderboard.
                </p>
              </motion.div>

              {/* CTA Buttons */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto"
              >
                <Link to="/play" className="btn-primary inline-flex items-center justify-center space-x-2 w-full sm:w-auto">
                  <Gamepad2 className="w-4 h-4 sm:w-5 sm:h-5" />
                  <span>Mainkan Sekarang</span>
                </Link>
                <Link to="/leaderboard" className="btn-secondary inline-flex items-center justify-center space-x-2 w-full sm:w-auto">
                  <Trophy className="w-4 h-4 sm:w-5 sm:h-5" />
                  <span>Lihat Peringkat</span>
                </Link>
              </motion.div>
            </div>

            {/* Right: Interactive Animation */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.3, duration: 0.5 }}
              className="flex justify-center order-first md:order-last"
            >
              <HeroAnimation />
            </motion.div>
          </div>
        </div>
      </section>

      {/* ====== REGISTRATION CARD ====== */}
      <section className="container-mobile mb-10 sm:mb-14">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3 }}
          className="max-w-md mx-auto"
        >
          <div className="card shadow-lg">
            <div className="text-center mb-5">
              <div className="bg-primary-100 p-3 rounded-full inline-block mb-3">
                <Users className="w-6 h-6 sm:w-8 sm:h-8 text-primary-600" />
              </div>
              <h2 className="text-lg sm:text-xl font-display font-bold text-gray-900">Daftar Sekarang!</h2>
              <p className="text-xs sm:text-sm text-gray-600 mt-1">Bergabung dan mulai bermain</p>
            </div>

            {success ? (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-green-50 border border-green-200 rounded-xl p-5 text-center"
              >
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h3 className="text-base font-semibold text-green-800 mb-1">Berhasil Daftar!</h3>
                <p className="text-green-700 text-xs">Mengalihkan ke halaman game...</p>
              </motion.div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-3.5">
                <div>
                  <label htmlFor="rombel" className="block text-xs sm:text-sm font-medium text-gray-700 mb-1.5">Rombel</label>
                  <select id="rombel" name="rombel" value={formData.rombel} onChange={handleChange} className="input-field bg-white">
                    <option value="">-- Pilih Rombel --</option>
                    {[1,2,3,4,5,6].flatMap(k => ['A','B'].map(r => `${k}${r}`)).map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>

                {/* Daftar nama dari admin — siswa tinggal memilih, tidak mengetik */}
                {/^[1-6][A-Z]$/.test(formData.rombel) && (
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-xs sm:text-sm font-medium text-gray-700">Pilih Namamu</label>
                      {isLoadingRoster && <span className="text-xs text-gray-400">memuat…</span>}
                    </div>

                    {roster.length > 0 ? (
                      <div className="max-h-52 overflow-y-auto rounded-xl border border-gray-200 bg-white divide-y divide-gray-100">
                        {roster.map((p) => {
                          const isPicked = formData.name === p.name
                          return (
                            <button
                              type="button"
                              key={p.name}
                              onClick={() => {
                                setFormData(prev => ({ ...prev, name: p.name }))
                                setError('')
                              }}
                              className={`w-full flex items-center justify-between px-3 py-2.5 text-left text-sm transition-colors ${
                                isPicked
                                  ? 'bg-primary-50 text-primary-700 font-semibold'
                                  : 'hover:bg-gray-50 text-gray-700'
                              }`}
                            >
                              <span className="truncate">{p.name}</span>
                              {p.simulation_done ? (
                                <span className="shrink-0 ml-2 text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500">
                                  sudah main
                                </span>
                              ) : (
                                isPicked && <CheckCircle2 className="w-4 h-4 shrink-0 ml-2" />
                              )}
                            </button>
                          )
                        })}
                      </div>
                    ) : (
                      !isLoadingRoster && (
                        <p className="text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
                          Belum ada daftar nama untuk rombel ini. Ketik namamu di kolom bawah.
                        </p>
                      )
                    )}
                  </div>
                )}

                <div>
                  <label htmlFor="name" className="block text-xs sm:text-sm font-medium text-gray-700 mb-1.5">
                    Nama Lengkap
                  </label>
                  <input
                    type="text"
                    id="name"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    placeholder={roster.length > 0 ? 'Atau ketik nama lengkapmu' : 'Masukkan nama lengkap'}
                    className="input-field"
                    maxLength={100}
                  />
                  {roster.length > 0 && (
                    <p className="text-[11px] text-gray-400 mt-1">
                      Ketik hanya jika namamu belum ada di daftar atas — ejaannya harus sama dengan daftar admin.
                    </p>
                  )}
                </div>

                {error && (
                  <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2.5 rounded-lg text-xs sm:text-sm">
                    {error}
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
                      <span>Mendaftar...</span>
                    </>
                  ) : (
                    <>
                      <span>Daftar &amp; Mulai Main</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
            )}
          </div>
        </motion.div>
      </section>

      {/* ====== STATS SECTION (Mobile: 2 cols) ====== */}
      <section className="container-mobile mb-10 sm:mb-14">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
          {[
            { label: 'Total Pemain', value: stats?.total_players, suffix: '+' },
            { label: 'Online Hari Ini', value: stats?.active_today },
            { label: 'Ronde Selesai', value: stats?.total_rounds, suffix: '+' },
            { label: 'Rata-rata Score', value: stats?.avg_score, highlight: true }
          ].map((stat, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.05 }}
              className="bg-white rounded-xl shadow-sm p-3 sm:p-5 border border-gray-100 text-center"
            >
              <div className={`text-xl sm:text-2xl md:text-3xl font-display font-bold ${stat.highlight ? 'text-primary-600' : 'text-gray-900'}`}>
                {stat.value === undefined || stat.value === null ? (
                  <span className="inline-block w-10 h-6 bg-gray-100 rounded animate-pulse align-middle" />
                ) : (
                  <>{stat.value}{stat.suffix}</>
                )}
              </div>
              <div className="text-gray-500 text-xs sm:text-sm mt-0.5">{stat.label}</div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ====== FEATURES (Mobile: 1 col, Grid on tablet) ====== */}
      <section className="container-mobile mb-10 sm:mb-14">
        <div className="text-center mb-6 sm:mb-8">
          <h2 className="text-lg sm:text-2xl font-display font-bold text-gray-900 mb-2">Fitur Unggulan</h2>
          <p className="text-xs sm:text-base text-gray-600 max-w-xl mx-auto">
            Pengalaman bermain terbaik untuk siswa SD
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-5">
          {features.map((feature, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.05 }}
              whileHover={{ y: -3 }}
              className="bg-white rounded-xl shadow-sm p-3 sm:p-5 border border-gray-100"
            >
              <div className="bg-primary-100 p-2 sm:p-3 rounded-lg w-fit mb-2 sm:mb-3">
                <feature.icon className="w-4 h-4 sm:w-6 sm:h-6 text-primary-600" />
              </div>
              <h3 className="font-display font-semibold text-xs sm:text-base text-gray-900 mb-1">
                {feature.title}
              </h3>
              <p className="text-gray-500 text-xs sm:text-sm leading-snug">
                {feature.description}
              </p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ====== CARA BERMAIN (4 langkah, versi ringkas dari poster) ====== */}
      <section className="bg-primary-600 text-white py-8 sm:py-12">
        <div className="container-mobile">
          <div className="text-center mb-6 sm:mb-8">
            <h2 className="text-lg sm:text-2xl font-display font-bold mb-1 sm:mb-2">Cara Bermain</h2>
            <p className="text-primary-100 text-xs sm:text-base">
              Lempar bola, masuk lubang, kumpulkan poin!
            </p>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5">
            {[
              { step: '1', title: 'Ambil Posisi', desc: 'Berdiri di belakang garis batas' },
              { step: '2', title: 'Lempar Bola', desc: 'Arahkan ke papan target berlubang' },
              { step: '3', title: 'Dapat Poin', desc: 'Sesuai angka pada lubang yang kena' },
              { step: '4', title: 'Kumpulkan!', desc: `${maxAttempts} lemparan, raih skor tertinggi` }
            ].map((item, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, scale: 0.92 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.08 }}
                className="text-center"
              >
                <div className="bg-yellow-400 text-gray-900 font-display font-bold text-xl sm:text-2xl w-11 h-11 sm:w-14 sm:h-14 rounded-full flex items-center justify-center mx-auto mb-2.5 shadow-lg">
                  {item.step}
                </div>
                <h3 className="text-xs sm:text-base font-bold mb-0.5">{item.title}</h3>
                <p className="text-primary-100 text-xs leading-snug">{item.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ====== PERATURAN (versi ringkas) ====== */}
      <section className="container-mobile py-8 sm:py-12">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center justify-center space-x-2 mb-4 sm:mb-6">
            <ClipboardCheck className="w-5 h-5 sm:w-6 sm:h-6 text-primary-600" />
            <h2 className="text-lg sm:text-2xl font-display font-bold text-gray-900">Peraturan</h2>
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm divide-y divide-gray-100">
            {[
              `Setiap peserta mendapat ${maxAttempts} kali lemparan`,
              'Bola harus dilempar — tidak boleh didorong atau digelindingkan',
              'Sportivitas nomor satu!',
              'Keputusan panitia mutlak dan tidak dapat diganggu gugat'
            ].map((rule, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, x: -8 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.06 }}
                className="flex items-start space-x-3 px-4 py-3"
              >
                <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5 text-green-500 shrink-0 mt-0.5" />
                <p className="text-xs sm:text-sm text-gray-700 leading-relaxed">{rule}</p>
              </motion.div>
            ))}
          </div>

          <p className="text-center text-xs text-gray-400 mt-4">
            Tunjukkan akurasi terbaikmu dan jadilah <span className="font-bold text-primary-600">JUARA!</span>
          </p>
        </div>
      </section>
    </div>
  )
}

export default HomePage

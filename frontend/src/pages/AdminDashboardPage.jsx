import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Shield, Users, Gamepad2, Download, Search, Trash2,
  Plus, AlertCircle, LogOut, Check, X, RotateCcw, RefreshCw, ChevronRight
} from 'lucide-react'
import api, { adminToken } from '../lib/api'
import useBoardConfig from '../hooks/useBoardConfig'
import BoardPicker from '../components/BoardPicker'
import AddStudentsPanel from '../components/AddStudentsPanel'

const AdminDashboardPage = () => {
  const navigate = useNavigate()
  const { board } = useBoardConfig()

  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [stats, setStats] = useState(null)
  const [players, setPlayers] = useState([])
  const [playerPagination, setPlayerPagination] = useState(null)
  const [recentRounds, setRecentRounds] = useState([])
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedRombel, setSelectedRombel] = useState('')
  const [loadError, setLoadError] = useState('')

  // --- Hapus siswa: satuan (tombol per baris) + massal (checkbox) ---
  const [selectedIds, setSelectedIds] = useState([])
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteProgress, setDeleteProgress] = useState(null)

  // --- Manual score input state ---
  const [activeTab, setActiveTab] = useState('input')
  const [selectedPlayerId, setSelectedPlayerId] = useState('')
  const [currentAttempt, setCurrentAttempt] = useState(1)
  const [zoneName, setZoneName] = useState('')
  const [isSuccessful, setIsSuccessful] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formError, setFormError] = useState('')
  const [roundProgress, setRoundProgress] = useState(null)
  const [attemptHistory, setAttemptHistory] = useState([])
  const [isLoadingPlayerHistory, setIsLoadingPlayerHistory] = useState(false)

  const maxAttempts = board.max_attempts
  const selectedHole = board.holes.find(h => h.id === zoneName) || null
  const selectedPlayer = players.find(p => String(p.id) === String(selectedPlayerId))
  const points = selectedHole?.points ?? 0

  // ---------- auth guard ----------
  useEffect(() => {
    if (!adminToken.get()) {
      navigate('/admin/login')
      return
    }
    api.adminMe()
      .then(() => setIsAuthenticated(true))
      .catch(() => {
        adminToken.clear()
        navigate('/admin/login')
      })
  }, [navigate])

  // ---------- data loading ----------
  const loadData = useCallback(async (signal, rombelOverride = selectedRombel) => {
    try {
      const [statsData, playersData, recentData] = await Promise.all([
        api.adminStats(signal),
        api.adminPlayers({ perPage: 1000, page: 1, rombel: rombelOverride }, signal),
        api.adminRecentGames({ limit: 10 }, signal),
      ])
      setStats(statsData)
      setPlayers(playersData.players || [])
      setPlayerPagination(playersData.pagination || null)
      setRecentRounds(recentData.rounds || [])
      setLoadError('')
    } catch (err) {
      if (err.name === 'AbortError') return
      if (err.status === 401) {
        adminToken.clear()
        navigate('/admin/login')
        return
      }
      setLoadError(err.message || 'Gagal memuat data dashboard')
    }
  }, [navigate, selectedRombel])

  useEffect(() => {
    if (!isAuthenticated) return
    const controller = new AbortController()
    loadData(controller.signal)
    return () => controller.abort()
  }, [isAuthenticated, loadData])

  // Admin sering membuka dashboard lebih dulu, lalu siswa registrasi dari HP.
  // Muat ulang saat tab kembali aktif supaya roster tidak stale.
  useEffect(() => {
    if (!isAuthenticated) return undefined
    const refreshOnFocus = () => loadData()
    window.addEventListener('focus', refreshOnFocus)
    const interval = window.setInterval(() => loadData(), 10000)
    return () => {
      window.removeEventListener('focus', refreshOnFocus)
      window.clearInterval(interval)
    }
  }, [isAuthenticated, loadData])

  const handleLogout = async () => {
    try {
      await api.adminLogout()
    } catch {
      // abaikan, tetap logout lokal
    }
    adminToken.clear()
    localStorage.removeItem('shoot_admin')
    navigate('/admin/login')
  }

  const handleRombelChange = (value) => {
    setSelectedRombel(value)
    // Pilihan massal dikosongkan: daftar yang dimuat ikut berubah, jadi centang
    // lama bisa menunjuk siswa yang tidak lagi tampil.
    setSelectedIds([])
    startNewPlayer()
    loadData(undefined, value)
  }

  // ---------- manual score submit ----------
  const handleSubmitScore = async (e) => {
    e.preventDefault()
    if (isSubmitting) return

    if (!selectedPlayerId) {
      setFormError('Pilih pemain terlebih dahulu')
      return
    }

    if (isSuccessful && !selectedHole) {
      setFormError('Tap lubang tempat bola masuk')
      return
    }

    setIsSubmitting(true)
    setFormError('')

    try {
      const result = await api.adminSubmitGame({
        playerId: selectedPlayerId,
        attemptNumber: currentAttempt,
        isSuccessful,
        points,
        zoneName,
      })

      setRoundProgress(result.round)
      setAttemptHistory(prev => [...prev, {
        attempt: currentAttempt,
        successful: isSuccessful,
        points: isSuccessful ? points : 0,
        zone: isSuccessful ? zoneName : null,
      }])

      if (result.round.is_complete) {
        // Ronde selesai — reset untuk pemain berikutnya
        setCurrentAttempt(1)
      } else {
        // Form stay di pemain yang sama, lanjut attempt berikutnya
        setCurrentAttempt(result.round.attempts_count + 1)
      }

      // Kosongkan pilihan supaya lubang attempt sebelumnya tidak terbawa
      setZoneName('')
      setIsSuccessful(true)

      // Refresh stats & recent
      loadData()
    } catch (err) {
      setFormError(err.message || 'Gagal menyimpan skor')
    } finally {
      setIsSubmitting(false)
    }
  }

  const startNewPlayer = () => {
    setSelectedPlayerId('')
    setCurrentAttempt(1)
    setRoundProgress(null)
    setAttemptHistory([])
    setFormError('')
    setZoneName('')
    setIsSuccessful(true)
  }

  const handlePlayerChange = async (id) => {
    setSelectedPlayerId(id)
    setCurrentAttempt(1)
    setRoundProgress(null)
    setAttemptHistory([])
    setFormError('')

    if (!id) return

    // Muat ronde manual yang sudah ada. Tanpa ini, memilih siswa yang pernah
    // punya ronde membuat attempt 1 langsung meng-update ronde lengkap dan UI
    // tampak langsung berubah menjadi "Ganti Pemain".
    setIsLoadingPlayerHistory(true)
    try {
      const data = await api.adminPlayerGames(id)
      const manualGames = (data.games || []).filter(g => g.game_mode === 'manual')
      const roundId = manualGames[0]?.round_id
      const games = manualGames
        .filter(g => !roundId || g.round_id === roundId)
        .sort((a, b) => a.attempt_number - b.attempt_number)
      const history = games.map(g => ({
        attempt: g.attempt_number,
        successful: g.is_successful,
        points: g.points,
        zone: g.zone_name,
      }))
      const total = history.reduce((sum, g) => sum + (g.points || 0), 0)
      const nextAttempt = Array.from({ length: maxAttempts }, (_, i) => i + 1)
        .find(n => !history.some(g => g.attempt === n)) || 1

      setAttemptHistory(history)
      setCurrentAttempt(nextAttempt)
      setRoundProgress(games.length > 0 ? {
        id: roundId,
        player_id: Number(id),
        total_score: total,
        attempts_count: games.length,
        is_complete: games.length >= maxAttempts,
      } : null)
    } catch (err) {
      setFormError(err.message || 'Gagal memuat riwayat ronde siswa')
    } finally {
      setIsLoadingPlayerHistory(false)
    }
  }

  const handleDeleteRound = async (roundId) => {
    if (!window.confirm('Hapus ronde ini? Semua attempt di dalamnya akan terhapus.')) return
    try {
      await api.adminDeleteRound(roundId)
      loadData()
    } catch (err) {
      alert(err.message || 'Gagal menghapus ronde')
    }
  }

  /**
   * Hapus satu siswa beserta seluruh riwayat skornya.
   * Konfirmasi menyebut nama, rombel, dan skor yang ikut hilang — penghapusan
   * pemain permanen dan tidak ada undo di UI.
   */
  const handleDeletePlayer = async (player) => {
    const punyaSkor = (player.manual_score || player.simulation_score) > 0
    const pesan = `Hapus ${player.name} (${player.rombel})?\n\n` +
      (punyaSkor
        ? `Riwayat skornya ikut terhapus (manual ${player.manual_score}, simulasi ${player.simulation_score}).`
        : 'Siswa ini belum punya skor.') +
      '\n\nTidak bisa dibatalkan.'

    if (!window.confirm(pesan)) return

    try {
      await api.adminDeletePlayer(player.id)
      setSelectedIds((prev) => prev.filter((id) => String(id) !== String(player.id)))
      if (String(selectedPlayerId) === String(player.id)) startNewPlayer()
      loadData()
    } catch (err) {
      alert(err.message || 'Gagal menghapus siswa')
    }
  }

  /**
   * Hapus massal. Endpoint hapus memang per-id, jadi dikirim berurutan:
   * supaya pesan gagal bisa menyebut nama spesifik dan satu siswa bermasalah
   * tidak membatalkan sisanya.
   */
  const handleDeleteSelected = async () => {
    const targets = players.filter((p) => isSelected(p.id))
    if (targets.length === 0) return

    const daftar = targets.map((p) => `• ${p.name} (${p.rombel})`).join('\n')
    const pesan = `Hapus ${targets.length} siswa beserta SELURUH riwayat skornya?\n\n` +
      `${daftar}\n\nTidak bisa dibatalkan.`
    if (!window.confirm(pesan)) return

    setIsDeleting(true)
    setDeleteProgress({ done: 0, total: targets.length })

    const gagal = []
    for (let i = 0; i < targets.length; i += 1) {
      try {
        await api.adminDeletePlayer(targets[i].id)
        if (String(selectedPlayerId) === String(targets[i].id)) startNewPlayer()
      } catch (err) {
        gagal.push(`${targets[i].name}: ${err.message || 'gagal'}`)
      }
      setDeleteProgress({ done: i + 1, total: targets.length })
    }

    setIsDeleting(false)
    setDeleteProgress(null)
    setSelectedIds([])
    loadData()

    if (gagal.length > 0) {
      alert(`${gagal.length} siswa gagal dihapus:\n${gagal.join('\n')}`)
    }
  }

  const handleExport = () => {
    const rows = [
      ['Nama', 'Rombel', 'Manual', 'Simulasi', 'Skor Final', 'Status'],
      ...filteredPlayers.map(p => [
        p.name,
        p.rombel,
        p.manual_score,
        p.simulation_score,
        p.final_score,
        p.completion_status,
      ]),
    ]
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `pemain-shoot-points-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const rombelOptions = [...new Set([
    ...players.map(p => p.rombel).filter(Boolean),
    ...['1A', '1B', '2A', '2B', '3A', '3B', '4A', '4B', '5A', '5B', '6A', '6B'],
  ])].sort()
  const filteredPlayers = players.filter(p =>
    (!selectedRombel || p.rombel === selectedRombel) &&
    p.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  // --- Seleksi hapus massal ---
  // Selalu diturunkan dari `players` yang sedang dimuat, bukan dari selectedIds
  // mentah: kalau tidak, tombol bisa menjanjikan 3 siswa tapi yang terhapus 1.
  const isSelected = (id) => selectedIds.some((sid) => String(sid) === String(id))
  const selectedPlayers = players.filter((p) => isSelected(p.id))
  const allFilteredSelected =
    filteredPlayers.length > 0 && filteredPlayers.every((p) => isSelected(p.id))
  const someFilteredSelected = filteredPlayers.some((p) => isSelected(p.id))

  const toggleOne = (id) => {
    setSelectedIds((prev) =>
      prev.some((sid) => String(sid) === String(id))
        ? prev.filter((sid) => String(sid) !== String(id))
        : [...prev, id]
    )
  }

  // "Pilih semua" hanya menjangkau yang sedang tampil (ikut filter rombel + cari),
  // jadi guru tidak menghapus rombel lain tanpa sadar.
  const toggleAllFiltered = () => {
    setSelectedIds((prev) => {
      const ids = filteredPlayers.map((p) => p.id)
      const semuaTerpilih = ids.length > 0 && ids.every((id) => isSelected(id))
      return semuaTerpilih
        ? prev.filter((sid) => !ids.some((id) => String(id) === String(sid)))
        : [...new Set([...prev, ...ids])]
    })
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin w-6 h-6 border-3 border-primary-600 border-t-transparent rounded-full" />
      </div>
    )
  }

  const statCards = [
    { label: 'Pemain', value: stats?.total_players },
    { label: 'Ronde', value: stats?.total_rounds },
    { label: 'Rata-rata', value: stats?.avg_score },
    { label: 'Aktif', value: stats?.active_today },
  ]

  const TABS = [
    { id: 'input', label: 'Input Skor', icon: Plus },
    { id: 'players', label: 'Pemain', icon: Users, count: players.length },
    { id: 'rounds', label: 'Ronde', icon: Gamepad2, count: recentRounds.length },
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <nav className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-50">
        <div className="container-mobile">
          <div className="flex justify-between items-center h-14 sm:h-16">
            <div className="flex items-center space-x-2">
              <Shield className="w-5 h-5 sm:w-6 sm:h-6 text-primary-600" />
              <span className="font-display font-bold text-sm sm:text-lg text-gray-900">Admin Panel</span>
            </div>
            <button
              onClick={() => loadData()}
              className="p-2 text-gray-500 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
              title="Muat ulang data siswa"
              aria-label="Muat ulang data siswa"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <button
              onClick={handleLogout}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors text-xs sm:text-sm font-medium"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Keluar</span>
            </button>
          </div>
        </div>
      </nav>

      <main className="container-mobile py-4 sm:py-6 max-w-2xl mx-auto">
        {loadError && (
          <div className="mb-4 flex items-start space-x-2 bg-red-50 border border-red-200 rounded-xl p-3">
            <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 shrink-0" />
            <div>
              <p className="text-xs font-semibold text-red-800">Gagal memuat data</p>
              <p className="text-xs text-red-700">{loadError}</p>
            </div>
          </div>
        )}

        {/* Stats ringkas — 1 baris, tanpa kartu besar */}
        <section className="mb-4">
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm divide-x divide-gray-100 grid grid-cols-4">
            {statCards.map((stat, i) => (
              <div key={i} className="px-2 py-2.5 text-center min-w-0">
                <div className="text-sm sm:text-lg font-display font-bold text-gray-900 leading-tight">
                  {stat.value === undefined || stat.value === null ? (
                    <span className="inline-block w-7 h-4 bg-gray-100 rounded animate-pulse align-middle" />
                  ) : (
                    <>{stat.value}{stat.suffix}</>
                  )}
                </div>
                <div className="text-[10px] sm:text-xs text-gray-500 truncate">{stat.label}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Tab navigation */}
        <section className="mb-4">
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-1 grid grid-cols-3 gap-1">
            {TABS.map(tab => {
              const Icon = tab.icon
              const isActive = activeTab === tab.id
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center justify-center space-x-1.5 py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-primary-600 text-white shadow-sm'
                      : 'text-gray-500 hover:bg-gray-50'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  <span>{tab.label}</span>
                  {tab.count !== undefined && (
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                      isActive ? 'bg-white/25' : 'bg-gray-100 text-gray-500'
                    }`}>
                      {tab.count}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </section>

        {/* ================= TAB: INPUT SKOR ================= */}
        {activeTab === 'input' && (
          <motion.section
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-5 sm:mb-6"
          >
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-3.5 sm:p-4">
              <form onSubmit={handleSubmitScore} className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1.5">Pilih Rombel *</label>
                  <select value={selectedRombel} onChange={(e) => handleRombelChange(e.target.value)} className="input-field bg-white">
                    <option value="">-- Semua Rombel --</option>
                    {rombelOptions.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>

                {/* Player Select */}
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1.5">Pilih Pemain *</label>
                  <select
                    value={selectedPlayerId}
                    onChange={(e) => handlePlayerChange(e.target.value)}
                    className="input-field bg-white"
                    disabled={attemptHistory.length > 0 && !roundProgress?.is_complete}
                  >
                    <option value="">-- Pilih Pemain --</option>
                    {filteredPlayers.map(p => (
                      <option key={p.id} value={p.id}>{p.name} · {p.rombel}</option>
                    ))}
                  </select>
                  {playerPagination?.total > players.length && (
                    <p className="text-xs text-amber-600 mt-1">
                      Menampilkan {players.length} dari {playerPagination.total} siswa. Gunakan tab Pemain untuk mencari siswa lain.
                    </p>
                  )}
                  {attemptHistory.length > 0 && !roundProgress?.is_complete && (
                    <p className="text-xs text-gray-400 mt-1">
                      Selesaikan 5 percobaan dulu, atau tekan "Ganti Pemain".
                    </p>
                  )}
                </div>

                {/* Progress indicator */}
                {selectedPlayerId && (
                  <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold text-gray-700">
                        {selectedPlayer?.name}
                      </span>
                      <span className="text-xs text-gray-500">
                        Percobaan {Math.min(currentAttempt, maxAttempts)}/{maxAttempts}
                      </span>
                    </div>
                    <div className="flex gap-1.5">
                      {Array.from({ length: maxAttempts }, (_, i) => i + 1).map(n => {
                        const logged = attemptHistory.find(a => a.attempt === n)
                        return (
                          <div
                            key={n}
                            className={`flex-1 h-9 rounded flex flex-col items-center justify-center border leading-none ${
                              logged
                                ? logged.successful
                                    ? 'bg-green-100 border-green-300 text-green-700'
                                    : 'bg-red-50 border-red-200 text-red-600'
                                : n === currentAttempt
                                  ? 'bg-primary-50 border-primary-400 text-primary-700'
                                  : 'bg-white border-gray-200 text-gray-300'
                            }`}
                          >
                            <span className="text-xs font-bold">
                              {logged ? (logged.successful ? logged.points : '×') : n}
                            </span>
                            {logged && (
                              <span className="text-[9px] opacity-70 mt-0.5">
                                {logged.zone || 'luar'}
                              </span>
                            )}
                          </div>
                        )
                      })}
                    </div>
                    {roundProgress && (
                      <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-200">
                        <span className="text-xs text-gray-500">Total skor ronde</span>
                        <span className="text-sm font-display font-bold text-primary-600">
                          {roundProgress.total_score} pts
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {/* Round complete banner */}
                {roundProgress?.is_complete ? (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-center">
                    <Check className="w-5 h-5 text-green-600 mx-auto mb-1" />
                    <p className="text-sm font-semibold text-green-800">Ronde Selesai!</p>
                    <p className="text-xs text-green-700 mb-3">
                      {selectedPlayer?.name} — {roundProgress.total_score} poin
                    </p>
                    <button
                      type="button"
                      onClick={startNewPlayer}
                      className="btn-primary w-full inline-flex items-center justify-center space-x-2"
                    >
                      <RotateCcw className="w-4 h-4" />
                      <span>Ganti Pemain</span>
                    </button>
                  </div>
                ) : (
                  <>
                    {/* Status */}
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1.5">Hasil Lemparan</label>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setIsSuccessful(true)}
                          className={`flex-1 flex items-center justify-center space-x-1.5 p-2.5 border rounded-lg text-xs font-medium transition-colors ${
                            isSuccessful ? 'border-green-500 bg-green-50 text-green-700' : 'border-gray-200 text-gray-500'
                          }`}
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Masuk</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setIsSuccessful(false)}
                          className={`flex-1 flex items-center justify-center space-x-1.5 p-2.5 border rounded-lg text-xs font-medium transition-colors ${
                            !isSuccessful ? 'border-red-500 bg-red-50 text-red-700' : 'border-gray-200 text-gray-500'
                          }`}
                        >
                          <X className="w-3.5 h-3.5" />
                          <span>Meleset</span>
                        </button>
                      </div>
                    </div>

                    {/* Pilih lubang lewat replika papan */}
                    {isSuccessful && (
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <label className="block text-xs font-medium text-gray-700">
                            Tap lubang tempat bola masuk *
                          </label>
                          {selectedHole && (
                            <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                              selectedHole.is_jackpot ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'
                            }`}>
                              {selectedHole.points} pts
                            </span>
                          )}
                        </div>

                        <div className="bg-gray-50 rounded-lg p-2 border border-gray-100">
                          <div className="mx-auto" style={{ maxWidth: '260px' }}>
                            <BoardPicker
                              value={zoneName}
                              onChange={(hole) => setZoneName(hole.id)}
                              disabled={isSubmitting}
                            />
                          </div>
                        </div>

                        <p className="text-xs text-gray-400 mt-1.5">
                          Posisi lubang di layar sama persis dengan papan fisik.
                        </p>
                      </div>
                    )}

                    {formError && (
                      <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2.5 rounded-lg text-xs">
                        {formError}
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={isSubmitting || isLoadingPlayerHistory || !selectedPlayerId}
                      className="btn-primary w-full inline-flex items-center justify-center space-x-2 disabled:opacity-60"
                    >
                      {isLoadingPlayerHistory ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          <span>Memuat ronde siswa...</span>
                        </>
                      ) : isSubmitting ? (
                        <>
                          <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                          </svg>
                          <span>Menyimpan...</span>
                        </>
                      ) : (
                        <>
                          <span>Simpan Percobaan {Math.min(currentAttempt, maxAttempts)}</span>
                          <ChevronRight className="w-4 h-4" />
                        </>
                      )}
                    </button>

                    {attemptHistory.length > 0 && (
                      <button
                        type="button"
                        onClick={startNewPlayer}
                        className="w-full text-xs text-gray-500 hover:text-gray-700 py-1"
                      >
                        Batalkan & ganti pemain
                      </button>
                    )}
                  </>
                )}
              </form>
            </div>
          </motion.section>
        )}

        {/* ================= TAB: PEMAIN ================= */}
        {activeTab === 'players' && (
        <motion.section
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-5 sm:mb-6"
        >
          {/* Siapkan daftar siswa: supaya guru bisa input skor manual lebih dulu
              dan siswa di lapangan tinggal memilih namanya. */}
          <AddStudentsPanel
            onAdded={(data) => {
              setSearchQuery('')
              // Import bisa memuat beberapa rombel sekaligus — filter ke rombel
              // pertama yang benar-benar dapat siswa baru.
              const rombelPertama = data.rombel || Object.keys(data.by_rombel || {})[0] || ''
              setSelectedRombel(rombelPertama)
              loadData(undefined, rombelPertama)
            }}
          />

          <div className="flex items-center justify-between mb-3">
            <div className="flex flex-grow gap-2 mr-2">
              {/* Lewat handleRombelChange supaya daftar dimuat ulang dari API dengan
                  filter rombel ini — kalau hanya set state, list bisa masih berisi
                  rombel sebelumnya (dari tab Input) dan "pilih semua" jadi menyesatkan. */}
              <select value={selectedRombel} onChange={(e) => handleRombelChange(e.target.value)} className="px-2 py-2 border border-gray-200 rounded-lg text-sm bg-white">
                <option value="">Semua</option>
                {rombelOptions.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
              <div className="relative flex-grow">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input type="text" placeholder="Cari nama atau WA..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-100 text-sm" />
              </div>
            </div>
            <button
              onClick={handleExport}
              className="shrink-0 inline-flex items-center space-x-1.5 px-3 py-2 bg-white border border-gray-200 rounded-lg text-xs text-gray-600 hover:bg-gray-50"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Export</span>
            </button>
          </div>

          {/* Baris seleksi massal — satu baris supaya tidak menambah panjang halaman */}
          {filteredPlayers.length > 0 && (
            <div
              className={`mb-2 flex items-center justify-between gap-2 rounded-xl px-3 py-2 border transition-colors ${
                selectedPlayers.length > 0 ? 'bg-red-50 border-red-200' : 'bg-white border-gray-100'
              }`}
            >
              <label className="inline-flex items-center gap-2 text-xs text-gray-600 cursor-pointer select-none min-w-0">
                <input
                  type="checkbox"
                  checked={allFilteredSelected}
                  ref={(el) => {
                    if (el) el.indeterminate = someFilteredSelected && !allFilteredSelected
                  }}
                  onChange={toggleAllFiltered}
                  className="w-4 h-4 accent-red-600 shrink-0"
                  aria-label="Pilih semua siswa yang tampil"
                />
                <span className="truncate">Pilih semua ({filteredPlayers.length})</span>
              </label>

              {selectedPlayers.length > 0 ? (
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="text-xs font-semibold text-red-700">
                    {selectedPlayers.length} dipilih
                  </span>
                  <button
                    onClick={() => setSelectedIds([])}
                    disabled={isDeleting}
                    className="text-xs text-gray-500 hover:text-gray-700 px-1.5 py-1 disabled:opacity-50"
                  >
                    Batal
                  </button>
                  <button
                    onClick={handleDeleteSelected}
                    disabled={isDeleting}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-red-600 text-white rounded-lg text-xs font-medium hover:bg-red-700 disabled:opacity-60"
                  >
                    {isDeleting ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="w-3.5 h-3.5" />
                    )}
                    <span>
                      {isDeleting && deleteProgress
                        ? `${deleteProgress.done}/${deleteProgress.total}`
                        : 'Hapus'}
                    </span>
                  </button>
                </div>
              ) : (
                <span className="text-xs text-gray-400 shrink-0">Centang untuk hapus massal</span>
              )}
            </div>
          )}

          {/* Players List — scroll internal supaya halaman tidak memanjang */}
          <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
            {players.length === 0 && (
              <div className="bg-white rounded-xl p-5 text-center border border-gray-100">
                <Users className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-500">
                  {selectedRombel
                    ? `Belum ada siswa di rombel ${selectedRombel}. Tambahkan lewat panel di atas.`
                    : 'Belum ada pemain terdaftar'}
                </p>
              </div>
            )}

            {filteredPlayers.map((player) => (
              <div
                key={player.id}
                className={`rounded-xl shadow-sm p-3 border flex items-center gap-2.5 transition-colors ${
                  isSelected(player.id) ? 'bg-red-50/60 border-red-200' : 'bg-white border-gray-100'
                }`}
              >
                <input
                  type="checkbox"
                  checked={isSelected(player.id)}
                  onChange={() => toggleOne(player.id)}
                  className="w-4 h-4 accent-red-600 shrink-0"
                  aria-label={`Pilih ${player.name}`}
                />
                <div className="min-w-0 flex-grow">
                  <h3 className="font-semibold text-sm text-gray-900 truncate">{player.name}</h3>
                  <p className="text-xs text-gray-400">{player.rombel}</p>
                  <div className="flex items-center space-x-2 mt-0.5">
                    <span className="text-xs text-gray-500">Manual {player.manual_score}</span>
                    <span className="text-xs text-gray-500">Sim {player.simulation_score}</span>
                    <span className="text-xs font-semibold text-primary-600">Final {player.final_score}</span>
                  </div>
                </div>
                <div className="shrink-0 flex items-center gap-1.5">
                  <button
                    onClick={() => { setActiveTab('input'); handlePlayerChange(String(player.id)) }}
                    className="inline-flex items-center space-x-1 px-2.5 py-1.5 bg-primary-50 text-primary-600 rounded-lg text-xs font-medium hover:bg-primary-100"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Skor</span>
                  </button>
                  <button
                    onClick={() => handleDeletePlayer(player)}
                    className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                    title={`Hapus ${player.name}`}
                    aria-label={`Hapus ${player.name}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}

            {players.length > 0 && filteredPlayers.length === 0 && (
              <div className="bg-white rounded-xl p-5 text-center border border-gray-100">
                <p className="text-sm text-gray-500">Tidak ada pemain cocok dengan "{searchQuery}"</p>
              </div>
            )}
          </div>
        </motion.section>
        )}

        {/* ================= TAB: RONDE ================= */}
        {activeTab === 'rounds' && (
        <motion.section
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-5"
        >
          <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
            {recentRounds.length === 0 && (
              <div className="bg-white rounded-xl p-5 text-center border border-gray-100">
                <Gamepad2 className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-500">Belum ada ronde selesai</p>
              </div>
            )}

            {recentRounds.map((round) => (
              <div key={round.id} className="bg-white rounded-xl shadow-sm px-3 py-2.5 border border-gray-100 flex items-center gap-3">
                <div className="min-w-0 flex-grow">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-sm text-gray-900 truncate">{round.player_name}</h3>
                    <span className={`badge shrink-0 ${round.game_mode === 'manual' ? 'badge-accent-blue' : 'badge-accent-green'}`}>
                      {round.game_mode === 'manual' ? 'Manual' : 'Simulasi'}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {round.attempts_count} percobaan ·{' '}
                    {new Date(round.end_time || round.created_at).toLocaleString('id-ID', {
                      day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
                    })}
                  </p>
                </div>
                <span className="font-display font-bold text-primary-600 text-base shrink-0">
                  {round.total_score}
                </span>
                <button
                  onClick={() => handleDeleteRound(round.id)}
                  className="shrink-0 p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded"
                  title="Hapus ronde"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>

          {/* Audit Trail Notice — hanya di tab ronde */}
          <div className="bg-blue-50 rounded-xl p-3 border border-blue-100 mt-4">
            <div className="flex items-start space-x-2">
              <AlertCircle className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
              <p className="text-xs text-blue-700 leading-relaxed">
                <span className="font-semibold text-blue-900">Audit Trail</span> — semua aktivitas
                admin dicatat dengan timestamp dan IP untuk akuntabilitas.
              </p>
            </div>
          </div>
        </motion.section>
        )}
      </main>
    </div>
  )
}

export default AdminDashboardPage

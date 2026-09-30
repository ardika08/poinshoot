import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Trophy, Crown, Medal, User, Calendar, TrendingUp, Lock, AlertCircle, UserPlus, Crosshair } from 'lucide-react'
import api, { playerStorage } from '../lib/api'
import { ROMBELS } from '../lib/rombels'

// Nilai chip "Semua" — artinya tanpa filter rombel (papan seluruh sekolah).
const ALL_ROMBEL = 'all'

const LeaderboardPage = () => {
  // Identitas siswa dibaca sekali saat halaman dibuka. Dipakai untuk dua hal:
  // memilih kelasnya secara otomatis, dan menampilkan baris "posisi kamu".
  const [me] = useState(() => playerStorage.get())
  const [scope, setScope] = useState('all_time')

  // Default = kelas siswa sendiri. Anak yang baru selesai main langsung melihat
  // papan kelasnya, bukan papan sekolah yang peringkatnya jauh di bawah.
  const [rombel, setRombel] = useState(me?.rombel || ALL_ROMBEL)

  const [leaderboard, setLeaderboard] = useState([])
  const [you, setYou] = useState(null)
  const [total, setTotal] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const navigate = useNavigate()

  // 1 tap dari leaderboard: siswa selesai bermain, bersihkan sesinya lalu kembali
  // ke form pendaftaran untuk siswa berikutnya. Skor sudah tersimpan di server,
  // jadi tidak perlu konfirmasi seperti di halaman main.
  const handleSwitchPlayer = () => {
    playerStorage.clear()
    navigate('/')
  }

  useEffect(() => {
    const controller = new AbortController()
    setIsLoading(true)
    setError('')

    const isAll = rombel === ALL_ROMBEL

    api.getLeaderboard(scope, {
      rombel: isAll ? undefined : rombel,
      playerId: me?.id,
      // Papan kelas memuat lebih banyak baris — anak perlu melihat teman sekelasnya,
      // 10 besar tidak cukup. Papan sekolah tetap ringkas.
      limit: isAll ? 10 : 50,
      signal: controller.signal,
    })
      .then(data => {
        setLeaderboard(data.top_players || [])
        setYou(data.you || null)
        setTotal(data.total ?? (data.top_players || []).length)
        setIsLoading(false)
      })
      .catch(err => {
        if (err.name === 'AbortError') return
        setError(err.message || 'Gagal memuat leaderboard')
        setLeaderboard([])
        setYou(null)
        setTotal(0)
        setIsLoading(false)
      })

    return () => controller.abort()
  }, [scope, rombel, me])

  const scopeOptions = [
    { id: 'all_time', label: 'All Time', icon: TrendingUp },
    { id: 'weekly', label: 'Weekly', icon: Calendar },
    { id: 'monthly', label: 'Monthly', icon: Calendar }
  ]

  const scopeLabel = scope === 'all_time' ? 'Semua Waktu' : scope === 'weekly' ? 'Minggu Ini' : 'Bulan Ini'
  const viewLabel = rombel === ALL_ROMBEL ? 'seluruh sekolah' : `kelas ${rombel}`

  const chipClass = (isActive) =>
    `shrink-0 px-3.5 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all duration-200 ${
      isActive ? 'bg-primary-600 text-white shadow-sm' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
    }`

  // Podium positions (mengikuti filter kelas yang aktif)
  const podiumData = [
    { rank: 2, player: leaderboard[1] },
    { rank: 1, player: leaderboard[0] },
    { rank: 3, player: leaderboard[2] }
  ].filter(pos => pos.player && scope === 'all_time')

  const getPodiumClass = (rank) => {
    if (rank === 1) return 'podium-1st'
    if (rank === 2) return 'podium-2nd'
    return 'podium-3rd'
  }

  const getRankColor = (rank) => {
    if (rank === 1) return 'bg-yellow-400 text-white'
    if (rank === 2) return 'bg-gray-300 text-gray-700'
    if (rank === 3) return 'bg-orange-400 text-white'
    return 'bg-primary-100 text-primary-600'
  }

  return (
    <div className="container-narrow py-6 sm:py-10">
      {/* Header */}
      <div className="text-center mb-6 sm:mb-8">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="inline-flex items-center space-x-2 bg-white shadow-sm rounded-xl px-4 py-2.5 sm:px-5 sm:py-3 mb-4"
        >
          <Trophy className="w-6 h-6 sm:w-7 sm:h-7 text-yellow-500" fill="currentColor" />
          <div className="text-left">
            <h1 className="text-base sm:text-lg font-display font-bold text-gray-900">Leaderboard</h1>
            <p className="text-xs text-gray-500 hidden sm:block">Skor final manual + simulasi</p>
          </div>
        </motion.div>

        {/* 1 tap untuk siswa berikutnya — ditaruh di atas supaya langsung terlihat
            tanpa perlu scroll setelah siswa selesai bermain. */}
        <button
          type="button"
          onClick={handleSwitchPlayer}
          className="btn-primary w-full max-w-xs mx-auto flex items-center justify-center space-x-2 mb-4"
        >
          <UserPlus className="w-5 h-5" />
          <span>Ganti Pemain</span>
        </button>

        {/* Tab Navigation - Scrollable on mobile */}
        <div className="flex justify-center gap-2">
          {scopeOptions.map((option) => {
            const isActive = scope === option.id
            const Icon = option.icon
            return (
              <button
                key={option.id}
                onClick={() => setScope(option.id)}
                className={`tab-button inline-flex items-center space-x-1.5 ${isActive ? 'tab-button-active' : 'tab-button-inactive'}`}
              >
                <Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                <span>{option.label}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Filter kelas — inti perbaikan: papan sekolah (top 10) membuat mayoritas
          siswa tidak menemukan namanya. Anak memilih kelasnya dan melihat teman
          sekelasnya, plus baris "posisi kamu" di bawah. */}
      <div className="mb-5">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Pilih Kelas</h2>
          {me?.rombel && rombel !== me.rombel && (
            <button
              type="button"
              onClick={() => setRombel(me.rombel)}
              className="text-xs font-semibold text-primary-600 hover:text-primary-700"
            >
              Kelasku ({me.rombel})
            </button>
          )}
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
          <button type="button" onClick={() => setRombel(ALL_ROMBEL)} className={chipClass(rombel === ALL_ROMBEL)}>
            Semua
          </button>
          {ROMBELS.map((r) => (
            <button key={r} type="button" onClick={() => setRombel(r)} className={chipClass(rombel === r)}>
              {r}
            </button>
          ))}
        </div>
      </div>

      {/* Posisi kamu — dikirim server walau peringkatnya di luar daftar, supaya
          siswa tidak perlu mencari namanya sendiri di papan. */}
      {!isLoading && me && (
        you ? (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-5 rounded-2xl p-4 bg-gradient-to-br from-primary-600 to-primary-500 text-white shadow-lg"
          >
            <div className="flex items-center space-x-2 mb-2 opacity-90">
              <Crosshair className="w-4 h-4" />
              <span className="text-xs font-semibold uppercase tracking-wide">Posisi Kamu</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="font-display font-bold text-base sm:text-lg truncate">
                  {you.name} <span className="text-sm font-semibold opacity-80">{you.rombel}</span>
                </p>
                <p className="text-xs opacity-90">
                  {you.manual_score} manual + {you.simulation_score} simulasi
                </p>
              </div>
              <div className="text-right shrink-0">
                <div className="font-display font-bold text-2xl sm:text-3xl leading-none">
                  {you.rank ? `#${you.rank}` : '—'}
                </div>
                <div className="text-xs opacity-90 mt-0.5">
                  {you.final_score} pts{total > 0 && ` · dari ${total}`}
                </div>
              </div>
            </div>
            <p className="text-xs mt-2 opacity-90">
              {you.rank
                ? `Peringkat ${viewLabel} · ${scopeLabel}`
                : 'Belum ada skor tercatat — main dulu untuk masuk papan!'}
            </p>
          </motion.div>
        ) : (
          <div className="mb-5 flex items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white p-3">
            <p className="text-xs text-gray-600">
              Kamu terdaftar di kelas <span className="font-semibold text-gray-900">{me.rombel}</span> — kelas ini bukan kelasmu.
            </p>
            <button
              type="button"
              onClick={() => setRombel(me.rombel)}
              className="shrink-0 text-xs font-semibold text-primary-600 hover:text-primary-700"
            >
              Lihat kelasku
            </button>
          </div>
        )
      )}

      {/* Podium Section (All-Time only) */}
      {scope === 'all_time' && podiumData.length === 3 && (
        <motion.section
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4 }}
          className="mb-6 sm:mb-8"
        >
          <div className="podium-container">
            {podiumData.map((pos, idx) => (
              <div key={idx} className={`podium-step ${getPodiumClass(pos.rank)} relative`}>
                {/* Crown on 1st place */}
                {pos.rank === 1 && (
                  <div className="absolute -top-6 left-1/2 -translate-x-1/2">
                    <Crown className="w-6 h-6 sm:w-8 sm:h-8 text-yellow-600" fill="currentColor" />
                  </div>
                )}
                {/* Player info inside podium */}
                <div className="text-center w-full px-1">
                  <h3 className={`font-display font-bold text-gray-800 ${pos.rank === 1 ? 'text-sm sm:text-lg' : 'text-xs sm:text-base'} truncate`}>
                    {pos.player?.name?.split(' ')[0]}
                  </h3>
                  <p className={`font-bold ${pos.rank === 1 ? 'text-xs sm:text-sm' : 'text-xs'} ${pos.rank === 1 ? 'text-yellow-800' : 'text-gray-600'}`}>
                    {pos.player?.final_score} pts
                  </p>
                </div>
              </div>
            ))}
          </div>
        </motion.section>
      )}

      {/* Ranking List (Mobile: Card-based, Desktop: Table) */}
      <section>
        <div className="flex items-center justify-between mb-3 sm:mb-4">
          <h2 className="text-sm sm:text-lg font-display font-bold text-gray-900">
            {scopeLabel}
            <span className="text-primary-600"> · {rombel === ALL_ROMBEL ? 'Semua Kelas' : `Kelas ${rombel}`}</span>
          </h2>
          <div className="flex items-center space-x-1.5 text-xs text-gray-500">
            <User className="w-3.5 h-3.5" />
            <span>{isLoading ? '—' : `${total} pemain`}</span>
          </div>
        </div>

        {error && (
          <div className="mb-3 flex items-start space-x-2 bg-red-50 border border-red-200 rounded-xl p-3">
            <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 shrink-0" />
            <div>
              <p className="text-xs font-semibold text-red-800">Gagal memuat data</p>
              <p className="text-xs text-red-700">{error}</p>
            </div>
          </div>
        )}

        {isLoading && (
          <div className="space-y-2">
            {[0, 1, 2, 3, 4].map(i => (
              <div key={i} className="flex items-center space-x-3 p-3 rounded-xl border border-gray-100 bg-white">
                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-gray-100 animate-pulse shrink-0" />
                <div className="flex-grow space-y-1.5">
                  <div className="h-3.5 bg-gray-100 rounded animate-pulse w-1/2" />
                  <div className="h-2.5 bg-gray-100 rounded animate-pulse w-1/4" />
                </div>
                <div className="h-6 w-10 bg-gray-100 rounded animate-pulse shrink-0" />
              </div>
            ))}
          </div>
        )}

        {!isLoading && (
        <div className="space-y-2">
          {leaderboard.map((player, index) => {
            const isTop3 = scope === 'all_time' && index < 3
            const isMe = player.is_you
            return (
              <motion.div
                key={player.player_id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                className={`flex items-center space-x-3 p-3 rounded-xl border ${
                  isMe
                    ? 'bg-primary-50 border-primary-400 ring-2 ring-primary-300'
                    : isTop3
                      ? 'bg-gradient-to-r from-primary-50 to-primary-100/50 border-primary-200'
                      : 'bg-white border-gray-100'
                }`}
              >
                {/* Rank badge */}
                <div className={`flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 rounded-full font-display font-bold text-sm sm:text-base shrink-0 ${getRankColor(player.rank || index + 1)}`}>
                  {player.rank || index + 1}
                </div>

                {/* Player name */}
                <div className="flex-grow min-w-0">
                  <h3 className="font-semibold text-sm sm:text-base text-gray-900 truncate">
                    {player.name} <span className="text-xs text-primary-600">{player.rombel}</span>
                    {isMe && (
                      <span className="ml-1.5 align-middle text-[10px] font-bold uppercase tracking-wide bg-primary-600 text-white rounded px-1.5 py-0.5">
                        Kamu
                      </span>
                    )}
                  </h3>
                  <p className="text-xs text-gray-400">
                    {player.achieved_date ? new Date(player.achieved_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }) : 'Belum lengkap'}
                  </p>
                </div>

                {/* Score */}
                <div className="text-right shrink-0">
                  <div className="text-lg sm:text-xl font-display font-bold text-primary-600">{player.final_score}</div>
                  <div className="text-xs text-gray-400 uppercase">pts</div>
                </div>
              </motion.div>
            )
          })}

          {leaderboard.length === 0 && (
            <div className="text-center py-10 bg-white rounded-2xl shadow-sm">
              <Trophy className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <h3 className="text-base font-semibold text-gray-600 mb-1">Belum ada data</h3>
              <p className="text-sm text-gray-400 mb-4">
                {rombel === ALL_ROMBEL
                  ? 'Mulai bermain untuk masuk leaderboard!'
                  : `Belum ada skor di kelas ${rombel}.`}
              </p>
              <a href="/play" className="btn-primary inline-block">Mainkan Sekarang</a>
            </div>
          )}
        </div>
        )}
      </section>

      {/* Tombol yang sama diulang di bawah daftar: siswa sering discroll sampai
          bawah untuk melihat peringkatnya, jadi tombolnya jangan hanya di atas. */}
      {!isLoading && leaderboard.length > 0 && (
        <button
          type="button"
          onClick={handleSwitchPlayer}
          className="btn-secondary w-full flex items-center justify-center space-x-2 mt-4"
        >
          <UserPlus className="w-4 h-4" />
          <span>Ganti Pemain — siswa berikutnya</span>
        </button>
      )}

      {/* Privacy Info */}
      <div className="mt-6 sm:mt-8 bg-blue-50 rounded-xl p-4 border border-blue-100">
        <div className="flex items-center space-x-2 mb-2">
          <Lock className="w-4 h-4 text-blue-600" />
          <h3 className="font-semibold text-xs sm:text-sm text-blue-900">Privasi Terlindungi</h3>
        </div>
        <p className="text-xs text-blue-700 leading-relaxed">
          Data siswa hanya berisi nama dan kelas. Nama yang tampil di leaderboard adalah nama yang didaftarkan saat bermain.
        </p>
      </div>
    </div>
  )
}

export default LeaderboardPage

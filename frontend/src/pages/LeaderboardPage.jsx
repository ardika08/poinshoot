import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Trophy, Crown, Medal, User, Calendar, TrendingUp, Lock, AlertCircle } from 'lucide-react'
import api from '../lib/api'

const LeaderboardPage = () => {
  const [scope, setScope] = useState('all_time')
  const [leaderboard, setLeaderboard] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const controller = new AbortController()
    setIsLoading(true)
    setError('')

    api.getLeaderboard(scope, controller.signal)
      .then(data => {
        setLeaderboard(data.top_players || [])
        setIsLoading(false)
      })
      .catch(err => {
        if (err.name === 'AbortError') return
        setError(err.message || 'Gagal memuat leaderboard')
        setLeaderboard([])
        setIsLoading(false)
      })

    return () => controller.abort()
  }, [scope])

  const scopeOptions = [
    { id: 'all_time', label: 'All Time', icon: TrendingUp },
    { id: 'weekly', label: 'Weekly', icon: Calendar },
    { id: 'monthly', label: 'Monthly', icon: Calendar }
  ]

  // Podium positions
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
            {scope === 'all_time' ? 'Semua Waktu' : scope === 'weekly' ? 'Minggu Ini' : 'Bulan Ini'}
          </h2>
          <div className="flex items-center space-x-1.5 text-xs text-gray-500">
            <User className="w-3.5 h-3.5" />
            <span>{isLoading ? '—' : `${leaderboard.length} pemain`}</span>
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
            return (
              <motion.div
                key={player.player_id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                className={`flex items-center space-x-3 p-3 rounded-xl border ${
                  isTop3 ? 'bg-gradient-to-r from-primary-50 to-primary-100/50 border-primary-200' : 'bg-white border-gray-100'
                }`}
              >
                {/* Rank badge */}
                <div className={`flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 rounded-full font-display font-bold text-sm sm:text-base shrink-0 ${getRankColor(player.rank || index + 1)}`}>
                  {player.rank || index + 1}
                </div>

                {/* Player name */}
                <div className="flex-grow min-w-0">
                  <h3 className="font-semibold text-sm sm:text-base text-gray-900 truncate">{player.name} <span className="text-xs text-primary-600">{player.rombel}</span></h3>
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
              <p className="text-sm text-gray-400 mb-4">Mulai bermain untuk masuk leaderboard!</p>
              <a href="/play" className="btn-primary inline-block">Mainkan Sekarang</a>
            </div>
          )}
        </div>
        )}
      </section>

      {/* Privacy Info */}
      <div className="mt-6 sm:mt-8 bg-blue-50 rounded-xl p-4 border border-blue-100">
        <div className="flex items-center space-x-2 mb-2">
          <Lock className="w-4 h-4 text-blue-600" />
          <h3 className="font-semibold text-xs sm:text-sm text-blue-900">Privasi Terlindungi</h3>
        </div>
        <p className="text-xs text-blue-700 leading-relaxed">
          Nomor WhatsApp tidak ditampilkan untuk keamanan siswa SD. Hanya nama yang tampil di leaderboard.
        </p>
      </div>
    </div>
  )
}

export default LeaderboardPage

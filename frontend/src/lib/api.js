/**
 * API client — Shoot Points
 * Semua request ke backend Laravel lewat sini.
 */

const BASE_URL = import.meta.env.VITE_API_URL || 'http://43.134.66.81:8083/api/v1'

const ADMIN_TOKEN_KEY = 'shoot_admin_token'
const PLAYER_KEY = 'shoot_player'

/** Error dengan payload dari backend */
export class ApiError extends Error {
  constructor(message, { code, status, errors } = {}) {
    super(message)
    this.name = 'ApiError'
    this.code = code || 'UNKNOWN_ERROR'
    this.status = status
    this.errors = errors || {}
  }
}

// ---------- token storage ----------

export const adminToken = {
  get: () => localStorage.getItem(ADMIN_TOKEN_KEY),
  set: (token) => localStorage.setItem(ADMIN_TOKEN_KEY, token),
  clear: () => localStorage.removeItem(ADMIN_TOKEN_KEY),
}

export const playerStorage = {
  get: () => {
    try {
      const raw = localStorage.getItem(PLAYER_KEY)
      return raw ? JSON.parse(raw) : null
    } catch {
      return null
    }
  },
  set: (player) => localStorage.setItem(PLAYER_KEY, JSON.stringify(player)),
  clear: () => localStorage.removeItem(PLAYER_KEY),
}

// ---------- core request ----------

async function request(path, { method = 'GET', body, auth = false, signal } = {}) {
  const headers = { Accept: 'application/json' }

  // FormData (unggahan file) tidak boleh diberi Content-Type manual — browser
  // yang menuliskan boundary-nya sendiri.
  const isFormData = typeof FormData !== 'undefined' && body instanceof FormData

  if (body !== undefined && !isFormData) headers['Content-Type'] = 'application/json'

  if (auth) {
    const token = adminToken.get()
    if (!token) {
      throw new ApiError('Sesi admin tidak ditemukan. Silakan login ulang.', {
        code: 'MISSING_AUTH_TOKEN',
        status: 401,
      })
    }
    headers['x-admin-token'] = token
  }

  let res
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : isFormData ? body : JSON.stringify(body),
      signal,
    })
  } catch (err) {
    if (err.name === 'AbortError') throw err
    throw new ApiError('Tidak dapat terhubung ke server. Cek koneksi internet.', {
      code: 'NETWORK_ERROR',
      status: 0,
    })
  }

  let payload = null
  try {
    payload = await res.json()
  } catch {
    // non-JSON response
  }

  if (!res.ok || payload?.success === false) {
    const err = payload?.error || {}

    // Token expired/invalid → bersihkan sesi
    if (res.status === 401 && auth) adminToken.clear()

    // Error validasi Laravel memakai bentuk { message, errors } tanpa `error.message`,
    // jadi ambil pesan pertama dari `errors` supaya pengguna tahu apa yang salah.
    const firstFieldError = payload?.errors ? Object.values(payload.errors)[0] : null
    const validationMessage = Array.isArray(firstFieldError) ? firstFieldError[0] : firstFieldError

    throw new ApiError(
      err.message || validationMessage || payload?.message || `Request gagal (${res.status})`,
      {
        code: err.code,
        status: res.status,
        errors: err.errors || payload?.errors,
      }
    )
  }

  return payload?.data ?? payload
}

// ---------- PUBLIC ----------

export const api = {
  /** Registrasi pemain baru */
  // mode: 'school' (nama + rombel) atau 'general' (nama saja, gelar karya)
  registerPlayer: (name, rombel, mode = 'school') =>
    request('/players', { method: 'POST', body: { name, rombel, mode } }),

  /** Cek apakah siswa (nama + rombel) sudah terdaftar */
  lookupPlayer: (name, rombel) =>
    request(`/players/lookup?name=${encodeURIComponent(name)}&rombel=${encodeURIComponent(rombel)}`),

  /**
   * Daftar nama siswa pada satu rombel — dipakai di lapangan supaya siswa
   * tinggal memilih namanya (tidak mengetik, tidak ada akun ganda).
   */
  getRoster: (rombel, signal) =>
    request(`/players/roster?rombel=${encodeURIComponent(rombel)}`, { signal }),

  /** Detail pemain + riwayat ronde */
  getPlayer: (id) => request(`/players/${id}`),

  /** Edit data pemain */
  updatePlayer: (id, data) => request(`/players/${id}`, { method: 'PUT', body: data }),

  /**
   * Leaderboard: scope = all_time | weekly | monthly.
   *
   * Opsi:
   *  - kategori : 'umum' | 'sekolah' → pisahkan papan gelar karya vs sekolah
   *  - rombel   : 1A-6B → batasi papan ke satu kelas
   *  - playerId : sertakan "posisi kamu" walau di luar peringkat yang ditampilkan
   *  - limit    : jumlah baris (default server: 10)
   *  - signal   : AbortController
   */
  getLeaderboard: (scope = 'all_time', { kategori, rombel, playerId, limit, signal } = {}) => {
    const params = new URLSearchParams()
    if (kategori) params.set('kategori', kategori)
    if (rombel) params.set('rombel', rombel)
    if (playerId) params.set('player_id', playerId)
    if (limit) params.set('limit', limit)
    const query = params.toString()
    return request(`/leaderboard/${scope}${query ? `?${query}` : ''}`, { signal })
  },

  /** Statistik publik untuk homepage */
  getPublicStats: (signal) => request('/stats', { signal }),

  /** Konfigurasi zona + physics game simulasi */
  getSimulationConfig: (signal) => request('/simulation/config', { signal }),

  /** Submit hasil 1 ronde simulasi (tepat 5 attempt) */
  submitSimulationRound: (playerId, attempts) =>
    request('/simulation/rounds', {
      method: 'POST',
      body: { player_id: playerId, attempts },
    }),

  // ---------- ADMIN ----------

  adminLogin: (username, password) =>
    request('/admin/login', { method: 'POST', body: { username, password } }),

  adminLogout: () => request('/admin/logout', { method: 'POST', auth: true }),

  adminMe: () => request('/admin/me', { auth: true }),

  adminStats: (signal) => request('/admin/stats', { auth: true, signal }),

  adminPlayers: ({ search = '', rombel = '', perPage = 100, page = 1 } = {}, signal) => {
    const params = new URLSearchParams()
    if (search) params.set('search', search)
    if (rombel) params.set('rombel', rombel)
    params.set('per_page', String(Math.min(perPage, 1000)))
    params.set('page', String(page))
    return request(`/admin/players?${params}`, { auth: true, signal })
  },

  /**
   * Tambah siswa dari dashboard (satu atau banyak sekaligus).
   * `names` boleh array nama atau teks satu-nama-per-baris.
   * Idempotent: nama+rombel yang sudah ada hanya dilaporkan sebagai duplikat.
   */
  adminAddPlayers: (rombel, names) =>
    request('/admin/players', { method: 'POST', auth: true, body: { rombel, names } }),

  /**
   * Import banyak siswa sekaligus: tempel dari Excel/Google Sheets ATAU unggah
   * berkas .xlsx/.csv/.txt. Rombel boleh ikut di dalam data, jadi satu kiriman
   * bisa mengisi beberapa rombel sekaligus.
   *
   * dryRun=true hanya MEMERIKSA (tidak menulis ke database) supaya operator
   * bisa melihat hasilnya dulu sebelum menekan Simpan.
   */
  adminImportPlayers: ({ text = '', file = null, rombel = '', dryRun = false } = {}) => {
    if (file) {
      const form = new FormData()
      form.append('file', file)
      if (rombel) form.append('rombel', rombel)
      form.append('dry_run', dryRun ? '1' : '0')

      return request('/admin/players/import', { method: 'POST', auth: true, body: form })
    }

    return request('/admin/players/import', {
      method: 'POST',
      auth: true,
      body: { text, rombel: rombel || undefined, dry_run: dryRun },
    })
  },

  adminLogs: ({ perPage = 30 } = {}, signal) =>
    request(`/admin/logs?per_page=${perPage}`, { auth: true, signal }),

  /** Input 1 attempt skor manual */
  adminSubmitGame: ({ playerId, attemptNumber, isSuccessful, points, zoneName }) =>
    request('/admin/games', {
      method: 'POST',
      auth: true,
      body: {
        player_id: Number(playerId),
        attempt_number: attemptNumber,
        is_successful: isSuccessful,
        points: isSuccessful ? points : 0,
        zone_name: isSuccessful ? zoneName : null,
        game_mode: 'manual',
      },
    }),

  adminRecentGames: ({ limit = 15 } = {}, signal) =>
    request(`/admin/games/recent?limit=${limit}`, { auth: true, signal }),

  adminPlayerGames: (playerId, signal) =>
    request(`/admin/games/player/${playerId}`, { auth: true, signal }),

  adminDeleteRound: (roundId) =>
    request(`/admin/rounds/${roundId}`, { method: 'DELETE', auth: true }),

  // Hapus pemain ikut menghapus ronde + game miliknya (backend pakai transaksi),
  // jadi skornya benar-benar hilang — bukan jadi baris yatim di leaderboard.
  adminDeletePlayer: (playerId) =>
    request(`/admin/players/${playerId}`, { method: 'DELETE', auth: true }),
}

/**
 * Fallback layout papan — dipakai kalau GET /simulation/config gagal.
 * Harus sinkron dengan backend/config/board.php.
 */
export const DEFAULT_BOARD = {
  max_attempts: 5,
  max_round_score: 500,
  canvas: {
    width: 320,
    height: 500,
    board: { x: 24, y: 44, width: 272, height: 296 },
    ball_start: { x: 160, y: 415 },
    ball_radius: 11,
  },
  physics: {
    aim_mode: 'slingshot',
    min_pull: 12,
    max_pull: 85,
    power_multiplier: 4.2,
    aim_drift: 12,
    power_levels: [
      { max: 0.35, color: '#22c55e', label: 'Lemah' },
      { max: 0.70, color: '#f59e0b', label: 'Sedang' },
      { max: 1.00, color: '#ef4444', label: 'Kuat' },
    ],
  },
  holes: [
    { id: 'h01', x: 201.4, y: 155.0, radius: 12, points: 100, color: '#2563eb', is_jackpot: true },
    { id: 'h02', x: 141.0, y: 225.1, radius: 18, points: 20, color: '#ef4444', is_jackpot: false },
    { id: 'h03', x: 229.1, y: 212.7, radius: 18, points: 15, color: '#06b6d4', is_jackpot: false },
    { id: 'h04', x: 238.1, y: 256.3, radius: 18, points: 20, color: '#f97316', is_jackpot: false },
    { id: 'h05', x: 190.2, y: 247.2, radius: 18, points: 10, color: '#eab308', is_jackpot: false },
    { id: 'h06', x: 252.4, y: 137.2, radius: 18, points: 20, color: '#22c55e', is_jackpot: false },
    { id: 'h07', x: 142.8, y: 106.3, radius: 18, points: 40, color: '#14b8a6', is_jackpot: false },
    { id: 'h08', x: 103.5, y: 314.9, radius: 18, points: 10, color: '#3b82f6', is_jackpot: false },
    { id: 'h09', x: 102.9, y: 130.8, radius: 18, points: 50, color: '#6366f1', is_jackpot: false },
    { id: 'h10', x: 173.8, y: 293.8, radius: 18, points: 20, color: '#a855f7', is_jackpot: false },
    { id: 'h11', x: 266.1, y: 296.4, radius: 18, points: 10, color: '#ec4899', is_jackpot: false },
    { id: 'h12', x: 63.8, y: 248.6, radius: 18, points: 40, color: '#84cc16', is_jackpot: false },
    { id: 'h13', x: 66.9, y: 97.3, radius: 18, points: 30, color: '#ef4444', is_jackpot: false },
    { id: 'h14', x: 144.6, y: 169.8, radius: 18, points: 20, color: '#f97316', is_jackpot: false },
    { id: 'h15', x: 51.1, y: 198.8, radius: 18, points: 30, color: '#eab308', is_jackpot: false },
    { id: 'h16', x: 90.2, y: 177.7, radius: 18, points: 30, color: '#22c55e', is_jackpot: false },
    { id: 'h17', x: 187.7, y: 73.3, radius: 18, points: 40, color: '#14b8a6', is_jackpot: false },
    { id: 'h18', x: 265.2, y: 83.6, radius: 18, points: 50, color: '#3b82f6', is_jackpot: false },
    { id: 'h19', x: 116.4, y: 271.3, radius: 18, points: 30, color: '#6366f1', is_jackpot: false },
    { id: 'h20', x: 102.4, y: 72.5, radius: 18, points: 10, color: '#a855f7', is_jackpot: false },
  ],
}

export default api

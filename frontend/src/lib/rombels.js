/**
 * Daftar rombel resmi — ATURAN FINAL: 1A-6B.
 *
 * Dipakai bersama oleh HomePage (picker nama), AddStudentsPanel (import massal),
 * dan LeaderboardPage (filter papan per kelas). Jangan dilonggarkan ke A-Z:
 * backend memvalidasi `^[1-6][AB]$` dan menolak kelas di luar itu.
 */
export const ROMBELS = [1, 2, 3, 4, 5, 6].flatMap((k) => ['A', 'B'].map((r) => `${k}${r}`))

export default ROMBELS

import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Users, GraduationCap, ArrowRight } from 'lucide-react'
import team from '../data/team'

// Muncul sekali per sesi browser. Tab/jendela baru = sesi baru.
const SESSION_KEY = 'shoot_team_intro_v1'

/**
 * Baca status "sudah pernah ditutup".
 * `?intro=1` memaksa muncul (berguna untuk demo/sidang),
 * `?intro=0` memaksa lewat (berguna saat menguji halaman lain).
 */
function shouldShow() {
  try {
    const params = new URLSearchParams(window.location.search)
    const force = params.get('intro')
    if (force === '1') return true
    if (force === '0') return false
    return sessionStorage.getItem(SESSION_KEY) !== '1'
  } catch {
    // sessionStorage diblokir (mode privat ketat) — tetap tampilkan sekali
    return true
  }
}

const TeamModal = () => {
  const [isOpen, setIsOpen] = useState(shouldShow)
  const panelRef = useRef(null)
  const startButtonRef = useRef(null)

  // Kunci scroll halaman selama modal terbuka, lalu kembalikan persis
  // seperti semula (body punya overflow-x: hidden dari index.css).
  useEffect(() => {
    if (!isOpen) return

    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const focusTimer = setTimeout(() => startButtonRef.current?.focus(), 80)

    return () => {
      clearTimeout(focusTimer)
      document.body.style.overflow = prevOverflow
    }
  }, [isOpen])

  // Esc dan klik backdrop sengaja TIDAK menutup modal.
  // Satu-satunya jalan keluar adalah tombol Mulai — itu inti permintaannya.
  // Tab tetap dikurung di dalam panel supaya fokus keyboard tidak lolos
  // ke halaman yang sedang tertutup.
  const handleKeyDown = (e) => {
    if (e.key !== 'Tab' || !panelRef.current) return

    const focusables = panelRef.current.querySelectorAll(
      'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    )
    if (focusables.length === 0) return

    const first = focusables[0]
    const last = focusables[focusables.length - 1]

    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault()
      last.focus()
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault()
      first.focus()
    }
  }

  const handleClose = () => {
    try {
      sessionStorage.setItem(SESSION_KEY, '1')
    } catch {
      // storage tidak tersedia — cukup tutup untuk sesi ini
    }
    setIsOpen(false)
  }

  if (!isOpen) return null

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.25 }}
      className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/75 backdrop-blur-sm p-3 sm:p-6"
      onKeyDown={handleKeyDown}
      role="dialog"
      aria-modal="true"
      aria-labelledby="team-modal-title"
      aria-describedby="team-modal-desc"
    >
      <motion.div
        ref={panelRef}
        initial={{ opacity: 0, scale: 0.96, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
        className="w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
      >
        <div className="overflow-y-auto">
          <div className="lg:grid lg:grid-cols-2">
            {/* Foto tim — di layar pendek tingginya dibatasi supaya daftar
                anggota tidak terdorong keluar. object-contain = seluruh foto
                tetap terlihat, tidak ada wajah yang terpotong (sisi kosong
                diisi warna latar). Di layar lebar baru di-crop mengisi kolom. */}
            <div className="relative flex items-center justify-center bg-primary-900 lg:block">
              <picture>
                <source srcSet={team.photo.webp} type="image/webp" />
                <img
                  src={team.photo.jpg}
                  alt={team.photo.alt}
                  className="h-auto w-full max-h-[22vh] object-contain sm:max-h-[32vh] lg:h-full lg:max-h-none lg:object-cover"
                  loading="eager"
                  decoding="async"
                />
              </picture>
              <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-primary-900/70 to-transparent lg:hidden" />
            </div>

            {/* Identitas tim */}
            <div className="p-4 sm:p-6">
              <span className="inline-block rounded-full bg-primary-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-primary-700 ring-1 ring-primary-100">
                Proyek Kepemimpinan · {team.prodi}
              </span>

              <h2
                id="team-modal-title"
                className="mt-3 font-display text-xl sm:text-2xl font-bold leading-snug text-gray-900 text-balance"
              >
                {team.headline}
              </h2>
              <p className="mt-1.5 text-sm sm:text-base text-gray-600">
                {team.subline}
              </p>

              <p
                id="team-modal-desc"
                className="mt-2 text-xs leading-relaxed text-gray-500 sm:mt-3 sm:text-sm"
              >
                Inovasi pembelajaran {team.prodi} melalui integrasi permainan digital
                dan fisik untuk meningkatkan keterampilan gerak dasar siswa sekolah dasar.
              </p>

              {/* Daftar anggota */}
              <div className="mt-3 sm:mt-5">
                <div className="flex items-center gap-2 text-gray-900">
                  <Users className="h-4 w-4 text-primary-600" />
                  <h3 className="text-sm font-semibold font-display">
                    Anggota Tim
                  </h3>
                  <span className="text-xs text-gray-400">
                    ({team.members.length} orang)
                  </span>
                </div>

                <ul className="mt-2 grid grid-cols-1 gap-x-4 gap-y-0.5 sm:mt-2.5 sm:grid-cols-2 sm:gap-y-1.5">
                  {team.members.map((member, index) => (
                    <li
                      key={`${member.name}-${index}`}
                      className="flex items-baseline gap-2 text-[13px] leading-snug sm:text-sm"
                    >
                      <span className="w-4 shrink-0 text-right text-xs font-mono text-gray-400">
                        {index + 1}.
                      </span>
                      <span className="min-w-0 flex-1 truncate font-medium text-gray-800">
                        {member.name}
                      </span>
                      <span className="shrink-0 font-mono text-xs text-gray-500">
                        {member.nim}
                      </span>
                    </li>
                  ))}
                </ul>

                <p className="mt-2 flex items-center gap-1.5 text-xs text-gray-400 sm:mt-3">
                  <GraduationCap className="h-3.5 w-3.5" />
                  Program Studi {team.prodi}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer lengket — tombol Mulai selalu terlihat tanpa perlu scroll */}
        <div className="sticky bottom-0 border-t border-gray-100 bg-white/95 px-4 py-3 sm:px-6 sm:py-4 backdrop-blur">
          <button
            ref={startButtonRef}
            type="button"
            onClick={handleClose}
            className="btn-primary flex w-full items-center justify-center gap-2 text-base sm:text-lg"
          >
            Mulai
            <ArrowRight className="h-5 w-5" />
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}

export default TeamModal

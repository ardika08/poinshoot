/**
 * Sound effect game — dibangkitkan lewat Web Audio API.
 *
 * Tanpa file audio sama sekali: nada disintesis saat dibutuhkan, jadi
 * tidak menambah ukuran bundle dan tidak ada request jaringan.
 *
 * Browser mobile memblokir audio sampai ada interaksi pengguna, sehingga
 * AudioContext baru dibuat pada bunyi pertama (yang selalu dipicu oleh
 * sentuhan pemain) dan di-resume kalau sempat ter-suspend.
 */

let ctx = null
let muted = false

const MUTE_KEY = 'shoot_sound_muted'

// Baca preferensi mute yang tersimpan
try {
  muted = localStorage.getItem(MUTE_KEY) === '1'
} catch {
  muted = false
}

function getCtx() {
  if (muted) return null
  if (typeof window === 'undefined') return null

  const AudioCtx = window.AudioContext || window.webkitAudioContext
  if (!AudioCtx) return null

  if (!ctx) {
    try {
      ctx = new AudioCtx()
    } catch {
      return null
    }
  }

  // iOS/Android kerap men-suspend context sampai ada gesture
  if (ctx.state === 'suspended') ctx.resume().catch(() => {})

  return ctx
}

/**
 * Bunyikan satu nada.
 *
 * @param {number} freq       frekuensi awal (Hz)
 * @param {number} duration   durasi (detik)
 * @param {object} opts       { type, gain, delay, sweepTo }
 */
function tone(freq, duration, opts = {}) {
  const audio = getCtx()
  if (!audio) return

  const {
    type = 'sine',
    gain = 0.18,
    delay = 0,
    sweepTo = null,
  } = opts

  const t0 = audio.currentTime + delay

  const osc = audio.createOscillator()
  const amp = audio.createGain()

  osc.type = type
  osc.frequency.setValueAtTime(freq, t0)
  if (sweepTo) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(sweepTo, 1), t0 + duration)
  }

  // Envelope: attack cepat, release halus supaya tidak "klik"
  amp.gain.setValueAtTime(0.0001, t0)
  amp.gain.exponentialRampToValueAtTime(gain, t0 + 0.012)
  amp.gain.exponentialRampToValueAtTime(0.0001, t0 + duration)

  osc.connect(amp)
  amp.connect(audio.destination)

  osc.start(t0)
  osc.stop(t0 + duration + 0.02)
}

/** Derau pendek — untuk efek "wusss" dan bola memantul */
function noise(duration, opts = {}) {
  const audio = getCtx()
  if (!audio) return

  const { gain = 0.08, delay = 0, filterFreq = 1200 } = opts

  const frames = Math.floor(audio.sampleRate * duration)
  const buffer = audio.createBuffer(1, frames, audio.sampleRate)
  const data = buffer.getChannelData(0)

  for (let i = 0; i < frames; i++) {
    // fade out linear supaya tidak menggantung
    data[i] = (Math.random() * 2 - 1) * (1 - i / frames)
  }

  const src = audio.createBufferSource()
  src.buffer = buffer

  const filter = audio.createBiquadFilter()
  filter.type = 'lowpass'
  filter.frequency.value = filterFreq

  const amp = audio.createGain()
  amp.gain.value = gain

  src.connect(filter)
  filter.connect(amp)
  amp.connect(audio.destination)

  src.start(audio.currentTime + delay)
}

export const sound = {
  /** Bola dilepas dari ketapel — desingan pendek */
  throw() {
    noise(0.16, { gain: 0.05, filterFreq: 900 })
    tone(320, 0.14, { type: 'sine', gain: 0.07, sweepTo: 180 })
  },

  /** Bola masuk lubang berpoin — nada naik ceria (C-E-G) */
  score() {
    tone(523.25, 0.1, { type: 'triangle', gain: 0.16 })                 // C5
    tone(659.25, 0.1, { type: 'triangle', gain: 0.16, delay: 0.08 })    // E5
    tone(783.99, 0.22, { type: 'triangle', gain: 0.18, delay: 0.16 })   // G5
  },

  /** Jackpot 100 — arpeggio lebih panjang + nada tinggi penutup */
  jackpot() {
    const notes = [523.25, 659.25, 783.99, 1046.5, 1318.5] // C5 E5 G5 C6 E6
    notes.forEach((f, i) => {
      tone(f, 0.16, { type: 'triangle', gain: 0.17, delay: i * 0.075 })
    })
    tone(1567.98, 0.4, { type: 'sine', gain: 0.14, delay: 0.42 })       // G6
  },

  /** Meleset — bunyi tumbukan tumpul */
  miss() {
    noise(0.12, { gain: 0.07, filterFreq: 420 })
    tone(150, 0.16, { type: 'sine', gain: 0.1, sweepTo: 80 })
  },

  /** Tepuk tangan singkat saat total skor ditampilkan */
  applause() {
    // Tepuk tangan sintetis: beberapa burst noise pendek dengan pitch ringan.
    for (let i = 0; i < 12; i++) {
      noise(0.07, {
        gain: 0.045 + (i % 3) * 0.012,
        delay: i * 0.12 + Math.random() * 0.045,
        filterFreq: 1500 + Math.random() * 1000,
      })
    }
    tone(783.99, 0.16, { type: 'triangle', gain: 0.08, delay: 0.06 })
    tone(1046.5, 0.22, { type: 'triangle', gain: 0.1, delay: 0.3 })
  },

  /** Ronde selesai — fanfare singkat + applause diputar saat modal hasil muncul */
  finish() {
    const notes = [523.25, 659.25, 783.99, 1046.5]
    notes.forEach((f, i) => {
      tone(f, 0.2, { type: 'triangle', gain: 0.15, delay: i * 0.12 })
    })
  },

  // ---------- kontrol mute ----------

  isMuted: () => muted,

  toggleMute() {
    muted = !muted
    try {
      localStorage.setItem(MUTE_KEY, muted ? '1' : '0')
    } catch {
      // storage tidak tersedia — cukup simpan di memori
    }
    return muted
  },
}

export default sound

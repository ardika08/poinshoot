import { useEffect, useState } from 'react'
import api, { DEFAULT_BOARD } from '../lib/api'

/**
 * Layout papan dari GET /simulation/config.
 *
 * Di-cache di module scope: dipanggil sekali per page load, dipakai bersama
 * oleh PlayPage (canvas game) dan AdminDashboardPage (papan input skor)
 * supaya koordinat lubang tidak didefinisikan dua kali.
 *
 * Kalau API tidak terjangkau, fallback ke DEFAULT_BOARD agar game tetap bisa
 * dimainkan — submit skor tetap divalidasi server saat koneksi pulih.
 */
let cachedBoard = null
let inFlight = null

function fetchBoard() {
  if (cachedBoard) return Promise.resolve(cachedBoard)
  if (inFlight) return inFlight

  inFlight = api.getSimulationConfig()
    .then(data => {
      // Tolak respons yang tidak masuk akal, jangan sampai canvas kosong
      if (!data?.holes?.length) throw new Error('Layout papan kosong')
      cachedBoard = data
      inFlight = null
      return data
    })
    .catch(err => {
      inFlight = null
      throw err
    })

  return inFlight
}

export function useBoardConfig() {
  const [board, setBoard] = useState(cachedBoard)
  const [isLoading, setIsLoading] = useState(!cachedBoard)
  const [error, setError] = useState('')

  useEffect(() => {
    if (cachedBoard) return

    let active = true

    fetchBoard()
      .then(data => {
        if (!active) return
        setBoard(data)
        setIsLoading(false)
      })
      .catch(err => {
        if (!active) return
        console.warn('Gagal memuat layout papan, pakai fallback:', err.message)
        setBoard(DEFAULT_BOARD)
        setError(err.message || 'Gagal memuat konfigurasi papan')
        setIsLoading(false)
      })

    return () => { active = false }
  }, [])

  return { board: board || DEFAULT_BOARD, isLoading, error }
}

export default useBoardConfig

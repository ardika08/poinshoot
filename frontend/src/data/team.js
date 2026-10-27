// ============================================================
// Data tim untuk modal sambutan.
//
// GANTI placeholder di bawah dengan nama & NIM asli.
// NIM ditulis sebagai STRING (pakai tanda kutip) supaya angka 0
// di depan tidak hilang saat di-render.
// ============================================================

const team = {
  // Judul lengkap sesuai yang diminta — dipakai untuk aria-label & dokumen
  fullTitle: 'TIM Project Kepemimpinan PPG Gel. 1 Universitas Negeri Jakarta Tahun 2026',

  // Judul yang tampil di layar (dipecah supaya tidak jadi satu baris panjang)
  headline: 'TIM Project Kepemimpinan',
  subline: 'PPG Gel. 1 · Universitas Negeri Jakarta · 2026',

  prodi: 'PJOK',

  photo: {
    webp: '/team/foto-tim.webp',
    jpg: '/team/foto-tim.jpg',
    alt: 'Foto bersama Tim Project Kepemimpinan PPG Gel. 1 Universitas Negeri Jakarta memegang papan Target Lempar Bola',
  },

  // TODO: ganti nama + NIM. Ada 10 orang di foto, jadi 10 baris.
  members: [
    { name: 'Anggota 1', nim: '-' },
    { name: 'Anggota 2', nim: '-' },
    { name: 'Anggota 3', nim: '-' },
    { name: 'Anggota 4', nim: '-' },
    { name: 'Anggota 5', nim: '-' },
    { name: 'Anggota 6', nim: '-' },
    { name: 'Anggota 7', nim: '-' },
    { name: 'Anggota 8', nim: '-' },
    { name: 'Anggota 9', nim: '-' },
    { name: 'Anggota 10', nim: '-' },
  ],
}

export default team

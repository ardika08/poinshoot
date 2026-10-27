// ============================================================
// Data tim untuk modal sambutan.
//
// Sumber: tabel daftar anggota tim (No. / Nama / NPM).
// NPM ditulis sebagai STRING (pakai tanda kutip) supaya tidak
// kehilangan digit kalau nanti ada angka 0 di depan.
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

  // Urutan sesuai tabel. Ejaan nama dibiarkan apa adanya sesuai dokumen
  // (Nughraha, Kakombohi, Valentyno, Octavian, Tiffani).
  members: [
    { name: 'Alif Putrawan', npm: '201272510035' },
    { name: 'Ardika Yudha Gunantara', npm: '201272510100' },
    { name: 'Daffa Setyo Nughraha', npm: '201272510076' },
    { name: 'Herni Kakombohi', npm: '201272510070' },
    { name: 'Muhammad Ghazi Al Ghifari', npm: '201272510097' },
    { name: 'Muhammad Rozali', npm: '201272510050' },
    { name: 'Radela Ryan Tiffani', npm: '201272510028' },
    { name: 'Raihan Bima Octavian', npm: '201272510020' },
    { name: 'Qois Valentyno', npm: '201272510001' },
    { name: 'Yuda', npm: '201272510074' },
  ],
}

export default team

# API Reference — Shoot Points

Base URL (dev): `http://43.134.66.81:8082/api/v1`

> Port 8000 **tidak dipakai** — sudah di-DNAT ke container Coolify. Laravel dev server jalan di **8082**.

Semua response berbentuk:
```json
{ "success": true, "data": { ... }, "message": "..." }
{ "success": false, "error": { "code": "...", "message": "...", "errors": {...} } }
```

Auth admin: header `x-admin-token: <token>` (atau `Authorization: Bearer <token>`). Token berlaku 120 menit.

---

## Public

### `POST /players` — Registrasi pemain
Body: `{ "name": "Andi Pratama", "whatsapp": "081234567890" }`
- `name`: 3–100 char
- `whatsapp`: format `08xxxxxxxxxx` (10–13 digit). Prefix `+62`/`62` otomatis dinormalisasi ke `0`.

`201` sukses · `422` validasi · `409` `DUPLICATE_WHATSAPP`

### `GET /players/lookup?whatsapp=08xxx` — Cek nomor terdaftar
`200` → `{ "exists": true, "player": {...} }`

### `GET /players/{id}` — Detail pemain + 20 ronde terakhir
`200` · `404` `PLAYER_NOT_FOUND`

### `PUT /players/{id}` — Edit data pemain
Body (partial): `{ "name": "...", "whatsapp": "..." }`

### `GET /leaderboard/{scope}` — Papan skor
`scope` = `all_time` | `weekly` (rolling 7 hari) | `monthly` (rolling 30 hari)

Top 10, diurutkan skor tertinggi. Tie-breaker: **first to achieve**. Skor yang dipakai = ronde terbaik tiap pemain.

### `GET /stats` — Statistik agregat publik
`total_players`, `active_today`, `total_rounds`, `avg_score`. Tanpa data personal.

### `GET /simulation/config` — Layout papan, area canvas, physics

Response:
```json
{
  "max_attempts": 5,
  "max_round_score": 500,
  "canvas": { "width": 320, "height": 500, "board": {...}, "ball_start": {...} },
  "physics": { "aim_mode": "slingshot", "min_pull": 12, "max_pull": 85, "power_multiplier": 4.2, "aim_drift": 6, "power_levels": [...] },
  "holes": [ { "id": "h01", "x": 201.4, "y": 155, "radius": 15, "points": 100, "color": "#2563eb", "is_jackpot": true }, ... ]
}
```

**Papan: 20 lubang tersebar acak** (bukan grid). Semua lubang bernilai positif; koordinat dibekukan di `config/board.php` — tidak di-random saat runtime, supaya tata letak di layar admin identik dengan papan fisik.

| id | poin | keterangan |
|---|---|---|
| h01 | **100** | jackpot — radius **15**, lebih kecil dari lubang lain (paling sulit) |
| h03 | **15** | Nilai bonus kecil |
| h09, h18 | 50 | |
| h07, h12, h17 | 40 | |
| h13, h15, h16, h19 | 30 | |
| h02, h04, h06, h10, h14 | 20 | |
| h05, h08, h11, h20 | 10 | |

Distribusi: 100×1 · 50×2 · 40×3 · 30×4 · 20×5 · 15×1 · 10×4 = **20 lubang**
Skor maksimal per ronde: **500** (5 × jackpot)

Radius lubang biasa 18, **jackpot 15** (sengaja lebih kecil supaya sepadan dengan poinnya). Warna ring dekoratif — tidak memetakan nilai, kecuali jackpot (biru).

**Mekanisme lempar: slingshot.** Pemain menarik bola ke arah **berlawanan** dari lubang yang dituju (seperti ketapel), lalu melepas.

| Parameter | Nilai | Arti |
|---|---|---|
| `min_pull` | 12 | tarikan lebih pendek dianggap batal |
| `max_pull` | 85 | tarikan lebih panjang tidak menambah power |
| `power_multiplier` | 4.2 | jarak tempuh = panjang tarikan × nilai ini |
| `aim_drift` | 6 | sebaran acak ±6px supaya tetap butuh keahlian |

Jangkauan maksimum 85 × 4.2 = **357px**, sedangkan lubang terjauh berjarak 348px — seluruh papan terjangkau.

`power_levels` menentukan warna power bar berdasarkan rasio tarikan: **Lemah** hijau (≤35%), **Sedang** oranye (≤70%), **Kuat** merah (≤100%).

### `POST /simulation/rounds` — Submit hasil ronde simulasi (5 attempt sekaligus)
```json
{
  "player_id": 1,
  "attempts": [
    { "attempt_number": 1, "is_successful": true,  "points": 100, "zone_name": "h01" },
    { "attempt_number": 2, "is_successful": true,  "points": 15,  "zone_name": "h03" },
    { "attempt_number": 3, "is_successful": false, "points": 0 }
  ]
}
```
Harus tepat **5 attempt**.

⚠️ **Field `points` dari klien diabaikan.** Server menghitung ulang poin dari `config/board.php` berdasarkan `zone_name`, jadi skor tidak bisa dimanipulasi lewat DevTools. Kirim `points: 9999` untuk `h20` → tersimpan **10**.

Response menyertakan `estimated_rank` dan `is_podium`.

---

## Admin

### `POST /admin/login`
Body: `{ "username": "admin", "password": "admin123" }` → `{ token, expires_at, admin }`

### `POST /admin/logout` · `GET /admin/me`
Cabut token / verifikasi token masih valid.

### `GET /admin/stats`
`total_players`, `active_today`, `total_rounds`, `avg_score`, `total_games`, `top_performers[3]`

### `GET /admin/players?search=&per_page=20`
Cari by nama/WA. Tiap pemain menyertakan `rounds_count` + `best_score`.

### `GET /admin/logs?per_page=30` — Audit trail

### `POST /admin/games` — Input skor manual (Mode 1)
```json
{
  "player_id": 1,
  "attempt_number": 1,
  "is_successful": true,
  "points": 30,
  "zone_name": "h13",
  "game_mode": "manual"
}
```
Perilaku:
- Ronde aktif (belum 5 attempt) dipakai ulang; kalau tidak ada, dibuat baru.
- Kirim ulang `attempt_number` yang sama → **update** attempt itu (koreksi salah input).
- `total_score` & `attempts_count` selalu dihitung ulang dari tabel `games`.
- Attempt ke-5 → ronde otomatis ditutup (`end_time` diisi, `is_complete: true`).

**Validasi papan:**
- `zone_name` wajib salah satu dari 20 id lubang (`h01`–`h20`), selain itu → `422`.
- `points` wajib **sama persis** dengan nilai lubang di config. Kirim `points: 999` untuk `h20` (10 pts) → `422`.
- `is_successful: true` tanpa `zone_name` → `422`.

Jika bola tidak masuk lubang mana pun, kirim `is_successful: false`; server menyimpan `zone_name = null` dan poin 0.

### `GET /admin/games/recent?limit=15` — Ronde selesai terbaru
### `GET /admin/games/player/{playerId}` — 50 attempt terakhir pemain
### `DELETE /admin/rounds/{id}` — Hapus ronde + semua attempt-nya

---

## Error codes

| Code | HTTP | Arti |
|---|---|---|
| `VALIDATION_ERROR` | 422 | Input tidak valid |
| `DUPLICATE_WHATSAPP` | 409 | Nomor WA sudah dipakai |
| `PLAYER_NOT_FOUND` | 404 | Pemain tidak ada |
| `ROUND_NOT_FOUND` | 404 | Ronde tidak ada |
| `INVALID_CREDENTIALS` | 401 | Login salah |
| `MISSING_AUTH_TOKEN` | 401 | Header token tidak dikirim |
| `INVALID_TOKEN` | 401 | Token salah/kedaluwarsa |
| `ACCOUNT_DISABLED` | 403 | Akun admin nonaktif |

---

## Dev

```bash
cd backend
php artisan migrate:fresh --seed   # reset + 20 pemain dummy
php artisan serve --host=0.0.0.0 --port=8082
./smoke-test.sh                    # 50 test end-to-end + validasi papan
```

Uji terhadap server lain:
```bash
API_BASE=http://43.134.66.81:8082/api/v1 ./smoke-test.sh
```

Admin default: `admin` / `admin123`

### Mengubah layout papan

Semua ada di `backend/config/board.php` — koordinat, poin, radius, warna, jumlah lemparan, parameter physics. Frontend membaca lewat `/simulation/config`, jadi cukup edit satu file lalu:

```bash
php artisan config:clear
```

Ganti jumlah lemparan (`max_attempts`) otomatis ikut ke: validasi backend, progress bar admin, canvas game, dan teks Peraturan di landing page.

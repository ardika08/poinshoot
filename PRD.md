# Product Requirements Document (PRD) - Web Apps Poin Shoot

## 1. Overview

**Project Name:** Web Apps Poin Shoot  
**Description:** Aplikasi web untuk permainan lempar bola ke dalam lubang (modifikasi Dart) dengan sistem scoring dan leaderboard  
**Version:** 2.0 (Final after Clarification)  
**Date:** August 20, 2026  
**Author:** Ardika Yudha  

---

## 2. Tujuan Produk

Membuat aplikasi web yang memungkinkan:
- Input score permainan secara manual oleh admin atau otomatis melalui simulasi game di mobile
- Menampilkan leaderboard 3 skor tertinggi dari setiap pemain dengan filter per waktu (weekly/monthly/all-time)
- Sistem registrasi user tanpa login (hanya nama & nomor WhatsApp), dengan kemampuan edit data
- Tracking points dan kompetisi antar player
- Target audience: Siswa SD (educational purpose) - **FREE untuk semua fitur**

---

## 3. Fitur Utama

### 3.1 Registrasi User (Tanpa Login)
- Form input: Nama lengkap, Nomor WhatsApp
- Data disimpan ke database sebagai "player"
- Session-based (tanpa authentication system)
- **Auto-reject duplicate registration** (same WA number =不允许注册)
- **Editable**: User bisa update nama/WA setelah registrasi
- **No OTP verification** (simplified for educational use)

### 3.2 Game Modes

#### Mode 1: Manual Input (Admin)
1. User mengisi form registrasi (nama + no WA)
2. User bermain secara fisik dengan alat modifikasi (lempar bola ke lubang)
3. Admin menginput score yang berhasil masuk ke lubang:
   - Admin bisa atur **poin per lubang berbeda** (customizable)
   - Contoh: Lubang kecil = 10pts, Sedang = 20pts, Besar = 30pts, Center Bonus = 50pts
4. Setiap 5x percobaan → muncul total score
5. Score tersimpan ke database dengan **audit trail** (admin who input + timestamp)

#### Mode 2: Simulasi Game (Mobile-Friendly)
1. User mengisi form registrasi (nama + no WA)
2. User memainkan game simulasi di browser mobile/desktop
3. **Advanced Physics** dengan gravitasi + bounce effect
4. Ketika bola masuk ke zona target dengan poin tertentu → score otomatis ter-input
5. Setiap 5x percobaan → muncul total score
6. Score langsung tersimpan ke database
7. **Game ended otomatis** setelah 5x attempts
8. Langsung tampilkan hasil + tombol **"Play Again"** untuk start round baru

**Game Mechanics Simulation:**
- Target visual: Papan dengan **20 lubang tersebar acak**, tiap lubang punya poin sendiri (10–100)
- Kontrol: **slingshot/ketapel** — tarik bola ke arah **berlawanan** dari lubang yang dituju, lalu lepas
- **Power bar 3 tingkat** menunjukkan kekuatan tarikan: hijau `Lemah` (≤35%) · oranye `Sedang` (≤70%) · merah `Kuat` (≤100%)
- Bidikan ditampilkan tali ketapel berwarna + **panah arah pendek** (tanpa crosshair/garis sampai lubang — jarak ditebak sendiri lewat power bar, supaya lebih menantang)
- Sebaran acak ±6px (`aim_drift`) supaya tetap butuh keahlian, bukan tap presisi
- **Sound effect** dibangkitkan Web Audio API (tanpa file audio): lempar, masuk, jackpot, meleset, ronde selesai, dan applause — bisa di-mute
- Lubang jackpot 100 dibuat **lebih kecil** (r=15) dari lubang lain (r=18) supaya sepadan dengan poinnya
- Collision detection: lubang terdekat yang memuat titik jatuh bola
- Touch-friendly + mouse click compatible
- Portrait mode optimized untuk mobile

### 3.3 Leaderboard

#### Scope Leaderboard:
- **All-time leaderboard** (total highest score ever)
- **Weekly leaderboard** (highest score this week)
- **Monthly leaderboard** (highest score this month)

#### Display Rules:
- Top 3 players (Juara 1, 2, 3) dengan podium visual
- **WhatsApp number disembunyikan** (privacy protection untuk siswa SD)
- Tie-breaker: **First to achieve** (player yang mencapai score lebih dulu rankingnya lebih tinggi)
- Player history: User bisa lihat history game mereka sendiri (total played, avg score, rank progression)

### 3.4 Dashboard Admin

#### Security:
- **Basic Auth** (username + password) - simple tapi secure
- Audit trail: Semua input score manual dicatat (admin name + timestamp)

#### Features:
- Form input score manual dengan **custom point per lubang**
- List all registered players
- View recent games with full details
- Statistics cards (total plays, avg score, top performers)
- Archive old data (auto-archive setelah 1 bulan)
- Export data to Excel/CSV
- Manage game settings (point configuration, time period filters)

---

## 4. Technical Requirements

### 4.1 Tech Stack
| Component | Technology |
|-----------|------------|
| Backend | Laravel 12 |
| Frontend | React 19 + Vite |
| Database | MySQL |
| Authentication | Session-based (no login) + Basic Auth untuk Admin |
| Deployment | Coolify di VPS |
| Domain | api.shoot.my.id (backend), shoot.my.id (frontend) |
| License | FREE (Educational Project for SD Students) |

### 4.2 Database Schema

#### Table: players
```sql
id              BIGINT PRIMARY KEY AUTO_INCREMENT
name            VARCHAR(100) NOT NULL
whatsapp        VARCHAR(20) NOT NULL UNIQUE
is_active       BOOLEAN DEFAULT TRUE
created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP

INDEX idx_whatsapp (whatsapp),
INDEX idx_name (name)
```

#### Table: games
```sql
id              BIGINT PRIMARY KEY AUTO_INCREMENT
player_id       BIGINT NOT NULL (FK -> players.id)
admin_id        BIGINT NULLABLE (nullable if simulation mode, FK -> admins jika ada table terpisah)
attempt_number  INT NOT NULL CHECK (attempt_number BETWEEN 1 AND 5)
score           INT NOT NULL DEFAULT 0
is_successful   BOOLEAN DEFAULT FALSE (TRUE jika bola masuk lubang)
points          INT NOT NULL (poin dari lubang tersebut, customizable by admin)
zone_name       VARCHAR(50) NULLABLE (id lubang: "h01".."h20", NULL jika meleset)
game_mode       ENUM('manual', 'simulation') NOT NULL
device_info     TEXT NULLABLE (User agent untuk tracking device)
created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP

FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE
INDEX idx_player_id (player_id),
INDEX idx_created_at (created_at)
```

#### Table: rounds
```sql
id              BIGINT PRIMARY KEY AUTO_INCREMENT
player_id       BIGINT NOT NULL (FK -> players.id)
total_score     INT NOT NULL
attempts_count  INT DEFAULT 5
game_mode       ENUM('manual', 'simulation') NOT NULL
start_time      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
end_time        TIMESTAMP NOT NULL
period_type     ENUM('all_time', 'weekly', 'monthly') NOT NULL (auto-determined by date)
is_archived     BOOLEAN DEFAULT FALSE (auto-archive after 1 month)
archived_at     TIMESTAMP NULLABLE
created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP

FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE
INDEX idx_player_period (player_id, period_type),
INDEX idx_total_score_desc (total_score DESC)
```

#### Table: admin_logs (Audit Trail)
```sql
id              BIGINT PRIMARY KEY AUTO_INCREMENT
admin_username  VARCHAR(50) NOT NULL
action          VARCHAR(100) NOT NULL (e.g., "submit_manual_score", "update_player", "delete_game")
target_id       BIGINT NULLABLE (player_id atau game_id yang diubah)
details         JSON NULLABLE (additional context seperti old/new values)
ip_address      VARCHAR(45) NULLABLE
user_agent      TEXT NULLABLE
created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP

INDEX idx_admin_action (admin_username, action)
```

### 4.3 API Endpoints

#### Registration & Player
- `POST /api/players` - Register new player (validates unique WA)
  - Request: `{name: string, whatsapp: string}`
  - Response: `{player_id, message: "Registered successfully"}`
  - Error: `409 Conflict` jika WA sudah terdaftar
  
- `PUT /api/players/{id}` - Update player info (name/whatsapp)
  - Request: `{name?: string, whatsapp?: string}`
  - Validation: WA harus unique
  
- `GET /api/players/{id}` - Get player detail (private view)
  - Includes: player info + game history + statistics
  
- `GET /api/admin/players` - List all players (admin only)
  - Query params: `?search=&page=`
  - Includes: stats, last activity, etc.

#### Games
- `POST /api/games` - Submit game attempt
  - Request: `{player_id, attempt_number, points, is_successful, zone_name?, game_mode}`
  - Server validates: attempt_number <= 5, points >= 0
  
- `GET /api/games/player/{player_id}` - Get game history for player
  - Query params: `?from=&to=&limit=`
  
- `POST /api/admin/games` - Admin submit score manually
  - Requires Basic Auth
  - Audit trail logged to `admin_logs` table

#### Rounds
- `GET /api/rounds/latest/{player_id}` - Get latest round score for player
- `POST /api/rounds/complete/{player_id}` - Complete round (after 5 attempts)
  - Automatically calculates total_score
  - Determines period_type (weekly/monthly/all-time) based on date

#### Leaderboard
- `GET /api/leaderboard/:scope` - Get top players by scope
  - Scope: `all-time`, `weekly`, `monthly`
  - Response: `[rank, player_name, total_score, achieved_date]`
  - Privacy: No WA number exposed

#### Statistics & Analytics
- `GET /api/stats/overview` - Overall platform statistics (public view)
  - Total players, total rounds, avg score, etc.
  
- `GET /api/admin/stats` - Detailed admin statistics (auth required)
  - Per-period breakdown, top performers, engagement metrics

#### Admin Specific
- `GET /api/admin/logs` - Get audit logs
- `POST /api/admin/archive` - Trigger manual archive (for old rounds)
- `GET /api/admin/export` - Export data to CSV/Excel

---

## 5. UI/UX Design

### 5.1 Design Principles
- **Kid-friendly**: Bright colors, simple UI, large buttons
- **Mobile-first**: Optimized untuk portrait mode di HP
- **Educational**: Clear instructions, positive feedback messages
- **Privacy-focused**: No personal info exposed publicly

### 5.2 Pages Required

#### Public Pages

##### 1. Home Page (`/`)
- Hero section dengan penjelasan game (untuk siswa SD)
- Form registrasi cepat (nama + no WA)
- CTA "Mainkan Sekarang" → navigate ke `/play`
- Visual: Ilustrasi anak-anak main game lempar bola

##### 2. Leaderboard Page (`/leaderboard`)
- Tab navigation: "All Time", "Weekly", "Monthly"
- Podium visual untuk Top 3 (Juara 1 emas, Juara 2 perak, Juara 3 perunggu)
- Table daftar pemain dengan ranking (nama saja, no WA disembunyikan)
- Filter: Bisa pilih periode waktu

##### 3. Game Simulation Page (`/play`)
- Responsive canvas/SVG game area
- **Portrait mode optimized**: 
  - Board vertikal di atas
  - Controls horizontal di bawah
  - Score counter jelas terlihat
- Interactive elements:
  - Drag-to-shoot mechanics (touch/mouse)
  - Trajectory line preview
  - Physics animation (graviation + bounce)
  - Collision detection dengan zona target
- HUD (Heads Up Display):
  - Attempt counter: "Attempt X/5"
  - Current score
  - Zone points indicator (20 lubang: 10/15/20/30/40/50, jackpot 100)
- Post-game screen:
  - Total score display
  - Rank achieved (jika masuk top 3)
  - Button "Play Again" → reset round
  - Button "Leaderboard" → navigate ke leaderboard

#### Admin Pages (Protected with Basic Auth)

##### 1. Admin Login (`/admin/login`)
- Simple form: username + password
- Basic HTTP Auth atau session-based auth
- Redirect ke dashboard upon success

##### 2. Dashboard Admin (`/admin/dashboard`)
- Statistics overview cards:
  - Total Players Today
  - Total Games This Week
  - Avg Score
  - Active Players
  
- Quick Action Panel:
  - Form input score manual (select player, enter zone, enter points)
  - Search player by name/WA
  
- Recent Activities Feed:
  - Latest 10 game submissions (with admin who input)
  - Latest registrations
  
- Data Management:
  - Player management table (edit/delete/archive)
  - Export button (CSV/Excel)
  - Archive toggle (auto/manual)

---

## 6. Game Simulation Mechanics (Advanced)

### 6.1 Game Area Setup
- Canvas responsive (max-width: 600px untuk mobile portrait)
- Target zones visual:
  ```
  ┌─────────────┐
  │   [BONUS]   │ ← Center, 50 points (small circle)
  │  ┌───────┐  │
  │  │ LARGE │  │ ← Middle ring, 30 points
  │  └───────┘  │
  │  MEDIUM     │ ← Outer ring, 20 points
  │  SMALL      │ ← Edge, 10 points
  └─────────────┘
  ```

### 6.2 Interaction Flow
1. **Touch/Click Hold**: User touch/drag di canvas
2. **Drag Direction**: Finger/mouse movement menentukan arah
3. **Trajectory Preview**: Garis putus-putus menunjukkan prediksi jalur bola
4. **Release**: User lift finger/click untuk shoot bola
5. **Physics Animation**:
   - Bola terbang dengan trajectory
   - Gravity effect (bola melengkung ke bawah)
   - Bounce effect jika kena tepi board
   - Collision detection dengan zona
6. **Result Display**:
   - ✅ Hit: Zone highlighted + points shown + audio feedback (optional)
   - ❌ Miss: Message "Oops! Try again"
7. **Counter Update**: "Attempt X/5" berkurang
8. **Round Complete**: Setelah 5x, popup hasil akhir

### 6.3 Physics Implementation (Web Canvas)
```javascript
// Core physics parameters
const gravity = 0.5;
const friction = 0.98;
const bounceFactor = 0.7;
const airResistance = 0.99;

// Ball properties
let ball = {
  x: centerX,
  y: bottomY,
  vx: initialVelocityX * cos(angle),
  vy: initialVelocityY * sin(angle),
  radius: 15,
  mass: 1
};

// Update loop
function updateBall() {
  ball.vx *= airResistance;
  ball.vy *= airResistance;
  ball.vy += gravity;
  
  ball.x += ball.vx;
  ball.y += ball.vy;
  
  // Wall collision (bounce)
  if (ball.x - ball.radius < 0 || ball.x + ball.radius > canvasWidth) {
    ball.vx *= -bounceFactor;
  }
  if (ball.y - ball.radius < 0) {
    ball.vy *= -bounceFactor;
  }
  
  // Zone collision detection (circle-circle)
  zones.forEach(zone => {
    const dx = ball.x - zone.x;
    const dy = ball.y - zone.y;
    const distance = Math.sqrt(dx*dx + dy*dy);
    
    if (distance < ball.radius + zone.radius) {
      scorePoints(zone.points);
      ball.vx = ball.vy = 0; // Stop ball
    }
  });
}
```

### 6.4 Mobile Optimization
- **Touch Events**: `touchstart`, `touchmove`, `touchend` support
- **Prevent Default**: `e.preventDefault()` untuk hindari scrolling saat drag
- **Viewport**: Meta tag `<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">`
- **Orientation**: Force portrait mode detection dengan CSS media queries

---

## 7. Deployment Architecture

### 7.1 Infrastructure (Coolify VPS)
```
┌─────────────────────────────┐
│        Nginx Proxy          │ ← Port 80/443, SSL auto
└──────────┬──────────────────┘
           │
    ┌──────┴──────┐
    │             │
┌───▼──────┐  ┌──▼──────────┐
│React App │  │Laravel API  │
│(Static)  │  │(Sail/Docker)│
│Port: 8080│  │Port: 8000   │
└──────────┘  └─────────────┘
               │      │
               │  ┌───▼────┐
               └──│ MySQL  │
                  │ Service│
                  └────────┘
```

### 7.2 Domain Setup
- **Frontend**: `shoot.my.id` → React static files (serve via Nginx)
- **Backend API**: `api.shoot.my.id` → Laravel routes (proxy ke container)
- **SSL**: Auto Let's Encrypt certificate via Coolify
- **Health Check**: `/api/health` endpoint untuk monitoring

### 7.3 Environment Variables

```env
# .env (Laravel Backend)
APP_NAME="Shoot Points"
APP_URL=https://api.shoot.my.id
FRONTEND_URL=https://shoot.my.id

DB_CONNECTION=mysql
DB_HOST=db
DB_PORT=3306
DB_DATABASE=shoot
DB_USERNAME=shoot_user
DB_PASSWORD=(generated by Coolify)

# Admin Basic Auth
ADMIN_USERNAME=admin
ADMIN_PASSWORD=(strong password, managed by Coolify secrets)

# Cache & Sessions
CACHE_DRIVER=redis
SESSION_DRIVER=redis
SESSION_LIFETIME=120

# Data Retention
ARCHIVE_AFTER_DAYS=30
MAX_ROUNDS_PER_PLAYER=1000

# Development (local only)
DEBUG=true
LOG_LEVEL=debug
```

### 7.4 Docker Configuration (docker-compose.yml)

```yaml
version: '3.8'

services:
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - frontend_dist:/var/www/html
      - letsencrypt:/etc/letsencrypt
    depends_on:
      - laravel
      - react
      
  react:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    restart: always
    
  laravel:
    build:
      context: ./backend
      dockerfile: Dockerfile
    ports:
      - "8000:8000"
    environment:
      - APP_ENV=production
    depends_on:
      - mysql
      - redis
      
  mysql:
    image: mysql:8.0
    environment:
      MYSQL_DATABASE: shoot
      MYSQL_USER: shoot_user
      MYSQL_PASSWORD: ${DB_PASSWORD}
      MYSQL_ROOT_PASSWORD: ${MYSQL_ROOT_PASSWORD}
    volumes:
      - mysql_data:/var/lib/mysql
      - ./migrations:/docker-entrypoint-initdb.d
      
  redis:
    image: redis:alpine
    volumes:
      - redis_data:/data
      
volumes:
  mysql_data:
  redis_data:
  frontend_dist:
  letsencrypt:
```

---

## 8. Security & Privacy Considerations

### 8.1 Data Validation
- **Name validation**: Min 3 chars, max 100 chars, alphanumeric + spaces
- **WhatsApp validation**: Indonesia format only (08xxxxxxxxxx), min 10 digits
- **Duplicate prevention**: Unique constraint on WhatsApp, return 409 if exists
- **Score validation**: Integer >= 0, max 1000 per attempt

### 8.2 Score Manipulation Prevention
- **Rate limiting**: Max 10 requests/minute per IP/session
- **Server-side validation**: All game logic validated di backend
- **Session binding**: Game submission tied to registration session
- **Device fingerprinting** (optional): Track device hash untuk detect cheating
- **Admin audit trail**: Semua admin action dicatat dengan timestamp + IP

### 8.3 Admin Protection
- **Basic Auth**: HTTP Basic Authentication untuk `/api/admin/*` endpoints
- **IP Whitelist** (optional): Only allow admin from specific IPs
- **Session timeout**: Auto logout setelah 15 menit inactivity
- **Brute force protection**: Rate limit login attempts (max 5 tries/hour)

### 8.4 Privacy Protection (SD Students)
- **No personal info public**: WhatsApp numbers never shown in leaderboard
- **Data minimization**: Only collect name + WA (no email, no address)
- **GDPR compliance**: Right to delete account upon request
- **Parental consent**: Optional checkbox untuk users < 13 years (future)

### 8.5 Data Retention Policy
- **Active data**: All rounds stored indefinitely
- **Auto-archive**: Round older than 30 days marked as `is_archived = TRUE`
- **Archive cleanup**: Archived data soft-deleted setelah 1 year (configurable)
- **Export before delete**: Admin dapat export data sebelum auto-delete

---

## 9. Future Enhancements (Phase 2+)

- [ ] **Achievement System**: Badge/unlocks untuk milestones (10 games, top 3, etc.)
- [ ] **Social Sharing**: Share score ke Instagram/Facebook dengan custom image
- [ ] **Tournaments**: Weekly/monthly competitions with prizes
- [ ] **Multi-language**: ID/EN/Jepang untuk sekolah internasional
- [ ] **Voice Feedback**: Sound effects untuk hit/miss/score (child-friendly)
- [ ] **Accessibility**: ARIA labels, keyboard navigation, screen reader support
- [ ] **Offline Mode**: PWA installation untuk play without internet
- [ ] **Teacher Dashboard**: Class-level analytics untuk guru
- [ ] **Certificate Generation**: PDF certificate untuk tournament winner
- [ ] **Payment Integration** (future monetization): Duitku untuk premium features

**Note:** Semua fitur Phase 2 adalah OPTIONAL. Core functionality (registrasi, game, leaderboard) sudah cukup untuk MVP.

---

## 10. Success Metrics

### Quantitative Metrics
- **Total registered users** (target: 500 dalam 3 bulan pertama)
- **Daily Active Users (DAU)** (target: 50+ harian)
- **Average score per session** (benchmark: 40-60 points)
- **Conversion rate** (registrasi → complete 1 round) (target: > 80%)
- **Retention rate** (users return within 7 days) (target: > 40%)
- **Leaderboard engagement** (% users who check leaderboard) (target: > 60%)

### Qualitative Metrics
- **User satisfaction**: Survey rating (1-5 stars) setelah play
- **Ease of use**: Time to complete first round (target: < 2 menit)
- **Educational value**: Feedback dari siswa/guru tentang learning outcome

---

## 11. Timeline Estimate

| Phase | Task | Duration | Dependencies |
|-------|------|----------|--------------|
| 1 | **Setup Environment** | | |
| 1.1 | Init Git repo (`ardika08/shoot`) | 0.5 hari | - |
| 1.2 | Create Laravel backend structure | 1 hari | 1.1 |
| 1.3 | Create React frontend structure | 1 hari | 1.1 |
| 1.4 | Setup docker-compose.dev.yml | 1 hari | 1.2, 1.3 |
| 2 | **Database & API** | | |
| 2.1 | Create migrations (players, games, rounds, admin_logs) | 1 hari | 1.2 |
| 2.2 | Implement Eloquent models & relationships | 1 hari | 2.1 |
| 2.3 | Build REST API endpoints (players, games, rounds) | 2 hari | 2.2 |
| 2.4 | Build admin endpoints + basic auth | 1 hari | 2.3 |
| 2.5 | Add validation + rate limiting | 1 hari | 2.3, 2.4 |
| 3 | **Frontend - Core Pages** | | |
| 3.1 | Build Home page (registration form) | 1 hari | 2.3 |
| 3.2 | Build Leaderboard page (3 tabs + podium) | 2 hari | 2.3 |
| 3.3 | Build Admin login + dashboard | 2 hari | 2.4 |
| 3.4 | Integrate API calls (axios/fetch) | 2 hari | 3.1-3.3 |
| 4 | **Game Simulation** | | |
| 4.1 | Setup canvas + basic rendering | 1 hari | 3.4 |
| 4.2 | Implement touch/mouse drag mechanics | 1 hari | 4.1 |
| 4.3 | Add physics engine (gravity + bounce) | 2 hari | 4.2 |
| 4.4 | Implement collision detection + scoring | 2 hari | 4.3 |
| 4.5 | Mobile optimization (portrait mode) | 1 hari | 4.4 |
| 5 | **Integration & Testing** | | |
| 5.1 | End-to-end testing (API + frontend) | 2 hari | 3.4, 4.5 |
| 5.2 | Bug fixing + performance optimization | 2 hari | 5.1 |
| 5.3 | Security audit (SQL injection, XSS, etc.) | 1 hari | 5.2 |
| 6 | **Deployment** | | |
| 6.1 | Setup Coolify services (laravel, react, mysql) | 1 hari | 5.3 |
| 6.2 | Configure domains + SSL certificates | 0.5 hari | 6.1 |
| 6.3 | CI/CD pipeline (auto-deploy on git push) | 1 hari | 6.2 |
| 6.4 | Production testing + smoke tests | 1 hari | 6.3 |
| 7 | **Launch & Maintenance** | | |
| 7.1 | Soft launch (internal testing with team) | 2 hari | 6.4 |
| 7.2 | Public launch + monitoring | Ongoing | 7.1 |
| 7.3 | Bug fixes + feature iteration | Ongoing | 7.2 |
| **TOTAL** | | **~32 hari kerja** | |

**Acceleration Option:** Jika menggunakan component library (TailwindCSS, Chakra UI) dan boilerplate Laravel + React, timeline bisa dipotong jadi ~20 hari.

---

## 12. Next Steps

### Immediate Actions (Post-PRD Approval)
1. ✅ PRD Finalisasi Version 2.0 (dokumen ini)
2. 🔲 Initialize Git repository: `git init` di `/home/ubuntu/projects/shoot`
3. 🔲 Create GitHub repo: `ardika08/shoot` (public/private?)
4. 🔲 Setup development environment:
   ```bash
   composer create-project laravel/laravel backend
   npm create vite@latest frontend -- --template react
   ```
5. 🔲 Create docker-compose.dev.yml untuk local development
6. 🔲 Run database migrations
7. 🔲 Start coding backend API first
8. 🔲 Parallel: Build game simulation prototype
9. 🔲 Test locally dengan Postman/Insomnia
10. 🔲 Deploy staging environment

---

## 13. Appendices

### Appendix A: Referensi Papan Target

> **Revisi v3.0** — model 4 zona konsentris diganti papan **20 lubang tersebar acak**, menyesuaikan alat fisik yang dimodifikasi.

Sumber kebenaran tunggal: `backend/config/board.php`. Koordinat **dibekukan** (bukan random runtime) supaya tata letak di layar admin identik dengan papan fisik.

| id | Poin | Radius | Keterangan |
|---|---|---|---|
| h01 | **100** | 15 | Jackpot — radius lebih kecil, tersulit dikenai |
| h03 | **15** | 18 | Nilai bonus kecil |
| h07, h12, h17 | 40 | 18 | |
| h13, h15, h16, h19 | 30 | 18 | |
| h02, h04, h06, h10, h14 | 20 | 18 | |
| h05, h08, h11, h20 | 10 | 18 | |
| h09, h18 | 50 | 18 | |
| h03 | **15** | 18 | Nilai bonus kecil |

**Distribusi:** 100×1 · 50×2 · 40×3 · 30×4 · 20×5 · 15×1 · 10×4 = **20 lubang**
**Skor maksimal per ronde:** 5 × 100 = **500**

Warna ring bersifat dekoratif (tidak memetakan nilai), kecuali penanda jackpot (biru, radius lebih kecil).

Bola yang tidak masuk lubang mana pun tercatat `is_successful: false` dengan `zone_name: null` dan poin 0.

**Keamanan skor:** poin tidak diambil dari kiriman klien — server menghitung ulang dari config berdasarkan `zone_name`. Mengirim `points: 9999` untuk lubang bernilai 10 akan ditolak (`422`) di mode manual, dan dikoreksi jadi 10 di mode simulasi.

### Appendix B: Sample API Responses

#### Player Registration Success
```json
{
  "success": true,
  "data": {
    "id": 1,
    "name": "Budi Santoso",
    "whatsapp": "081234567890",
    "created_at": "2026-08-20T10:30:00Z"
  },
  "message": "Player registered successfully"
}
```

#### Duplicate Registration Error
```json
{
  "success": false,
  "error": {
    "code": "DUPLICATE_WHATSAPP",
    "message": "WhatsApp number already registered",
    "status": 409
  }
}
```

#### Leaderboard Response (Weekly)
```json
{
  "success": true,
  "data": {
    "scope": "weekly",
    "period": {
      "start": "2026-08-14T00:00:00Z",
      "end": "2026-08-20T23:59:59Z"
    },
    "top_players": [
      {
        "rank": 1,
        "player_id": 15,
        "name": "Andi Pratama",
        "total_score": 450,
        "achieved_at": "2026-08-19T14:22:00Z"
      },
      {
        "rank": 2,
        "player_id": 8,
        "name": "Siti Nurhaliza",
        "total_score": 420,
        "achieved_at": "2026-08-18T16:45:00Z"
      },
      {
        "rank": 3,
        "player_id": 23,
        "name": "Rizky Bintang",
        "total_score": 380,
        "achieved_at": "2026-08-20T09:15:00Z"
      }
    ],
    "pagination": {
      "total": 156,
      "per_page": 3,
      "current_page": 1
    }
  }
}
```

### Appendix C: Tech Decisions Rationale

**Why Laravel 12?**
- Robust ecosystem untuk REST API
- Built-in authentication (basic auth support)
- Excellent documentation + community support
- Easy deployment dengan Sail/Coolify

**Why React 19 + Vite?**
- Fast HMR untuk development
- Modern component architecture
- Great mobile responsiveness tools
- Lightweight bundle size

**Why MySQL?**
- ACID compliance untuk data integrity
- Mature ecosystem + easy backup
- Good performance untuk small-medium scale
- Native integration dengan Laravel

**Why Coolify?**
- Self-hosted alternative Heroku/Vercel
- Auto SSL + domain management
- Docker-based deployment
- Cost-effective (pay only for VPS)

---

**Document Status:** 🟢 **FINAL - Ready for Implementation**  
**Approved By:** Ardika Yudha  
**Last Updated:** August 20, 2026 (Version 2.0)  
**Next Action:** Begin implementation phase

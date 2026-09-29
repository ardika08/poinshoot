# Shoot Points - Frontend

Frontend application untuk **Web Apps Poin Shoot** menggunakan React 18 + Vite.

## 📚 Tech Stack

- **React 18** - UI Library
- **Vite 5** - Build tool & dev server
- **Tailwind CSS** - Utility-first CSS framework
- **Framer Motion** - Animation library
- **React Router DOM v6** - Client-side routing
- **Lucide React** - Icon components
- **Axios** - HTTP client

## 🎯 Fitur yang Sudah Dibuat

### ✅ Completed Pages
1. **Home Page** (`/`)
   - Hero section dengan animasi
   - Form registrasi player (simulasi)
   - Stats dashboard
   - Features showcase
   - How it works section

2. **Leaderboard Page** (`/leaderboard`)
   - 3 tabs: All-Time, Weekly, Monthly
   - Podium visual untuk top 3 champions
   - Full ranking table
   - Privacy protection (no WA shown)

3. **Play Page** (`/play`)
   - Canvas-based game simulation
   - Physics: gravity + bounce effect
   - Touch-friendly untuk mobile
   - Portrait mode optimized
   - Attempt counter (X/5)
   - Zone collision detection
   - Score modal result

4. **Admin Login** (`/admin/login`)
   - Basic authentication flow
   - Demo credentials provided
   - Session management

5. **Admin Dashboard** (`/admin/dashboard`)
   - Quick action panel untuk input manual score
   - Statistics overview
   - Players table dengan search
   - Recent games activity
   - Audit trail notice

### 🔧 Components Structure
```
src/
├── layouts/
│   ├── Navbar.jsx         # Responsive navigation bar
│   └── Footer.jsx         # Site footer with links
├── pages/
│   ├── HomePage.jsx       # Landing page + registration
│   ├── LeaderboardPage.jsx # Rankings display
│   ├── PlayPage.jsx       # Game simulation canvas
│   ├── AdminLoginPage.jsx  # Admin auth
│   └── AdminDashboardPage.jsx # Admin panel
├── utils/
│   └── dummyData.js       # Mock data untuk testing
├── services/              # API calls placeholder
├── hooks/                 # Custom React hooks
├── assets/                # Images, icons
├── App.jsx               # Main app component
├── main.jsx              # Entry point
└── index.css             # Global styles + Tailwind
```

## 🚀 Getting Started

### Prerequisites
- Node.js >= 18.x
- npm >= 9.x

### Installation

```bash
cd /home/ubuntu/projects/shoot/frontend

# Install dependencies
npm install --legacy-peer-deps

# Run development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

### Development Server

Default URL: `http://localhost:3000`

Routes available:
- `/` - Home page
- `/leaderboard` - Leaderboard
- `/play` - Game simulation
- `/admin/login` - Admin login
- `/admin/dashboard` - Admin dashboard

## 🎮 Game Simulation Controls

### Desktop
- **Click & drag**: Click di bawah board, drag ke atas untuk arah lemparan
- **Release**: Release mouse untuk melempar bola

### Mobile
- **Touch & drag**: Touch area bawah, swipe ke atas untuk mengarahkan
- **Release**: Lift finger untuk melempar

## 🔑 Admin Demo Credentials

**Username:** `admin`  
**Password:** `admin123`

⚠️ Gunakan ini hanya untuk development/testing!

## 📊 Dummy Data

Mock data disimpan di `src/utils/dummyData.js`:
- Players (5 users)
- Games (10 attempts)
- Rounds (5 rounds)
- Stats (overview metrics)

## 🎨 Design System

### Colors (Tailwind config)
- Primary: Blue spectrum (primary-50 to primary-900)
- Accent: Yellow, Green, Red

### Typography
- Display font: Poppins (headings, buttons)
- Body font: Inter (text, labels)

### Spacing
Based on Tailwind's spacing scale with custom extensions for gradients and animations

## 📱 Responsive Breakpoints

```css
Mobile-first approach:
- Base: < 640px (small phones)
- sm: ≥ 640px
- md: ≥ 768px
- lg: ≥ 1024px
- xl: ≥ 1280px
```

## 🔄 Next Steps (TODO)

1. Replace dummy data dengan real API integration
2. Implement axios interceptors untuk error handling
3. Add form validation libraries (Yup/Zod)
4. Setup TypeScript migration (optional)
5. Add loading skeletons
6. Implement caching strategy (React Query/SWR)
7. Add error boundaries
8. Performance optimization (lazy loading, code splitting)

## 🐛 Known Issues

- Canvas physics perlu tuning untuk lebih smooth
- Touch events pada iOS butuh testing lebih lanjut
- Loading state belum ada saat navigasi antar halaman

## 📄 License

Educational project for SD students - FREE for all features

---

**Version:** 1.0.0  
**Last Updated:** August 20, 2026

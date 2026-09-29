import { Link } from 'react-router-dom'
import { Target, Trophy, Gamepad2 } from 'lucide-react'

const Footer = () => {
  const currentYear = new Date().getFullYear()

  return (
    <footer className="bg-white border-t border-gray-100 mt-auto">
      <div className="container-mobile py-6 sm:py-8">
        {/* Mobile: Simplified footer */}
        <div className="md:hidden">
          <div className="flex items-center justify-center space-x-2 mb-4">
            <div className="bg-gradient-to-br from-primary-500 to-primary-700 p-1.5 rounded-lg">
              <Target className="w-4 h-4 text-white" />
            </div>
            <span className="font-display font-bold text-base text-gray-900">Shoot Points</span>
          </div>
          <p className="text-gray-500 text-xs text-center leading-relaxed mb-4">
            Aplikasi game lempar bola edukatif untuk siswa SD dengan sistem scoring dan leaderboard interaktif.
          </p>
          <div className="flex justify-center gap-4 mb-4">
            <Link to="/" className="text-xs text-gray-500 hover:text-primary-600">Beranda</Link>
            <Link to="/leaderboard" className="text-xs text-gray-500 hover:text-primary-600">Peringkat</Link>
            <Link to="/play" className="text-xs text-gray-500 hover:text-primary-600">Mainkan</Link>
          </div>
        </div>

        {/* Desktop: Full footer */}
        <div className="hidden md:grid md:grid-cols-3 gap-8">
          {/* Brand Section */}
          <div className="space-y-3">
            <Link to="/" className="flex items-center space-x-3">
              <div className="bg-gradient-to-br from-primary-500 to-primary-700 p-2 rounded-xl">
                <Target className="w-5 h-5 text-white" />
              </div>
              <span className="font-display font-bold text-lg text-gray-900">Shoot Points</span>
            </Link>
            <p className="text-gray-600 text-sm leading-relaxed">
              Aplikasi game lempar bola edukatif untuk siswa SD dengan sistem scoring dan leaderboard interaktif.
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="font-display font-semibold text-gray-900 mb-4 text-sm uppercase tracking-wide">Menu Cepat</h3>
            <div className="space-y-2">
              <Link to="/" className="block text-gray-600 hover:text-primary-600 transition-colors text-sm">Beranda</Link>
              <Link to="/leaderboard" className="block text-gray-600 hover:text-primary-600 transition-colors text-sm">Peringkat</Link>
              <Link to="/play" className="block text-gray-600 hover:text-primary-600 transition-colors text-sm">Mainkan Sekarang</Link>
            </div>
          </div>

          {/* About */}
          <div>
            <h3 className="font-display font-semibold text-gray-900 mb-4 text-sm uppercase tracking-wide">Tentang</h3>
            <p className="text-gray-600 text-sm leading-relaxed mb-3">
              Shoot Points adalah proyek edukasi gratis untuk melatih motorik halus siswa SD.
            </p>
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2 text-sm text-gray-500">
                <Trophy className="w-4 h-4" />
                <span>Edukasi Gratis</span>
              </div>
              <div className="flex items-center space-x-2 text-sm text-gray-500">
                <Gamepad2 className="w-4 h-4" />
                <span>Fun Learning</span>
              </div>
            </div>
          </div>
        </div>

        {/* Copyright */}
        <div className="border-t border-gray-100 mt-6 pt-4 text-center">
          <p className="text-gray-500 text-xs">
            © {currentYear} Shoot Points. Edukasi gratis untuk siswa SD.
          </p>
        </div>
      </div>
    </footer>
  )
}

export default Footer

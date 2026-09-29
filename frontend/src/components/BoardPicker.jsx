import { useBoardConfig } from '../hooks/useBoardConfig'

/**
 * BoardPicker — replika visual papan target untuk memilih lubang.
 *
 * Koordinat lubang identik dengan papan fisik (dibaca dari /simulation/config),
 * sehingga admin tinggal menekan lubang di posisi yang sama dengan tempat bola
 * masuk pada alat asli. Ini yang membuat sebaran acak tetap praktis dipakai.
 *
 * Props:
 *   value    — id lubang terpilih (mis. 'h01')
 *   onChange — dipanggil dengan objek hole saat lubang ditekan
 *   disabled — matikan interaksi
 */
const BoardPicker = ({ value, onChange, disabled = false }) => {
  const { board } = useBoardConfig()
  const { width, height } = board.canvas
  const B = board.canvas.board

  // Papan saja (tanpa area lempar) supaya lubang tampil sebesar mungkin
  const padding = 10
  const vb = {
    x: B.x - padding,
    y: B.y - padding,
    w: B.width + padding * 2,
    h: B.height + padding * 2,
  }

  return (
    <div
      className="relative w-full select-none"
      style={{ paddingBottom: `${(vb.h / vb.w) * 100}%` }}
    >
      <svg
        viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`}
        preserveAspectRatio="xMidYMid meet"
        className="absolute inset-0 w-full h-full"
        role="group"
        aria-label="Pilih lubang tempat bola masuk"
      >
        {/* rangka + kanvas papan */}
        <rect
          x={B.x - 7} y={B.y - 7}
          width={B.width + 14} height={B.height + 14}
          rx="10" fill="#1e3a8a"
        />
        <rect
          x={B.x} y={B.y}
          width={B.width} height={B.height}
          rx="6" fill="#fdfcf5" stroke="#cbd5e1" strokeWidth="1.5"
        />

        {board.holes.map(hole => {
          const isSelected = value === hole.id
          const labelSize = hole.is_jackpot ? 15 : 12

          return (
            <g
              key={hole.id}
              onClick={() => !disabled && onChange?.(hole)}
              style={{ cursor: disabled ? 'not-allowed' : 'pointer' }}
              opacity={disabled ? 0.55 : 1}
            >
              {/* area tap diperbesar supaya nyaman di layar HP */}
              <circle cx={hole.x} cy={hole.y} r={hole.radius + 6} fill="transparent" />

              <circle cx={hole.x} cy={hole.y} r={hole.radius} fill="#1e293b" />
              <circle
                cx={hole.x} cy={hole.y} r={hole.radius}
                fill="none"
                stroke={isSelected ? '#facc15' : hole.color}
                strokeWidth={isSelected ? 5 : hole.is_jackpot ? 4.5 : 3}
              />

              {/* highlight tambahan saat terpilih */}
              {isSelected && (
                <circle
                  cx={hole.x} cy={hole.y} r={hole.radius + 5}
                  fill="none" stroke="#facc15" strokeWidth="2" opacity="0.65"
                />
              )}

              <text
                x={hole.x} y={hole.y}
                textAnchor="middle" dominantBaseline="central"
                fontSize={labelSize} fontWeight="bold"
                fill="#ffffff"
                style={{ pointerEvents: 'none' }}
              >
                {hole.points}
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}

export default BoardPicker

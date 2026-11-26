import type { Drawing, Values } from './sim'
import { gateWidth } from './circuits'

interface Props {
  drawing: Drawing
  values: Values
  scale: number
  onToggle: (sig: string) => void
}

const on = (v: Values, s: string) => v[s] === 1

export function Schematic({ drawing: d, values, scale, onToggle }: Props) {
  // Draw 0-wires first so 1-wires sit on top at crossings.
  const wires = [...d.wires].sort((a, b) => Number(on(values, a.sig)) - Number(on(values, b.sig)))

  return (
    <svg
      className="schematic"
      viewBox={`0 0 ${d.width} ${d.height}`}
      width={d.width * scale}
      height={d.height * scale}
      role="img"
      aria-label="Decoder circuit schematic"
    >
      {d.blocks.map((b, i) => (
        <g key={`b${i}`} className="block">
          <rect x={b.x} y={b.y} width={b.w} height={b.h} rx={6} className="block-body" />
          {b.title && (
            <text x={b.x + b.w / 2} y={b.y - 8} textAnchor="middle" className="block-title">
              {b.title}
            </text>
          )}
          {b.pins.map((p, j) => {
            const isOn = on(values, p.sig)
            const left = p.side === 'l'
            return (
              <g key={j}>
                <circle cx={left ? b.x : b.x + b.w} cy={p.y} r={3.5} className={isOn ? 'pin-dot on' : 'pin-dot off'} />
                <text
                  x={left ? b.x + 8 : b.x + b.w - 8}
                  y={p.y + 4}
                  textAnchor={left ? 'start' : 'end'}
                  className={`block-pin ${!left && isOn ? 'active' : ''}`}
                >
                  {p.label}
                </text>
              </g>
            )
          })}
        </g>
      ))}

      {wires.map((w, i) => (
        <polyline
          key={`w${i}`}
          points={w.pts.map((p) => p.join(',')).join(' ')}
          className={on(values, w.sig) ? 'wire on' : 'wire off'}
        />
      ))}
      {d.dots.map((dt, i) => (
        <circle key={`d${i}`} cx={dt.at[0]} cy={dt.at[1]} r={4} className={on(values, dt.sig) ? 'dot on' : 'dot off'} />
      ))}

      {d.gates.map((g, i) => {
        const cls = on(values, g.out) ? 'gate hot' : 'gate'
        if (g.kind === 'NOT') {
          return (
            <g key={`g${i}`} className={cls}>
              <path d={`M${g.x} ${g.cy - 10} L${g.x + 22} ${g.cy} L${g.x} ${g.cy + 10} Z`} />
              <circle cx={g.x + 26} cy={g.cy} r={4} />
            </g>
          )
        }
        const w = gateWidth(g.h)
        const r = g.h / 2
        const t = g.cy - r
        if (g.kind === 'OR' || g.kind === 'NOR') {
          const b = g.cy + r
          const body = `M${g.x} ${t} Q${g.x + w * 0.62} ${t} ${g.x + w} ${g.cy} Q${g.x + w * 0.62} ${b} ${g.x} ${b} Q${g.x + w * 0.3} ${g.cy} ${g.x} ${t} Z`
          return (
            <g key={`g${i}`} className={cls}>
              <path d={body} />
              {g.kind === 'NOR' && <circle cx={g.x + w + 4} cy={g.cy} r={4} />}
            </g>
          )
        }
        return (
          <path
            key={`g${i}`}
            className={cls}
            d={`M${g.x} ${t} H${g.x + w - r} A${r} ${r} 0 0 1 ${g.x + w - r} ${g.cy + r} H${g.x} Z`}
          />
        )
      })}

      {d.sevenSeg && <SevenSeg {...d.sevenSeg} values={values} />}

      {d.labels.map((l, i) => (
        <text key={`l${i}`} x={l.at[0]} y={l.at[1]} textAnchor={l.anchor ?? 'start'} className={l.muted ? 'label muted' : 'label'}>
          {l.text}
        </text>
      ))}

      {d.inPins.map((p) => {
        const isOn = on(values, p.sig)
        const [x, y] = p.at
        return (
          <g
            key={`in-${p.sig}`}
            className={`in-pin ${isOn ? 'on' : 'off'}`}
            onClick={() => onToggle(p.sig)}
            role="button"
            aria-label={`Toggle ${p.label}, currently ${isOn ? 1 : 0}`}
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                onToggle(p.sig)
              }
            }}
          >
            {/* Larger invisible hit area so the pin stays tappable when zoomed out. */}
            <rect x={x - 46} y={y - 22} width={50} height={44} className="hit" />
            <rect x={x - 28} y={y - 13} width={26} height={26} rx={4} className="box" />
            <text x={x - 15} y={y + 5} textAnchor="middle" className="pin-val">
              {isOn ? 1 : 0}
            </text>
            <text x={x - 36} y={y + 5} textAnchor="end" className="pin-label">
              {p.label}
            </text>
          </g>
        )
      })}

      {d.outPins.map((p) => {
        const isOn = on(values, p.sig)
        const [x, y] = p.at
        return (
          <g key={`out-${p.sig}`} className={`out-pin ${isOn ? 'on' : 'off'}`}>
            <circle cx={x + 13} cy={y} r={12} />
            <text x={x + 13} y={y + 5} textAnchor="middle" className="pin-val">
              {isOn ? 1 : 0}
            </text>
            <text x={x + 32} y={y + 5} className="pin-label">
              {p.label}
            </text>
          </g>
        )
      })}
    </svg>
  )
}


/** Classic 7-segment digit. Segment order: a b c d e f g. */
function SevenSeg({ x, y, sigs, values }: { x: number; y: number; sigs: string[]; values: Values }) {
  const L = 64 // segment length
  const t = 12 // thickness
  const hseg = (x0: number, yc: number) =>
    [
      [x0, yc],
      [x0 + t / 2, yc - t / 2],
      [x0 + L - t / 2, yc - t / 2],
      [x0 + L, yc],
      [x0 + L - t / 2, yc + t / 2],
      [x0 + t / 2, yc + t / 2],
    ]
  const vseg = (xc: number, y0: number) =>
    [
      [xc, y0],
      [xc + t / 2, y0 + t / 2],
      [xc + t / 2, y0 + L - t / 2],
      [xc, y0 + L],
      [xc - t / 2, y0 + L - t / 2],
      [xc - t / 2, y0 + t / 2],
    ]
  const g = 2 // gap between segments
  const shapes = [
    hseg(x + g, y), // a
    vseg(x + L + 2 * g, y + g), // b
    vseg(x + L + 2 * g, y + L + 3 * g), // c
    hseg(x + g, y + 2 * L + 4 * g), // d
    vseg(x, y + L + 3 * g), // e
    vseg(x, y + g), // f
    hseg(x + g, y + L + 2 * g), // g
  ]
  return (
    <g className="seven-seg" aria-label="7-segment display">
      <rect x={x - 24} y={y - 24} width={L + 52} height={2 * L + 56} rx={10} className="seg-case" />
      {shapes.map((pts, i) => (
        <g key={i}>
          <polygon points={pts.map((p) => p.join(',')).join(' ')} className={values[sigs[i]] === 1 ? 'seg on' : 'seg'} />
        </g>
      ))}
      {['a', 'b', 'c', 'd', 'e', 'f', 'g'].map((nm, i) => {
        const pos: [number, number][] = [
          [x + L / 2, y - 10],
          [x + L + 22, y + L / 2],
          [x + L + 22, y + 1.5 * L + 6],
          [x + L / 2, y + 2 * L + 26],
          [x - 18, y + 1.5 * L + 6],
          [x - 18, y + L / 2],
          [x + L / 2, y + L - 8],
        ]
        return (
          <text key={nm} x={pos[i][0]} y={pos[i][1] + 4} textAnchor="middle" className="seg-label">
            {nm}
          </text>
        )
      })}
    </g>
  )
}

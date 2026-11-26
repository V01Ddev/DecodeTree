import type React from 'react'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { CIRCUITS } from './circuits'
import { simulate, truthTable, type CircuitDef, type Values } from './sim'
import { Schematic } from './Schematic'
import { TruthTable } from './TruthTable'

function defaults(c: CircuitDef): Values {
  const v: Values = {}
  c.inputs.forEach((n) => (v[n] = 0))
  if (c.enable) v.EN = 1
  return v
}

function readHash(): string {
  const id = window.location.hash.slice(1)
  return CIRCUITS.some((c) => c.id === id) ? id : 'tree-4'
}

type Theme = 'auto' | 'light' | 'dark'

export function App() {
  const [circuitId, setCircuitId] = useState(readHash)
  const circuit = CIRCUITS.find((c) => c.id === circuitId)!
  const [inputs, setInputs] = useState<Values>(() => defaults(circuit))
  const [zoom, setZoom] = useState<number | 'fit'>('fit')
  const [fitScale, setFitScale] = useState(1)
  const [theme, setTheme] = useState<Theme>(() => {
    try {
      return (localStorage.getItem('theme') as Theme) || 'auto'
    } catch {
      return 'auto'
    }
  })
  const stageRef = useRef<HTMLDivElement>(null)

  const values = useMemo(() => simulate(circuit.gates, inputs), [circuit, inputs])
  const rows = useMemo(() => truthTable(circuit), [circuit])

  const select = useCallback((id: string) => {
    const c = CIRCUITS.find((x) => x.id === id)!
    setCircuitId(id)
    setInputs(defaults(c))
    window.history.replaceState(null, '', `#${id}`)
    // Which circuits get used in class. An explicit path skips the host-prefix
    // function in index.html, so the host is added here.
    window.goatcounter?.count?.({ path: `${location.host}/circuit/${id}`, title: c.title, event: true })
  }, [])

  const toggle = useCallback((sig: string) => setInputs((v) => ({ ...v, [sig]: v[sig] ? 0 : 1 })), [])

  // Theme
  useEffect(() => {
    const root = document.documentElement
    if (theme === 'auto') root.removeAttribute('data-theme')
    else root.setAttribute('data-theme', theme)
    try {
      localStorage.setItem('theme', theme)
    } catch {
      /* ignore */
    }
  }, [theme])

  // Fit-to-stage scale
  useLayoutEffect(() => {
    const el = stageRef.current
    if (!el) return
    const update = () => {
      const pad = 24
      const s = Math.min((el.clientWidth - pad) / circuit.drawing.width, (el.clientHeight - pad) / circuit.drawing.height)
      setFitScale(Math.min(1.4, Math.max(0.2, s)))
    }
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [circuit])

  const scale = zoom === 'fit' ? fitScale : zoom
  const scaleRef = useRef(scale)
  scaleRef.current = scale

  // Pinch to zoom the schematic on touch screens. One finger still scrolls
  // natively; two fingers zoom around their midpoint.
  useEffect(() => {
    const el = stageRef.current
    if (!el) return
    type Pinch = { dist: number; scale: number; mx: number; my: number; sl: number; st: number }
    let pinch: Pinch | null = null
    const span = (t: TouchList) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY)
    const onStart = (e: TouchEvent) => {
      if (e.touches.length !== 2) return
      const r = el.getBoundingClientRect()
      pinch = {
        dist: span(e.touches),
        scale: scaleRef.current,
        mx: (e.touches[0].clientX + e.touches[1].clientX) / 2 - r.left,
        my: (e.touches[0].clientY + e.touches[1].clientY) / 2 - r.top,
        sl: el.scrollLeft,
        st: el.scrollTop,
      }
    }
    const onMove = (e: TouchEvent) => {
      if (!pinch || e.touches.length !== 2) return
      e.preventDefault()
      const p = pinch
      const next = Math.min(3, Math.max(0.2, (p.scale * span(e.touches)) / p.dist))
      setZoom(+next.toFixed(3))
      const k = next / p.scale
      requestAnimationFrame(() => {
        el.scrollLeft = (p.sl + p.mx) * k - p.mx
        el.scrollTop = (p.st + p.my) * k - p.my
      })
    }
    const onEnd = (e: TouchEvent) => {
      if (e.touches.length < 2) pinch = null
    }
    el.addEventListener('touchstart', onStart, { passive: true })
    el.addEventListener('touchmove', onMove, { passive: false })
    el.addEventListener('touchend', onEnd)
    el.addEventListener('touchcancel', onEnd)
    return () => {
      el.removeEventListener('touchstart', onStart)
      el.removeEventListener('touchmove', onMove)
      el.removeEventListener('touchend', onEnd)
      el.removeEventListener('touchcancel', onEnd)
    }
  }, [])

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return
      const byDigit = circuit.inputs.find((n) => n.slice(1) === e.key)
      if (byDigit) {
        toggle(byDigit)
      } else if ((e.key === 'e' || e.key === 'E') && circuit.enable) {
        toggle('EN')
      } else if (e.key === 'r' || e.key === 'R') {
        setInputs(defaults(circuit))
      } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault()
        const cur = rows.findIndex((r) => r.matches(inputs))
        const step = e.key === 'ArrowDown' ? 1 : -1
        const next = (cur + step + rows.length) % rows.length
        setInputs({ ...defaults(circuit), ...inputs, ...rows[next].assign })
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [circuit, rows, inputs, toggle])

  const groups = useMemo(() => {
    const m = new Map<string, CircuitDef[]>()
    CIRCUITS.forEach((c) => m.set(c.group, [...(m.get(c.group) ?? []), c]))
    return [...m.entries()]
  }, [])

  const code = circuit.inputs.map((n) => inputs[n] ?? 0).join('')
  const decimal = parseInt(code, 2)
  const activeOuts = circuit.outputs.filter((o) => values[o] === 1)

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <a className="logo" href="https://v01d.dev" target="_blank" rel="noopener noreferrer" aria-label="v01d.dev">
            {/* v01d's slashed-circle logo (the static logo.svg from v01d.dev), with
                strokes a little heavier than the original so it stays crisp at header size. */}
            <svg viewBox="0 0 100 100" width="30" height="30" aria-hidden>
              <rect width="100" height="100" rx="22" />
              <circle cx="50" cy="50" r="34" />
              <path d="M10 90 90 10" />
            </svg>
          </a>
          <h1>DecodeTree</h1>
        </div>
        <nav className="picker" aria-label="Circuits">
          {groups.map(([g, cs]) => (
            <div className="picker-group" key={g}>
              <span className="picker-label">{g}</span>
              <div className="seg">
                {cs.map((c) => (
                  <button key={c.id} className={c.id === circuitId ? 'sel' : ''} onClick={() => select(c.id)}>
                    {c.short}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </nav>
        <select
          className="picker-select"
          value={circuitId}
          onChange={(e) => select(e.target.value)}
          aria-label="Circuit"
        >
          {groups.map(([g, cs]) => (
            <optgroup key={g} label={g}>
              {cs.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
        <div className="theme">
          <span className="credit">
            Made by{' '}
            <a href="https://v01d.dev" target="_blank" rel="noopener noreferrer">
              v01d.dev
            </a>
          </span>
          <select value={theme} onChange={(e) => setTheme(e.target.value as Theme)} aria-label="Theme">
            <option value="auto">Auto theme</option>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
        </div>
      </header>

      <main className="main">
        <section className="panel circuit-panel">
          <div className="panel-head">
            <div>
              <h2>{circuit.title}</h2>
              <p className="blurb">{circuit.blurb}</p>
            </div>
          </div>

          <div className="controls">
            <div className="toggles">
              {circuit.enable && (
                <button className={`bit ${inputs.EN ? 'on' : ''}`} onClick={() => toggle('EN')} title="Shortcut: E">
                  <span>EN</span>
                  <b>{inputs.EN ?? 0}</b>
                </button>
              )}
              {circuit.inputs.map((n) => (
                <button key={n} className={`bit ${inputs[n] ? 'on' : ''}`} onClick={() => toggle(n)} title={`Shortcut: ${n.slice(1)}`}>
                  <span>{n}</span>
                  <b>{inputs[n] ?? 0}</b>
                </button>
              ))}
              <button className="ghost" onClick={() => setInputs(defaults(circuit))} title="Shortcut: R">
                Reset
              </button>
            </div>
            <div className="readout" aria-live="polite">
              {circuit.enable && !inputs.EN ? (
                <>
                  EN = 0 <span className="arrow">→</span> all outputs 0
                </>
              ) : (
                <>
                  <span className="mono">{circuit.inputs.join('')}</span> = <span className="mono">{code}</span>
                  <sub>2</sub> = <b>{decimal}</b> <span className="arrow">→</span>{' '}
                  {activeOuts.length ? (
                    <>
                      <b className="hot">{activeOuts.join(', ')}</b> = 1
                    </>
                  ) : (
                    'all outputs 0'
                  )}
                </>
              )}
            </div>
          </div>

          <div
            className="stage-wrap"
            style={{ '--aspect': circuit.drawing.height / circuit.drawing.width } as React.CSSProperties}
          >
            <div className="stage" ref={stageRef}>
              <Schematic drawing={circuit.drawing} values={values} scale={scale} onToggle={toggle} />
            </div>
            <div className="zoom">
              <button onClick={() => setZoom(Math.max(0.3, +(scale - 0.15).toFixed(2)))} aria-label="Zoom out">
                −
              </button>
              <button className={zoom === 'fit' ? 'sel' : ''} onClick={() => setZoom('fit')}>
                Fit
              </button>
              <button onClick={() => setZoom(Math.min(3, +(scale + 0.15).toFixed(2)))} aria-label="Zoom in">
                +
              </button>
            </div>
          </div>
          <p className="hint touch-only">
            Tap an input pin (the square boxes) or the buttons above to poke it. Pinch or use − / + to zoom, and drag to
            move around. Tap a truth-table row to apply it.
          </p>
          <p className="hint pointer-only">
            Click an input pin (the square boxes) to poke it, like Logisim’s poke tool. Keys:{' '}
            {circuit.inputs.length > 1 ? (
              <>
                <kbd>0</kbd>–<kbd>{circuit.inputs.length - 1}</kbd> toggle {circuit.inputs[circuit.inputs.length - 1]}–{circuit.inputs[0]}
              </>
            ) : (
              <>
                <kbd>0</kbd> toggles {circuit.inputs[0]}
              </>
            )}
            {circuit.enable && (
              <>
                , <kbd>E</kbd> toggles EN
              </>
            )}
            , <kbd>↑</kbd>
            <kbd>↓</kbd> step through the truth table, <kbd>R</kbd> resets.
          </p>
        </section>

        <section className="panel table-panel">
          <div className="panel-head">
            <h2>Truth table</h2>
            <span className="muted small pointer-only">Click a row to apply it</span>
            <span className="muted small touch-only">Tap a row to apply it</span>
          </div>
          <TruthTable circuit={circuit} rows={rows} values={inputs} onPick={(a) => setInputs({ ...defaults(circuit), ...inputs, ...a })} />
        </section>
      </main>
    </div>
  )
}

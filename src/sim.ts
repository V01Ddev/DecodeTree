// Tiny combinational logic simulator + drawing model.

export type Bit = 0 | 1
export type Values = Record<string, Bit>
export type GateKind = 'NOT' | 'AND' | 'OR' | 'NOR' | 'BUF'

/** A logic gate in the netlist. Signals are plain string names. */
export interface Gate {
  kind: GateKind
  ins: string[]
  out: string
}

export type Pt = [number, number]

/** Everything the SVG renderer needs. Every wire is tagged with the signal it carries. */
export interface Drawing {
  width: number
  height: number
  wires: { sig: string; pts: Pt[] }[]
  dots: { sig: string; at: Pt }[]
  gates: { kind: GateKind; x: number; cy: number; h: number; out: string }[]
  inPins: { sig: string; label: string; at: Pt }[]
  outPins: { sig: string; label: string; at: Pt }[]
  blocks: {
    x: number
    y: number
    w: number
    h: number
    title: string
    pins: { label: string; side: 'l' | 'r'; y: number; sig: string }[]
  }[]
  labels: { text: string; at: Pt; anchor?: 'start' | 'middle' | 'end'; muted?: boolean }[]
  /** Optional 7-segment display; sigs are segments a..g in order. */
  sevenSeg?: { x: number; y: number; sigs: string[] }
}

export interface CircuitDef {
  id: string
  title: string
  group: string
  blurb: string
  /** Select inputs, MSB first (e.g. ['A1', 'A0']). */
  inputs: string[]
  /** Whether the circuit has an active-high EN input. */
  enable: boolean
  outputs: string[]
  gates: Gate[]
  drawing: Drawing
  /** Short label for the circuit picker, e.g. "2→4". */
  short: string
  /** Collapse rows with input value >= this into one row (if their outputs all match). */
  collapseFrom?: number
}

/** Evaluate the netlist. Gates may be listed in any order; we iterate until stable. */
export function simulate(gates: Gate[], inputs: Values): Values {
  const v: Values = { ...inputs }
  for (let pass = 0; pass <= gates.length; pass++) {
    let changed = false
    for (const g of gates) {
      const ins = g.ins.map((s) => v[s] ?? 0)
      let out: Bit
      switch (g.kind) {
        case 'NOT':
          out = ins[0] ? 0 : 1
          break
        case 'AND':
          out = ins.every((x) => x === 1) ? 1 : 0
          break
        case 'OR':
          out = ins.some((x) => x === 1) ? 1 : 0
          break
        case 'NOR':
          out = ins.some((x) => x === 1) ? 0 : 1
          break
        case 'BUF':
          out = ins[0]
          break
      }
      if (v[g.out] !== out) {
        v[g.out] = out
        changed = true
      }
    }
    if (!changed) break
  }
  return v
}

export type Cell = Bit | 'X'

export interface TruthRow {
  /** Cells for [EN?, ...inputs], in display order. */
  inCells: Cell[]
  /** When set, the input side is shown as this single label (e.g. "1010 – 1111"). */
  span?: string
  outs: Bit[]
  /** Input assignment to apply when the row is clicked. */
  assign: Values
  matches: (cur: Values) => boolean
}

/**
 * Build the truth table by actually simulating every input combination.
 * With an enable input, all EN=0 rows are collapsed into one "0 X X … X" row
 * (textbook style) after checking that they really are identical.
 */
export function truthTable(c: CircuitDef): TruthRow[] {
  const n = c.inputs.length
  const rows: TruthRow[] = []
  const evalOuts = (assign: Values) => {
    const v = simulate(c.gates, assign)
    return c.outputs.map((o) => v[o] ?? 0)
  }
  const assignFor = (k: number, en: Bit): Values => {
    const a: Values = {}
    c.inputs.forEach((name, i) => (a[name] = ((k >> (n - 1 - i)) & 1) as Bit))
    if (c.enable) a.EN = en
    return a
  }

  if (c.enable) {
    const disabled = Array.from({ length: 1 << n }, (_, k) => evalOuts(assignFor(k, 0)).join(''))
    const allSame = disabled.every((d) => d === disabled[0])
    if (allSame) {
      const a = assignFor(0, 0)
      rows.push({
        inCells: [0, ...c.inputs.map(() => 'X' as const)],
        outs: evalOuts(a),
        assign: { EN: 0 },
        matches: (cur) => cur.EN === 0,
      })
    } else {
      for (let k = 0; k < 1 << n; k++) rows.push(fullRow(assignFor(k, 0)))
    }
  }
  const from = c.collapseFrom
  const tail = from === undefined ? [] : Array.from({ length: (1 << n) - from }, (_, i) => evalOuts(assignFor(from + i, 1)).join(''))
  const collapse = from !== undefined && tail.length > 1 && tail.every((t) => t === tail[0])
  const last = collapse ? from! : 1 << n
  for (let k = 0; k < last; k++) rows.push(fullRow(assignFor(k, 1)))
  if (collapse) {
    const bin = (k: number) => k.toString(2).padStart(n, '0')
    const a = assignFor(from!, 1)
    const code = (cur: Values) => c.inputs.reduce((acc, nm) => acc * 2 + (cur[nm] ?? 0), 0)
    rows.push({
      inCells: [],
      span: `${bin(from!)} – ${bin((1 << n) - 1)}`,
      outs: evalOuts(a),
      assign: a,
      matches: (cur) => (!c.enable || cur.EN === 1) && code(cur) >= from!,
    })
  }
  return rows

  function fullRow(a: Values): TruthRow {
    const names = [...(c.enable ? ['EN'] : []), ...c.inputs]
    return {
      inCells: names.map((nm) => a[nm]),
      outs: evalOuts(a),
      assign: a,
      matches: (cur) => names.every((nm) => (cur[nm] ?? 0) === a[nm]),
    }
  }
}

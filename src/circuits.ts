import type { CircuitDef, Drawing, Gate, GateKind } from './sim'

const PIN_X = 70 // connection point of input pins

function emptyDrawing(): Drawing {
  return { width: 0, height: 0, wires: [], dots: [], gates: [], inPins: [], outPins: [], blocks: [], labels: [] }
}

/** Width of an AND/OR gate body of height h. */
export function gateWidth(h: number) {
  return Math.max(40, h / 2 + 18)
}
/** X coordinate of a gate's output terminal. */
export function gateOutX(kind: GateKind, x: number, h: number) {
  if (kind === 'NOT') return x + NOT_WIDTH
  return x + gateWidth(h) + (kind === 'NOR' ? 8 : 0)
}
export const NOT_WIDTH = 30

const sel = (n: number, p = 'A') => Array.from({ length: n }, (_, i) => `${p}${n - 1 - i}`) // MSB first

/** Netlist of an n-to-2^n decoder (NOT per input, AND per output, optional enable). */
function decoderGates(prefix: string, ins: string[], en: string | null, outs: string[]): Gate[] {
  const n = ins.length
  const inv = (s: string) => `${prefix}.${s}'`
  const gates: Gate[] = ins.map((s) => ({ kind: 'NOT' as const, ins: [s], out: inv(s) }))
  outs.forEach((out, k) => {
    const terms = ins.map((s, i) => (((k >> (n - 1 - i)) & 1) ? s : inv(s)))
    gates.push({ kind: 'AND', ins: en ? [...terms, en] : terms, out })
  })
  return gates
}

function minterm(inputs: string[], k: number) {
  const n = inputs.length
  return inputs.map((nm, i) => (((k >> (n - 1 - i)) & 1) ? nm : `${nm}′`)).join('')
}

// ---------------------------------------------------------------------------
// Gate-level decoder (slides 6, 7, 10): one NOT per input, one AND per output,
// drawn with vertical true/complement rails like the textbook figures.
// ---------------------------------------------------------------------------
function flatDecoder(n: number, enable: boolean): CircuitDef {
  const inputs = sel(n)
  const outputs = Array.from({ length: 1 << n }, (_, k) => `Y${k}`)
  const gates: Gate[] = []
  const d = emptyDrawing()

  const rowGap = 56
  const top = 50
  const railBase = 250
  const railStep = 64
  const railT = (i: number) => railBase + i * railStep
  const railF = (i: number) => railBase + i * railStep + 32
  const railEN = railBase + n * railStep
  const lastRail = enable ? railEN : railF(n - 1)
  const nIn = n + (enable ? 1 : 0)
  const noGates = nIn === 1 // plain 1-to-2: outputs are just A0' and A0
  const spacing = n >= 4 ? 8 : 10
  const h = Math.max(30, nIn * spacing + spacing)
  const pitch = h + 14
  const gx = lastRail + 80
  const gw = gateWidth(h)
  const outX = noGates ? lastRail + 120 : gx + gw + 70
  const rows = n + (enable ? 1 : 0)
  const gatesTop = top + rows * rowGap + 10
  const lastPinY = noGates ? gatesTop + pitch + h / 2 : gatesTop + ((1 << n) - 1) * pitch + h - spacing
  const junctionX = 120
  const notX = 150

  inputs.forEach((name, i) => {
    const y = top + i * rowGap
    const ny = y + 24
    const inv = `${name}'`
    gates.push({ kind: 'NOT', ins: [name], out: inv })
    d.inPins.push({ sig: name, label: name, at: [PIN_X, y] })
    d.wires.push({ sig: name, pts: [[PIN_X, y], [railT(i), y], [railT(i), lastPinY]] })
    d.wires.push({ sig: name, pts: [[junctionX, y], [junctionX, ny], [notX, ny]] })
    d.dots.push({ sig: name, at: [junctionX, y] })
    d.gates.push({ kind: 'NOT', x: notX, cy: ny, h: 20, out: inv })
    d.wires.push({ sig: inv, pts: [[notX + NOT_WIDTH, ny], [railF(i), ny], [railF(i), lastPinY]] })
    d.labels.push({ text: name, at: [railT(i), lastPinY + 18], anchor: 'middle', muted: true })
    d.labels.push({ text: `${name}′`, at: [railF(i), lastPinY + 18], anchor: 'middle', muted: true })
  })
  if (enable) {
    const y = top + n * rowGap
    d.inPins.push({ sig: 'EN', label: 'EN', at: [PIN_X, y] })
    d.wires.push({ sig: 'EN', pts: [[PIN_X, y], [railEN, y], [railEN, lastPinY]] })
    d.labels.push({ text: 'EN', at: [railEN, lastPinY + 18], anchor: 'middle', muted: true })
  }

  outputs.forEach((out, k) => {
    const gTop = gatesTop + k * pitch
    const cy = gTop + h / 2
    if (noGates) {
      const sig = k ? inputs[0] : `${inputs[0]}'`
      const rx = k ? railT(0) : railF(0)
      gates.push({ kind: 'BUF', ins: [sig], out })
      d.wires.push({ sig: out, pts: [[rx, cy], [outX, cy]] })
      d.dots.push({ sig: out, at: [rx, cy] })
      d.outPins.push({ sig: out, label: out, at: [outX, cy] })
      d.labels.push({ text: `${out} = ${minterm(inputs, k)}`, at: [rx + 40, cy - 8], muted: true })
      return
    }
    const ins: string[] = []
    inputs.forEach((name, i) => {
      const bit = (k >> (n - 1 - i)) & 1
      const sig = bit ? name : `${name}'`
      const rx = bit ? railT(i) : railF(i)
      const py = gTop + (i + 1) * spacing
      ins.push(sig)
      d.wires.push({ sig, pts: [[rx, py], [gx, py]] })
      d.dots.push({ sig, at: [rx, py] })
    })
    if (enable) {
      const py = gTop + nIn * spacing
      d.wires.push({ sig: 'EN', pts: [[railEN, py], [gx, py]] })
      d.dots.push({ sig: 'EN', at: [railEN, py] })
      ins.push('EN')
    }
    gates.push({ kind: 'AND', ins, out })
    d.gates.push({ kind: 'AND', x: gx, cy, h, out })
    d.wires.push({ sig: out, pts: [[gx + gw, cy], [outX, cy]] })
    d.outPins.push({ sig: out, label: out, at: [outX, cy] })
    d.labels.push({
      text: (enable ? 'EN·' : '') + minterm(inputs, k),
      at: [gx + gw + 8, cy - 7],
      anchor: 'start',
      muted: true,
    })
  })

  d.width = outX + 70
  d.height = lastPinY + 34

  const N = 1 << n
  const blurbs: Record<string, string> = {
    '1': 'Slide 6. Just one inverter: Y0 = A0′ and Y1 = A0.',
    '2': 'Slide 6. Two inverters and four AND gates. Each output is one minterm, so exactly one output is 1.',
    '2e': 'Slide 10. Same as the 2-to-4 decoder, but every AND gate also takes EN. If EN = 0, all outputs are 0 regardless of A1 A0.',
    '3': 'Slide 7. Three inverters and eight 3-input AND gates. Each output is one minterm of A2 A1 A0.',
    '4': 'Four inverters and sixteen 4-input AND gates: the flat version of the 4-to-16 tree decoder.',
  }
  return {
    id: `flat-${n}${enable ? 'e' : ''}`,
    title: `${n}-to-${N} decoder${enable ? ' with enable' : ''}`,
    short: `${n}→${N}${enable ? ' EN' : ''}`,
    group: 'Gate level',
    blurb: blurbs[`${n}${enable ? 'e' : ''}`] ?? '',
    inputs,
    enable,
    outputs,
    gates,
    drawing: d,
  }
}

// ---------------------------------------------------------------------------
// 2-to-4 decoder block with enable, used in the tree decoders (slides 11, 12).
// ---------------------------------------------------------------------------
const BLOCK_W = 90
const BLOCK_H = 120
const BP = { a1: 30, a0: 55, en: 95 } // left pin offsets
const BOUT = (j: number) => 24 + j * 24 // right pin offsets

function block2to4(p: string, a1: string, a0: string, en: string, outs: string[], d: Drawing, x: number, y: number, title: string): Gate[] {
  d.blocks.push({
    x,
    y,
    w: BLOCK_W,
    h: BLOCK_H,
    title,
    pins: [
      { label: 'A1', side: 'l', y: y + BP.a1, sig: a1 },
      { label: 'A0', side: 'l', y: y + BP.a0, sig: a0 },
      { label: 'EN', side: 'l', y: y + BP.en, sig: en },
      ...outs.map((o, j) => ({ label: `${j}`, side: 'r' as const, y: y + BOUT(j), sig: o })),
    ],
  })
  return decoderGates(p, [a1, a0], en, outs)
}

function blockOutputs(d: Drawing, x: number, y: number, outs: string[], outX: number) {
  outs.forEach((o, j) => {
    const py = y + BOUT(j)
    d.wires.push({ sig: o, pts: [[x + BLOCK_W, py], [outX, py]] })
    d.outPins.push({ sig: o, label: o, at: [outX, py] })
  })
}

/** Input pin feeding a vertical bus with taps into block pins. */
function bus(d: Drawing, sig: string, startY: number, bx: number, taps: number[], toX: number) {
  const last = taps[taps.length - 1]
  d.wires.push({ sig, pts: [[PIN_X, startY], [bx, startY], [bx, last]] })
  taps.forEach((ty, i) => {
    d.wires.push({ sig, pts: [[bx, ty], [toX, ty]] })
    if (i < taps.length - 1) d.dots.push({ sig, at: [bx, ty] })
  })
  d.inPins.push({ sig, label: sig, at: [PIN_X, startY] })
}

// Slide 11: 3-to-8 from two 2-to-4 decoders and an inverter (a 1-to-2 decoder) on A2.
function tree3to8(): CircuitDef {
  const d = emptyDrawing()
  const gates: Gate[] = []
  const bx = 480
  const y0 = 110
  const y1 = 290
  const outX = bx + BLOCK_W + 80
  const lo = ['Y0', 'Y1', 'Y2', 'Y3']
  const hi = ['Y4', 'Y5', 'Y6', 'Y7']

  gates.push(...block2to4('T', 'A1', 'A0', "A2'", lo, d, bx, y0, 'Top 2-to-4'))
  gates.push(...block2to4('B', 'A1', 'A0', 'A2', hi, d, bx, y1, 'Bottom 2-to-4'))
  blockOutputs(d, bx, y0, lo, outX)
  blockOutputs(d, bx, y1, hi, outX)
  bus(d, 'A1', 40, 420, [y0 + BP.a1, y1 + BP.a1], bx)
  bus(d, 'A0', 70, 440, [y0 + BP.a0, y1 + BP.a0], bx)

  // 1-to-2 decoder: Top EN = A2', Bottom EN = A2
  const a2y = y0 + BP.en
  const jx = 180
  const nx = 250
  gates.push({ kind: 'NOT', ins: ['A2'], out: "A2'" })
  d.inPins.push({ sig: 'A2', label: 'A2', at: [PIN_X, a2y] })
  d.wires.push({ sig: 'A2', pts: [[PIN_X, a2y], [nx, a2y]] })
  d.wires.push({ sig: 'A2', pts: [[jx, a2y], [jx, y1 + BP.en], [bx, y1 + BP.en]] })
  d.dots.push({ sig: 'A2', at: [jx, a2y] })
  d.gates.push({ kind: 'NOT', x: nx, cy: a2y, h: 20, out: "A2'" })
  d.wires.push({ sig: "A2'", pts: [[nx + NOT_WIDTH, a2y], [bx, a2y]] })
  d.blocks.push({ x: jx - 30, y: a2y - 40, w: 160, h: y1 + BP.en - a2y + 70, title: '1-to-2 decoder', pins: [] })
  d.labels.push({ text: 'EN = A2′', at: [nx + NOT_WIDTH + 70, a2y - 8], muted: true })
  d.labels.push({ text: 'EN = A2', at: [nx + NOT_WIDTH + 70, y1 + BP.en - 8], muted: true })

  d.width = outX + 70
  d.height = y1 + BLOCK_H + 30

  return {
    id: 'tree-3',
    title: '3-to-8 from two 2-to-4 decoders',
    short: '3→8',
    group: 'Built from 2-to-4 blocks',
    blurb:
      'Slide 11. A1 A0 go to both 2-to-4 decoders, and an inverter on A2 (a 1-to-2 decoder) picks which one is enabled: A2 = 0 enables the top decoder (Y0–Y3), A2 = 1 enables the bottom one (Y4–Y7).',
    inputs: ['A2', 'A1', 'A0'],
    enable: false,
    outputs: [...lo, ...hi],
    gates,
    drawing: d,
  }
}

// Slide 12: 4-to-16 with enable from five 2-to-4 decoders.
function tree4to16(): CircuitDef {
  const d = emptyDrawing()
  const gates: Gate[] = []
  const bx = 620
  const ys = [130, 280, 430, 580]
  const outX = bx + BLOCK_W + 80
  const d0x = 200
  const d0y = (ys[0] + ys[3] + BLOCK_H) / 2 - BLOCK_H / 2
  const en = ['E0', 'E1', 'E2', 'E3']
  const outputs: string[] = []

  gates.push(...block2to4('F', 'A3', 'A2', 'EN', en, d, d0x, d0y, '2-to-4'))
  d.inPins.push({ sig: 'A3', label: 'A3', at: [PIN_X, d0y + BP.a1] })
  d.inPins.push({ sig: 'A2', label: 'A2', at: [PIN_X, d0y + BP.a0] })
  d.inPins.push({ sig: 'EN', label: 'EN', at: [PIN_X, d0y + BP.en] })
  d.wires.push({ sig: 'A3', pts: [[PIN_X, d0y + BP.a1], [d0x, d0y + BP.a1]] })
  d.wires.push({ sig: 'A2', pts: [[PIN_X, d0y + BP.a0], [d0x, d0y + BP.a0]] })
  d.wires.push({ sig: 'EN', pts: [[PIN_X, d0y + BP.en], [d0x, d0y + BP.en]] })

  ys.forEach((y, k) => {
    const outs = [0, 1, 2, 3].map((j) => `Y${4 * k + j}`)
    outputs.push(...outs)
    gates.push(...block2to4(`D${k}`, 'A1', 'A0', en[k], outs, d, bx, y, `Decoder ${k}`))
    blockOutputs(d, bx, y, outs, outX)
  })

  bus(d, 'A1', 40, 560, ys.map((y) => y + BP.a1), bx)
  bus(d, 'A0', 80, 580, ys.map((y) => y + BP.a0), bx)

  // Enable lines; x lanes chosen so they never cross.
  const lane = [340, 370, 370, 340]
  en.forEach((e, k) => {
    const sy = d0y + BOUT(k)
    const ty = ys[k] + BP.en
    d.wires.push({ sig: e, pts: [[d0x + BLOCK_W, sy], [lane[k], sy], [lane[k], ty], [bx, ty]] })
  })

  d.width = outX + 70
  d.height = ys[3] + BLOCK_H + 30

  return {
    id: 'tree-4',
    title: '4-to-16 decoder from five 2-to-4 decoders',
    short: '4→16',
    group: 'Built from 2-to-4 blocks',
    blurb:
      'Slide 12. The first 2-to-4 decodes A3 A2 and enables exactly one of Decoders 0–3; that decoder then decodes A1 A0. With EN = 0 the first decoder is off, so nothing downstream is enabled.',
    inputs: ['A3', 'A2', 'A1', 'A0'],
    enable: true,
    outputs,
    gates,
    drawing: d,
  }
}

// ---------------------------------------------------------------------------
// Slide 16: BCD to 7-segment using a 4-to-10 decoder, NOR gates for the
// segments' 0s, an OR for segment e, and I3(I2+I1) to blank inputs > 9.
// ---------------------------------------------------------------------------
function bcdTo7Seg(): CircuitDef {
  const d = emptyDrawing()
  const inputs = sel(4, 'I')
  const dec = Array.from({ length: 10 }, (_, j) => `d${j}`)
  const gates: Gate[] = decoderGates('DEC', inputs, null, dec)

  // Decoder block
  const bx = 200
  const by = 60
  const bw = 110
  const bh = 330
  const outY = (j: number) => by + 30 + j * 30
  const inY = (i: number) => by + 120 + i * 30
  d.blocks.push({
    x: bx,
    y: by,
    w: bw,
    h: bh,
    title: '4-to-10 decoder',
    pins: [
      ...inputs.map((s, i) => ({ label: s, side: 'l' as const, y: inY(i), sig: s })),
      ...dec.map((s, j) => ({ label: `${j}`, side: 'r' as const, y: outY(j), sig: s })),
    ],
  })
  inputs.forEach((s, i) => {
    d.inPins.push({ sig: s, label: s, at: [PIN_X, inY(i)] })
    d.wires.push({ sig: s, pts: [[PIN_X, inY(i)], [bx, inY(i)]] })
  })

  // Input > 9 detector: GT9 = I3 (I2 + I1)
  const orX = 220
  const orY = 440
  const andX = 320
  const andY = 470
  gates.push({ kind: 'OR', ins: ['I2', 'I1'], out: 'I2+I1' })
  gates.push({ kind: 'AND', ins: ['I2+I1', 'I3'], out: 'GT9' })
  d.dots.push({ sig: 'I3', at: [120, inY(0)] }, { sig: 'I2', at: [140, inY(1)] }, { sig: 'I1', at: [160, inY(2)] })
  d.wires.push({ sig: 'I2', pts: [[140, inY(1)], [140, orY - 10], [orX, orY - 10]] })
  d.wires.push({ sig: 'I1', pts: [[160, inY(2)], [160, orY + 10], [orX, orY + 10]] })
  d.wires.push({ sig: 'I3', pts: [[120, inY(0)], [120, andY + 10], [andX, andY + 10]] })
  d.gates.push({ kind: 'OR', x: orX, cy: orY, h: 40, out: 'I2+I1' })
  const orOut = gateOutX('OR', orX, 40)
  d.wires.push({ sig: 'I2+I1', pts: [[orOut, orY], [290, orY], [290, andY - 10], [andX, andY - 10]] })
  d.gates.push({ kind: 'AND', x: andX, cy: andY, h: 40, out: 'GT9' })
  const gtOut = gateOutX('AND', andX, 40)
  d.blocks.push({ x: orX - 20, y: orY - 45, w: gtOut - orX + 40, h: 100, title: '', pins: [] })
  d.labels.push({ text: 'I3(I2+I1): input > 9', at: [orX - 10, andY + 45], muted: true })

  // Segment gates: NOR over the codes where the segment is 0 (plus GT9), OR for e.
  const segs: { name: string; kind: GateKind; ins: string[] }[] = [
    { name: 'a', kind: 'NOR', ins: ['d1', 'd4', 'GT9'] },
    { name: 'b', kind: 'NOR', ins: ['d5', 'd6', 'GT9'] },
    { name: 'c', kind: 'NOR', ins: ['d2', 'GT9'] },
    { name: 'd', kind: 'NOR', ins: ['d1', 'd4', 'd7', 'GT9'] },
    { name: 'e', kind: 'OR', ins: ['d0', 'd2', 'd6', 'd8'] },
    { name: 'f', kind: 'NOR', ins: ['d1', 'd2', 'd3', 'd7', 'GT9'] },
    { name: 'g', kind: 'NOR', ins: ['d0', 'd1', 'd7', 'GT9'] },
  ]
  const railX: Record<string, number> = { GT9: 530 }
  dec.forEach((s, j) => (railX[s] = 360 + j * 16))
  const taps: Record<string, number[]> = {}
  const gx = 590
  const outX = 720
  let gTop = 30
  segs.forEach((sg) => {
    const h = (sg.ins.length + 1) * 10
    const cy = gTop + h / 2
    sg.ins.forEach((s, i) => {
      const py = gTop + (i + 1) * 10
      ;(taps[s] ??= []).push(py)
      d.wires.push({ sig: s, pts: [[railX[s], py], [gx + 4, py]] })
    })
    gates.push({ kind: sg.kind, ins: sg.ins, out: sg.name })
    d.gates.push({ kind: sg.kind, x: gx, cy, h, out: sg.name })
    d.wires.push({ sig: sg.name, pts: [[gateOutX(sg.kind, gx, h), cy], [outX, cy]] })
    d.outPins.push({ sig: sg.name, label: sg.name, at: [outX, cy] })
    gTop += h + 24
  })
  // Rails: each decoder output / GT9 runs to its own vertical rail, tapped by the gates.
  const origin: Record<string, [number, number]> = { GT9: [gtOut, andY] }
  dec.forEach((s, j) => (origin[s] = [bx + bw, outY(j)]))
  Object.entries(taps).forEach(([s, ts]) => {
    const rx = railX[s]
    const [ox, oy] = origin[s]
    const ysAll = [oy, ...ts]
    const lo = Math.min(...ysAll)
    const hi = Math.max(...ysAll)
    d.wires.push({ sig: s, pts: [[ox, oy], [rx, oy]] })
    d.wires.push({ sig: s, pts: [[rx, lo], [rx, hi]] })
    ts.forEach((t) => {
      if (t !== lo && t !== hi) d.dots.push({ sig: s, at: [rx, t] })
    })
    if (oy !== lo && oy !== hi) d.dots.push({ sig: s, at: [rx, oy] })
  })
  // d9 is unused by every segment, but still drawn as a decoder output stub.
  d.wires.push({ sig: 'd9', pts: [[bx + bw, outY(9)], [bx + bw + 20, outY(9)]] })

  d.sevenSeg = { x: 810, y: 150, sigs: segs.map((s) => s.name) }
  d.width = 920
  d.height = Math.max(gTop, 540)

  return {
    id: 'bcd-7seg',
    title: 'BCD to 7-segment decoder',
    short: 'BCD→7-seg',
    group: 'Applications',
    blurb:
      'Slide 16. A 4-to-10 decoder produces one line per BCD digit. NOR gates collect the digits where a segment is OFF (fewer 0s than 1s), segment e uses an OR of its 1s, and I3(I2+I1) forces the display off for non-BCD inputs 1010–1111.',
    inputs,
    enable: false,
    outputs: segs.map((s) => s.name),
    gates,
    drawing: d,
    collapseFrom: 10,
  }
}

export const CIRCUITS: CircuitDef[] = [
  flatDecoder(1, false),
  flatDecoder(2, false),
  flatDecoder(2, true),
  flatDecoder(3, false),
  flatDecoder(4, false),
  tree3to8(),
  tree4to16(),
  bcdTo7Seg(),
]

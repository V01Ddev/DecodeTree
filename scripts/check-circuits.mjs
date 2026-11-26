// Simulates every circuit for every input combination and checks the outputs,
// plus that every wire in each drawing carries a signal the netlist produces.
// Run with `npm run check`; exits non-zero on any failure.
import { createServer } from 'vite'

const server = await createServer({ server: { middlewareMode: true }, logLevel: 'error' })
const { CIRCUITS } = await server.ssrLoadModule('/src/circuits.ts')
const { simulate, truthTable } = await server.ssrLoadModule('/src/sim.ts')
await server.close()

// Slide 16 truth table, segments a..g for digits 0-9; 1010-1111 are blank.
const SEG = ['1111110', '0110000', '1101101', '1111001', '0110011', '1011011', '1011111', '1110000', '1111111', '1111011']

let failures = 0
for (const c of CIRCUITS) {
  const n = c.inputs.length
  for (let k = 0; k < 1 << n; k++) {
    for (const en of c.enable ? [0, 1] : [1]) {
      const assign = c.enable ? { EN: en } : {}
      c.inputs.forEach((name, i) => (assign[name] = (k >> (n - 1 - i)) & 1))
      const v = simulate(c.gates, assign)
      const got = c.outputs.map((o) => v[o]).join('')
      const want =
        c.id === 'bcd-7seg' ? (SEG[k] ?? '0000000') : c.outputs.map((_, j) => (en && j === k ? 1 : 0)).join('')
      if (got !== want) {
        failures++
        console.error(`FAIL ${c.id} ${JSON.stringify(assign)}: got ${got}, want ${want}`)
      }
    }
  }

  const v = simulate(c.gates, { EN: 1, ...Object.fromEntries(c.inputs.map((x) => [x, 0])) })
  const d = c.drawing
  const sigs = [
    ...d.wires,
    ...d.dots,
    ...d.inPins,
    ...d.outPins,
    ...d.gates.map((g) => ({ sig: g.out })),
    ...d.blocks.flatMap((b) => b.pins),
    ...(d.sevenSeg?.sigs ?? []).map((sig) => ({ sig })),
  ].map((x) => x.sig)
  const unknown = [...new Set(sigs.filter((s) => !(s in v)))]
  if (unknown.length) {
    failures++
    console.error(`FAIL ${c.id}: drawing uses unknown signals ${unknown.join(', ')}`)
  }
  console.log(`ok  ${c.id.padEnd(9)} ${truthTable(c).length} truth-table rows`)
}

if (failures) {
  console.error(`\n${failures} failure(s)`)
  process.exit(1)
}

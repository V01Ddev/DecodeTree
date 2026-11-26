# DecodeTree

Interactive decoder circuits with live truth tables, in the style of Logisim's poke tool.

```bash
npm install
npm run dev      # local dev server
npm run build    # static site in dist/ (relative paths; works on GitHub Pages, Netlify, Vercel)
```

Circuits are defined in `src/circuits.ts` (netlist + drawing). The simulator and truth-table builder are in `src/sim.ts`.
Link straight to a circuit with a hash, e.g. `#tree-4` or `#flat-3`.

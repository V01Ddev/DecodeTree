import type { CircuitDef, TruthRow, Values } from './sim'

interface Props {
  circuit: CircuitDef
  rows: TruthRow[]
  values: Values
  onPick: (assign: Values) => void
}

export function TruthTable({ circuit: c, rows, values, onPick }: Props) {
  const inNames = [...(c.enable ? ['EN'] : []), ...c.inputs]
  return (
    <div className="tt-wrap">
      <table className="tt">
        <thead>
          <tr>
            {inNames.map((n, i) => (
              <th key={n} className={i === inNames.length - 1 ? 'sep' : ''}>
                {n}
              </th>
            ))}
            {c.outputs.map((o) => (
              <th key={o} className="out">
                {o}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, ri) => {
            const active = r.matches(values)
            return (
              <tr
                key={ri}
                className={active ? 'active' : ''}
                onClick={() => onPick(r.assign)}
                title="Click to apply these inputs"
              >
                {r.span ? (
                  <td colSpan={inNames.length} className="sep span">
                    {r.span}
                  </td>
                ) : (
                  r.inCells.map((cell, i) => (
                    <td key={i} className={`${i === r.inCells.length - 1 ? 'sep' : ''} ${cell === 'X' ? 'x' : ''}`}>
                      {cell}
                    </td>
                  ))
                )}
                {r.outs.map((b, i) => (
                  <td key={i} className={b ? 'one' : 'zero'}>
                    {b}
                  </td>
                ))}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

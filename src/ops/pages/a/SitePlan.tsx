import React from "react";
import { AISLES, BUILDINGS, FACILITY, UNITS, type Unit, type UnitStatus } from "../../../data/facility";
import { STATUS_COLORS } from "../../../three/FacilityScene";

// The 2D site plan, drawn straight from BUILDINGS and UNITS (1 unit = 1 ft, north up).

const fill = (s: UnitStatus) => (s === "occupied" ? "var(--pa-occ)" : STATUS_COLORS[s]);

export function SitePlan({ floor, selected, match, onSelect, onHover }: { floor: 1 | 2; selected: string | null; match: (u: Unit) => boolean; onSelect: (id: string | null) => void; onHover: (id: string | null, x: number, y: number) => void }) {
  const b = FACILITY.bounds;
  const pad = 14;
  const vb = `${b.x - pad} ${b.z - pad} ${b.w + pad * 2} ${b.d + pad * 2 + 22}`;
  const units = UNITS.filter(u => u.kind !== "climate" || u.floor === floor);
  const hover = (e: React.MouseEvent, id: string | null) => {
    const host = (e.currentTarget as SVGElement).ownerSVGElement?.parentElement ?? (e.currentTarget as SVGElement).parentElement;
    const r = host!.getBoundingClientRect();
    onHover(id, e.clientX - r.left, e.clientY - r.top);
  };
  const lane = "pa-plan-lane";
  return (
    <svg className="pa-plan" viewBox={vb} preserveAspectRatio="xMidYMid meet" role="img" aria-label="Site plan" onClick={() => onSelect(null)}>
      <rect x={b.x} y={b.z} width={b.w} height={b.d} className="pa-plan-yard" rx={3} />
      {/* drive lanes */}
      <line x1={FACILITY.gate.x} y1={b.z + b.d + 10} x2={FACILITY.gate.x} y2={AISLES.southZ} className={lane} />
      <line x1={FACILITY.gate.x - 8} y1={AISLES.southZ} x2={AISLES.eastX} y2={AISLES.southZ} className={lane} />
      <line x1={AISLES.spineX} y1={AISLES.northZ} x2={AISLES.spineX} y2={AISLES.southZ} className={lane} />
      <line x1={AISLES.eastX} y1={AISLES.northZ} x2={AISLES.eastX} y2={AISLES.southZ} className={lane} />
      {[AISLES.abZ, AISLES.bcZ, AISLES.northZ].map(z => (
        <line key={z} x1={AISLES.spineX} y1={z} x2={AISLES.eastX} y2={z} className={lane} />
      ))}
      <rect x={b.x} y={b.z} width={b.w} height={b.d} className="pa-plan-fence" rx={3} />

      {BUILDINGS.map(bd => (
        <g key={bd.id}>
          <rect x={bd.x} y={bd.z} width={bd.w} height={bd.d} className={bd.kind === "parking" ? "pa-plan-pk" : "pa-plan-bldg"} rx={1} />
        </g>
      ))}

      {units.map(u => {
        const on = match(u);
        return (
          <rect
            key={u.id}
            x={u.x + 0.45}
            y={u.z + 0.45}
            width={u.w - 0.9}
            height={u.d - 0.9}
            rx={0.8}
            fill={fill(u.status)}
            className={`pa-plan-u ${on ? "" : "pa-plan-u--dim"} ${selected === u.id ? "pa-plan-u--sel" : ""}`}
            onMouseMove={e => hover(e, u.id)}
            onMouseLeave={e => hover(e, null)}
            onClick={e => {
              e.stopPropagation();
              onSelect(u.id);
            }}
          />
        );
      })}

      {/* building D corridor + core */}
      {(() => {
        const d = BUILDINGS.find(x => x.id === "D")!;
        return (
          <>
            <rect x={d.x + 14} y={d.z + d.d / 2 - 4} width={d.w - 18} height={8} className="pa-plan-corr" />
            <rect x={d.x + 2} y={d.z + d.d / 2 - 10} width={10} height={20} className="pa-plan-core" rx={1} />
          </>
        );
      })()}

      {BUILDINGS.filter(bd => bd.kind !== "office").map(bd => {
        const above = bd.id === "P";
        return (
          <text key={bd.id} x={bd.x + (bd.id === "D" ? 0 : 0)} y={above ? bd.z - 5 : bd.id === "A" ? bd.z + bd.d + 8.5 : bd.z - 4} className="pa-plan-label">
            {bd.id === "D" ? `D · CLIMATE · FLOOR ${floor}` : bd.id === "P" ? "RV & BOAT" : `BUILDING ${bd.id}`}
          </text>
        );
      })}
      <text x={FACILITY.office.x} y={FACILITY.office.z - 5} className="pa-plan-label">
        OFFICE
      </text>

      {/* gates */}
      <g transform={`translate(${FACILITY.gate.x} ${b.z + b.d})`}>
        <rect x={-12} y={-2} width={24} height={4} className="pa-plan-gate" rx={1} />
        <text x={16} y={3.5} className="pa-plan-label pa-plan-label--ink">
          GATE 1 · GATE 2
        </text>
      </g>
      <g transform={`translate(${AISLES.eastX - 30} ${b.z})`}>
        <rect x={-10} y={-2} width={20} height={4} className="pa-plan-gate" rx={1} />
        <text x={-14} y={3.5} textAnchor="end" className="pa-plan-label pa-plan-label--ink">
          RV GATE
        </text>
      </g>
      <text x={b.x + b.w} y={b.z + b.d + 24} textAnchor="end" className="pa-plan-label">
        SHORELINE DRIVE
      </text>
      <g transform={`translate(${b.x + 4} ${b.z + b.d + 20})`} className="pa-plan-scale">
        <line x1={0} x2={50} y1={0} y2={0} />
        <line x1={0} x2={0} y1={-3} y2={3} />
        <line x1={50} x2={50} y1={-3} y2={3} />
        <text x={56} y={3.5} className="pa-plan-label">
          50 FT
        </text>
      </g>
    </svg>
  );
}

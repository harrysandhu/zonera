import React, { useEffect, useRef } from "react";
import * as THREE from "three";
import { FacilityScene, type Mode, type View } from "./FacilityScene";
import type { UnitStatus } from "../data/facility";

export interface SceneLabel {
  key: string;
  unitId?: string;
  at?: "car" | { x: number; y: number; z: number };
  lift?: number;
  className?: string;
  children: React.ReactNode;
}

interface Props {
  mode: Mode;
  className?: string;
  interactive?: boolean;
  diorama?: boolean;
  view?: Partial<View>;
  idleSpin?: boolean;
  selected?: string | null;
  fly?: boolean;
  zoom?: number;
  pulse?: string[];
  route?: string | null;
  follow?: boolean;
  statuses?: Partial<Record<string, UnitStatus>>;
  extrudeKey?: number;
  flyTo?: Partial<View> & { key: number };
  labels?: SceneLabel[];
  onSelect?: (id: string | null) => void;
  onHover?: (id: string | null, x: number, y: number) => void;
  onRoute?: (p: { phase: "overview" | "drive" | "arrive"; t: number; leg: number }) => void;
  onReady?: (scene: FacilityScene) => void;
}

export function FacilityView(p: Props) {
  const host = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<FacilityScene | null>(null);
  const cb = useRef(p);
  cb.current = p;

  useEffect(() => {
    const s = new FacilityScene(host.current!, {
      mode: p.mode,
      interactive: p.interactive,
      diorama: p.diorama,
      view: p.view,
      idleSpin: p.idleSpin,
      onSelect: id => cb.current.onSelect?.(id),
      onHover: (id, x, y) => cb.current.onHover?.(id, x, y),
    });
    s.onRouteProgress = e => cb.current.onRoute?.(e);
    sceneRef.current = s;
    p.onReady?.(s);
    return () => {
      s.dispose();
      sceneRef.current = null;
    };
    // The scene is rebuilt only when the look changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.mode]);

  useEffect(() => {
    sceneRef.current?.setPulse(p.pulse ?? []);
  }, [p.pulse?.join(","), p.mode]);

  useEffect(() => {
    const s = sceneRef.current;
    if (!s) return;
    if (p.route) {
      s.setFollow(!!p.follow);
      s.setRoute(p.route);
    } else {
      s.setRoute(null);
      s.select(p.selected ?? null, { fly: p.fly, zoom: p.zoom });
    }
  }, [p.selected, p.route, p.follow, p.mode]);

  useEffect(() => {
    if (p.statuses) sceneRef.current?.setStatusColors(p.statuses);
  }, [JSON.stringify(p.statuses ?? null), p.mode]);

  useEffect(() => {
    if (p.extrudeKey) sceneRef.current?.playExtrude();
  }, [p.extrudeKey, p.mode]);

  useEffect(() => {
    if (p.flyTo) {
      const { key, ...v } = p.flyTo;
      sceneRef.current?.flyTo(v);
    }
  }, [p.flyTo?.key, p.mode]);

  return (
    <div className={"fx-view " + (p.className ?? "")} ref={host}>
      {p.labels?.map(l => <TrackedLabel key={l.key} scene={sceneRef} label={l} mode={p.mode} />)}
    </div>
  );
}

function TrackedLabel({ scene, label, mode }: { scene: React.MutableRefObject<FacilityScene | null>; label: SceneLabel; mode: Mode }) {
  const el = useRef<HTMLDivElement>(null);
  const lab = useRef(label);
  lab.current = label;
  useEffect(() => {
    let off: (() => void) | undefined;
    let raf = 0;
    const attach = () => {
      const s = scene.current;
      if (!s || !el.current) {
        raf = requestAnimationFrame(attach);
        return;
      }
      off = s.track(el.current, () => {
        const l = lab.current;
        if (l.at === "car") return s.carPosition();
        if (l.at) return new THREE.Vector3(l.at.x, l.at.y, l.at.z);
        if (l.unitId) return s.unitAnchor(l.unitId, l.lift ?? 0);
        return null;
      });
    };
    attach();
    return () => {
      cancelAnimationFrame(raf);
      off?.();
    };
  }, [mode]);
  return (
    <div className={"fx-label " + (label.className ?? "")} ref={el} style={{ opacity: 0 }}>
      <div className="fx-label-inner">{label.children}</div>
    </div>
  );
}

import * as THREE from "three";
import { AISLES, BUILDINGS, FACILITY, UNITS, UNIT_BY_ID, routeTo, type Unit, type UnitStatus } from "../data/facility";

// One renderer, four looks:
//  store — the painted diorama on the storefront: cream walls, slate roofs, apricot doors.
//  ops   — the operator's digital twin: doors coloured by unit status.
//  hud   — the "how to get to your unit" film: dark glass, cyan edges, a car on a route.
//  twin  — ops colours on a blueprint ground, used when the twin is built from a site plan.

export type Mode = "store" | "ops" | "hud" | "twin";

export interface View { x: number; z: number; zoom: number; az: number; el: number }

export interface FacilitySceneOptions {
  mode: Mode;
  interactive?: boolean;
  diorama?: boolean;
  view?: Partial<View>;
  idleSpin?: boolean;
  onHover?: (id: string | null, clientX: number, clientY: number) => void;
  onSelect?: (id: string | null) => void;
}

export const STATUS_COLORS: Record<UnitStatus, string> = {
  occupied: "#c7ccc6",
  vacant: "#22a35a",
  reserved: "#3b7cff",
  delinquent: "#e2a12f",
  overlocked: "#e5484d",
  maintenance: "#8b7ae6",
};

// Clay palettes: white massing, soft grey ground, one blue accent.
const P = {
  store: { wall: "#ffffff", wallSide: "#eff1ee", roof: "#e1e4e0", door: "#d6dad5", doorDim: "#e3e6e2", ground: "#e9ece7", asphalt: "#eef0ec", grass: "#e3e8e0", grassDark: "#d2d9ce", slabSide: "#d8ddd5", earth: "#ccd1c9", water: "#d4e0f2", line: "#1d1f1d", pine: "#bccbbd", leaf: "#c9d5c5", accent: "#0358f7", glass: "#cdd9ec" },
  ops: { wall: "#ffffff", wallSide: "#eff1ee", roof: "#dfe2de", door: "#c7ccc6", doorDim: "#c7ccc6", ground: "#e9ece7", asphalt: "#eef0ec", grass: "#e3e8e0", grassDark: "#d2d9ce", slabSide: "#d8ddd5", earth: "#ccd1c9", water: "#d4e0f2", line: "#1d1f1d", pine: "#bccbbd", leaf: "#c9d5c5", accent: "#0358f7", glass: "#cdd9ec" },
  hud: { wall: "#0b1424", wallSide: "#08101d", roof: "#0d1a2e", door: "#14284a", doorDim: "#10213d", ground: "#04070c", asphalt: "#060c16", grass: "#05090f", grassDark: "#05090f", slabSide: "#03060b", earth: "#03060b", water: "#071a33", line: "#6aa1ff", pine: "#0c1a2e", leaf: "#0c1a2e", accent: "#8fb6ff", glass: "#1a3561" },
};

type Pal = (typeof P)["store"];

function easeInOut(t: number) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function doorTexture() {
  const c = document.createElement("canvas");
  c.width = 64;
  c.height = 128;
  const g = c.getContext("2d")!;
  g.fillStyle = "#ffffff";
  g.fillRect(0, 0, 64, 128);
  for (let y = 0; y < 128; y += 8) {
    g.fillStyle = "rgba(0,0,0,0.07)";
    g.fillRect(0, y, 64, 2);
    g.fillStyle = "rgba(255,255,255,0.5)";
    g.fillRect(0, y + 2, 64, 1);
  }
  g.fillStyle = "rgba(0,0,0,0.14)";
  g.fillRect(0, 120, 64, 8);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const beamVert = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`;
const beamFrag = `uniform vec3 uColor; uniform float uTime; uniform float uOpacity; varying vec2 vUv;
void main(){ float a = pow(1.0 - vUv.y, 1.6) * uOpacity; a *= 0.75 + 0.25 * sin(uTime * 3.0 + vUv.y * 12.0); gl_FragColor = vec4(uColor, a); }`;

const routeFrag = `uniform vec3 uColor; uniform float uTime; uniform float uReveal; uniform float uLen; varying vec2 vUv;
void main(){
  float along = vUv.x * uLen;
  if (vUv.x > uReveal) discard;
  float dash = step(0.45, fract(along / 14.0 - uTime * 1.6));
  float edge = 1.0 - abs(vUv.y - 0.5) * 2.0;
  float a = (0.35 + 0.65 * dash) * smoothstep(0.0, 0.35, edge);
  gl_FragColor = vec4(uColor, a);
}`;

interface Tracked { el: HTMLElement; pos: () => THREE.Vector3 | null }

export class FacilityScene {
  readonly container: HTMLElement;
  mode: Mode;
  private opts: FacilitySceneOptions;
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private cam: THREE.OrthographicCamera;
  private root = new THREE.Group();
  private buildingGroups: { group: THREE.Group; delay: number }[] = [];
  private wallMats: THREE.MeshLambertMaterial[] = [];
  private wallMatSide!: THREE.MeshLambertMaterial;
  private roofMat!: THREE.MeshLambertMaterial;
  private edgeMat!: THREE.LineBasicMaterial;
  private doorMesh!: THREE.InstancedMesh;
  private doorUnits: Unit[] = [];
  private doorIndex = new Map<string, number>();
  private doorBase: THREE.Color[] = [];
  private interiorMesh!: THREE.InstancedMesh;
  private interiorUnits: Unit[] = [];
  private interiorIndex = new Map<string, number>();
  private dShell: THREE.Mesh[] = [];
  private dFloors: THREE.Mesh[] = [];
  private xray = false;
  private pal: Pal;
  private materials: Record<string, THREE.MeshLambertMaterial> = {};
  private highlight = new THREE.Group();
  private beam!: THREE.Mesh;
  private beamMat!: THREE.ShaderMaterial;
  private ring!: THREE.Mesh;
  private outline!: THREE.LineSegments;
  private outlineFill!: THREE.Mesh;
  private pulse = new Set<number>();
  private pulseColor = new THREE.Color();
  private routeGroup = new THREE.Group();
  private routeMat?: THREE.ShaderMaterial;
  private routeCurve?: { pts: THREE.Vector3[]; lens: number[]; total: number };
  private car?: THREE.Group;
  private routePhase = 0;
  private routeClock = 0;
  private gateRing?: THREE.Mesh;
  private grid?: THREE.GridHelper;
  private water?: THREE.Mesh;
  private tracked: Tracked[] = [];
  private view: View;
  private target: View;
  private raycaster = new THREE.Raycaster();
  private pointer = new THREE.Vector2();
  private hovered: string | null = null;
  private selected: string | null = null;
  private running = false;
  private visible = true;
  private last = performance.now();
  private time = 0;
  private extrude = 1; // 0..1 progress of the "built from the site plan" intro
  private extruding = false;
  private extrudeStart = 0;
  private ro: ResizeObserver;
  private io: IntersectionObserver;
  private drag: { x: number; y: number; az: number; el: number; moved: boolean } | null = null;
  private reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
  private disposed = false;
  private hudFollow = false;
  onFrame?: (t: number) => void;
  onRouteProgress?: (p: { phase: "overview" | "drive" | "arrive"; t: number; leg: number }) => void;

  constructor(container: HTMLElement, opts: FacilitySceneOptions) {
    this.container = container;
    this.opts = opts;
    this.mode = opts.mode;
    this.pal = this.mode === "hud" ? P.hud : this.mode === "store" ? P.store : P.ops;
    const v: View = { x: -10, z: -5, zoom: 1, az: 0.62, el: 0.6, ...(opts.view ?? {}) };
    this.view = { ...v };
    this.target = { ...v };

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.shadowMap.enabled = this.mode !== "hud";
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.setClearColor(0x000000, 0);
    container.appendChild(this.renderer.domElement);
    this.renderer.domElement.style.display = "block";
    this.renderer.domElement.style.width = "100%";
    this.renderer.domElement.style.height = "100%";
    this.renderer.domElement.style.touchAction = opts.interactive ? "none" : "auto";

    this.cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 4000);
    this.scene.add(this.root);
    this.buildLights();
    this.buildGround();
    this.buildBuildings();
    this.buildDoors();
    this.buildInterior();
    this.buildTrees();
    this.buildHighlight();
    this.root.add(this.routeGroup);
    this.applyMode();

    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(container);
    this.io = new IntersectionObserver(entries => {
      this.visible = entries[0]?.isIntersecting ?? true;
      if (this.visible) this.start();
    });
    this.io.observe(container);
    this.resize();
    if (opts.interactive) this.bindPointer();
    document.addEventListener("visibilitychange", this.onVis);
    this.start();
  }

  // ---------------------------------------------------------------- build

  private mat(key: string, color: string, extra: THREE.MeshLambertMaterialParameters = {}) {
    const m = new THREE.MeshLambertMaterial({ color, ...extra });
    this.materials[key] = m;
    return m;
  }

  private buildLights() {
    const hemi = new THREE.HemisphereLight(0xffffff, 0xd9ddd6, this.mode === "hud" ? 1.2 : 1.9);
    this.scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xffffff, this.mode === "hud" ? 1.0 : 2.1);
    sun.position.set(-300, 380, 240);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    const s = sun.shadow.camera as THREE.OrthographicCamera;
    s.left = -300; s.right = 300; s.top = 300; s.bottom = -300; s.near = 10; s.far = 1200;
    sun.shadow.bias = -0.0006;
    sun.shadow.normalBias = 0.6;
    sun.shadow.radius = 4;
    this.scene.add(sun);
    this.scene.add(sun.target);
  }

  private buildGround() {
    const pal = this.pal;
    const b = FACILITY.bounds;
    const slab = { x0: b.x - 40, x1: b.x + b.w + 40, z0: b.z - 70, z1: b.z + b.d + 46 };
    const sw = slab.x1 - slab.x0;
    const sd = slab.z1 - slab.z0;
    const cx = (slab.x0 + slab.x1) / 2;
    const cz = (slab.z0 + slab.z1) / 2;

    if (this.opts.diorama !== false && this.mode !== "hud") {
      // The diorama slab: meadow on top, earth on the sides.
      const sideMat = this.mat("slabSide", pal.slabSide);
      const topMat = this.mat("grass", pal.grass);
      const lakeD = 46;
      const slabGeo = new THREE.BoxGeometry(sw, 14, sd - lakeD);
      const slabMesh = new THREE.Mesh(slabGeo, [sideMat, sideMat, topMat, sideMat, sideMat, sideMat]);
      slabMesh.position.set(cx, -7.01, cz + lakeD / 2);
      slabMesh.receiveShadow = true;
      this.root.add(slabMesh);
      const earth = new THREE.Mesh(new THREE.BoxGeometry(sw - 0.5, 10, sd - 0.5), this.mat("earth", pal.earth));
      earth.position.set(cx, -19, cz);
      const lakebed = new THREE.Mesh(new THREE.BoxGeometry(sw, 6, lakeD), sideMat);
      lakebed.position.set(cx, -11, slab.z0 + lakeD / 2);
      this.root.add(lakebed);
      this.root.add(earth);
      // A strip of lake along the north edge, the way the painting has it.
      const water = new THREE.Mesh(new THREE.BoxGeometry(sw, 6, lakeD), this.mat("water", pal.water, { transparent: true, opacity: 0.92 }));
      water.position.set(cx, -5, slab.z0 + lakeD / 2);
      this.water = water;
      this.root.add(water);
      // Shoreline sand
      const sand = new THREE.Mesh(new THREE.BoxGeometry(sw, 0.6, 8), this.mat("sand", "#e6e8e3"));
      sand.position.set(cx, 0.02, slab.z0 + lakeD + 4);
      sand.receiveShadow = true;
      this.root.add(sand);
    } else {
      const g = new THREE.Mesh(new THREE.PlaneGeometry(sw * 1.6, sd * 1.6), this.mat("grass", pal.grass));
      g.rotation.x = -Math.PI / 2;
      g.position.set(cx, -0.05, cz);
      g.receiveShadow = true;
      this.root.add(g);
    }

    // Paved yard inside the fence.
    const yard = new THREE.Mesh(new THREE.PlaneGeometry(b.w - 16, b.d - 16), this.mat("asphalt", pal.asphalt));
    yard.rotation.x = -Math.PI / 2;
    yard.position.set(b.x + b.w / 2, 0.02, b.z + b.d / 2);
    yard.receiveShadow = true;
    this.root.add(yard);

    // Road along the south edge and the driveway through the gate.
    const road = new THREE.Mesh(new THREE.PlaneGeometry(sw, 22), this.mat("road", this.mode === "hud" ? "#07101e" : "#dfe2dd"));
    road.rotation.x = -Math.PI / 2;
    road.position.set(cx, 0.03, b.z + b.d + 24);
    road.receiveShadow = true;
    this.root.add(road);
    const drive = new THREE.Mesh(new THREE.PlaneGeometry(26, 20), this.materials["asphalt"]);
    drive.rotation.x = -Math.PI / 2;
    drive.position.set(FACILITY.gate.x, 0.025, b.z + b.d + 6);
    this.root.add(drive);

    // Lane markings — dashed centre lines on the aisles.
    const dashMat = new THREE.MeshBasicMaterial({ color: this.mode === "hud" ? 0x1d3a66 : 0xc9cec7, transparent: true, opacity: this.mode === "hud" ? 0.7 : 0.9 });
    this.materials["dash"] = dashMat as unknown as THREE.MeshLambertMaterial;
    const dash = new THREE.PlaneGeometry(6, 0.8);
    const lanes: [number, number, number, number][] = [
      [AISLES.spineX, AISLES.southZ, 168, AISLES.southZ],
      [AISLES.spineX, AISLES.abZ, 168, AISLES.abZ],
      [AISLES.spineX, AISLES.bcZ, 168, AISLES.bcZ],
      [AISLES.spineX, AISLES.northZ, 168, AISLES.northZ],
      [AISLES.spineX, AISLES.northZ, AISLES.spineX, AISLES.southZ],
      [FACILITY.gate.x, AISLES.southZ, AISLES.spineX, AISLES.southZ],
    ];
    const dashes = new THREE.InstancedMesh(dash, dashMat, 400);
    let n = 0;
    const m4 = new THREE.Matrix4();
    for (const [x0, z0, x1, z1] of lanes) {
      const len = Math.hypot(x1 - x0, z1 - z0);
      const ang = Math.atan2(z1 - z0, x1 - x0);
      for (let d = 6; d < len - 4 && n < 400; d += 14) {
        const x = x0 + Math.cos(ang) * d;
        const z = z0 + Math.sin(ang) * d;
        m4.makeRotationY(-ang).premultiply(new THREE.Matrix4().makeTranslation(x, 0.06, z));
        const r = new THREE.Matrix4().makeRotationX(-Math.PI / 2);
        dashes.setMatrixAt(n++, m4.clone().multiply(r));
      }
    }
    dashes.count = n;
    this.root.add(dashes);

    // RV & boat space stripes.
    const pb = BUILDINGS.find(x => x.id === "P")!;
    const stripe = new THREE.PlaneGeometry(0.8, pb.d);
    for (let i = 0; i <= 7; i++) {
      const s = new THREE.Mesh(stripe, dashMat);
      s.rotation.x = -Math.PI / 2;
      s.position.set(pb.x + i * 12, 0.06, pb.z + pb.d / 2);
      this.root.add(s);
    }

    // Fence: thin dark rails on posts, open at the gate.
    const fenceMat = this.mat("fence", this.mode === "hud" ? "#1d3a66" : "#a7ada6");
    const rail = (x0: number, z0: number, x1: number, z1: number) => {
      const len = Math.hypot(x1 - x0, z1 - z0);
      const m = new THREE.Mesh(new THREE.BoxGeometry(len, 0.5, 0.5), fenceMat);
      m.position.set((x0 + x1) / 2, 6, (z0 + z1) / 2);
      m.rotation.y = -Math.atan2(z1 - z0, x1 - x0);
      this.root.add(m);
      const posts = Math.floor(len / 12);
      for (let i = 0; i <= posts; i++) {
        const t = i / posts;
        const p = new THREE.Mesh(new THREE.BoxGeometry(0.6, 6, 0.6), fenceMat);
        p.position.set(x0 + (x1 - x0) * t, 3, z0 + (z1 - z0) * t);
        this.root.add(p);
      }
    };
    const x0 = b.x, x1 = b.x + b.w, z0 = b.z, z1 = b.z + b.d;
    rail(x0, z0, x1, z0);
    rail(x1, z0, x1, z1);
    rail(x0, z0, x0, z1);
    rail(x0, z1, FACILITY.gate.x - 14, z1);
    rail(FACILITY.gate.x + 14, z1, x1, z1);
    // Gate arm + keypad post
    const arm = new THREE.Mesh(new THREE.BoxGeometry(24, 0.9, 0.9), this.mat("arm", this.mode === "hud" ? "#8fb6ff" : "#1d1f1d"));
    arm.position.set(FACILITY.gate.x - 1, 4.2, z1);
    this.root.add(arm);
    const keypad = new THREE.Mesh(new THREE.BoxGeometry(1.6, 5, 1.6), fenceMat);
    keypad.position.set(FACILITY.gate.x - 16, 2.5, z1 + 8);
    this.root.add(keypad);

    // Landscaped strip between the fence and the yard edge.
    if (this.mode !== "hud") {
      const hedgeMat = this.mat("hedge", pal.grassDark);
      const hedge = (x: number, z: number, w: number, d: number) => {
        const h = new THREE.Mesh(new THREE.BoxGeometry(w, 3.2, d), hedgeMat);
        h.position.set(x, 1.6, z);
        h.castShadow = true;
        h.receiveShadow = true;
        this.root.add(h);
      };
      hedge(b.x + b.w / 2 + 40, z1 + 4, b.w - 120, 3.5);
      hedge(x0 - 4, b.z + b.d / 2, 3.5, b.d - 30);
      hedge(x1 + 4, b.z + b.d / 2, 3.5, b.d - 30);
    }

    if (this.mode === "hud" || this.mode === "twin") {
      const grid = new THREE.GridHelper(900, 90, this.mode === "hud" ? 0x24447a : 0xb9c0b8, this.mode === "hud" ? 0x0f2240 : 0xd5dad4);
      (grid.material as THREE.Material).transparent = true;
      (grid.material as THREE.Material).opacity = this.mode === "hud" ? 0.35 : 0.25;
      grid.position.set(0, this.mode === "hud" ? -0.2 : 0.01, 0);
      this.grid = grid;
      this.root.add(grid);
    }
  }

  private gableRoof(w: number, d: number, rise: number, overhang = 1.6) {
    // Shallow gable whose ridge runs along x.
    const shape = new THREE.Shape();
    const hd = d / 2 + overhang;
    shape.moveTo(-hd, 0);
    shape.lineTo(hd, 0);
    shape.lineTo(hd, 0.8);
    shape.lineTo(0, rise + 0.8);
    shape.lineTo(-hd, 0.8);
    shape.closePath();
    const geo = new THREE.ExtrudeGeometry(shape, { depth: w + overhang * 2, bevelEnabled: false });
    geo.translate(0, 0, -(w + overhang * 2) / 2);
    geo.rotateY(Math.PI / 2);
    return geo;
  }

  private buildBuildings() {
    const pal = this.pal;
    const wallMat = this.mat("wall", pal.wall);
    this.wallMats.push(wallMat);
    this.wallMatSide = this.mat("wallSide", pal.wallSide);
    this.roofMat = this.mat("roof", pal.roof);
    this.edgeMat = new THREE.LineBasicMaterial({ color: pal.line, transparent: true, opacity: this.mode === "hud" ? 0.7 : 0.13 });
    const trimMat = this.mat("trim", this.mode === "hud" ? "#132a4d" : "#d9ddd7");
    const glassMat = this.mat("glass", pal.glass);

    let idx = 0;
    for (const b of BUILDINGS) {
      if (b.kind === "parking") continue;
      const g = new THREE.Group();
      g.position.set(b.x + b.w / 2, 0, b.z + b.d / 2);
      const H = b.h * b.floors;
      const box = new THREE.BoxGeometry(b.w, H, b.d);
      const isD = b.kind === "climate";
      const wall = new THREE.Mesh(box, isD ? this.mat("wallD", pal.wall) : [this.wallMatSide, this.wallMatSide, wallMat, wallMat, wallMat, wallMat]);
      wall.position.y = H / 2;
      wall.castShadow = true;
      wall.receiveShadow = true;
      g.add(wall);
      const edges = new THREE.LineSegments(new THREE.EdgesGeometry(box), this.edgeMat);
      edges.position.y = H / 2;
      g.add(edges);
      if (isD) this.dShell.push(wall);

      if (b.kind === "drive-up") {
        const roof = new THREE.Mesh(this.gableRoof(b.w, b.d, Math.min(4, b.d * 0.12)), this.roofMat);
        roof.position.y = H;
        roof.castShadow = true;
        roof.receiveShadow = true;
        g.add(roof);
        const re = new THREE.LineSegments(new THREE.EdgesGeometry(roof.geometry, 30), this.edgeMat);
        re.position.y = H;
        g.add(re);
        // Fascia trim along both long faces
        for (const s of [-1, 1]) {
          const t = new THREE.Mesh(new THREE.BoxGeometry(b.w, 1, 0.6), trimMat);
          t.position.set(0, H - 0.5, s * (b.d / 2 + 0.3));
          g.add(t);
        }
      } else if (isD) {
        // Flat roof with a parapet, rooftop units, window bands per floor, entrance canopy.
        const roof = new THREE.Mesh(new THREE.BoxGeometry(b.w + 1, 1.4, b.d + 1), this.roofMat);
        roof.position.y = H + 0.7;
        roof.castShadow = true;
        g.add(roof);
        this.dShell.push(roof);
        for (let i = 0; i < 3; i++) {
          const hv = new THREE.Mesh(new THREE.BoxGeometry(8, 3.5, 6), trimMat);
          hv.position.set(-24 + i * 18, H + 3, 8);
          hv.castShadow = true;
          g.add(hv);
          this.dShell.push(hv);
        }
        for (let f = 0; f < b.floors; f++) {
          for (const [axis, len, off] of [["x", b.w, b.d / 2], ["x", b.w, -b.d / 2], ["z", b.d, b.w / 2], ["z", b.d, -b.w / 2]] as const) {
            const band = new THREE.Mesh(new THREE.BoxGeometry(axis === "x" ? len - 10 : 0.4, 3.2, axis === "x" ? 0.4 : len - 10), glassMat);
            band.position.set(axis === "z" ? off * 1.002 : 0, f * b.h + 6.5, axis === "x" ? off * 1.002 : 0);
            g.add(band);
            this.dShell.push(band);
          }
        }
        const canopy = new THREE.Mesh(new THREE.BoxGeometry(6, 0.8, 18), this.mat("canopy", this.mode === "hud" ? "#132a4d" : "#1d1f1d"));
        canopy.position.set(b.w / 2 + 3, 10, 36 - b.d / 2 - 4);
        canopy.castShadow = true;
        g.add(canopy);
        this.dShell.push(canopy);
        // Floor slabs (visible in x-ray)
        for (let f = 0; f < b.floors; f++) {
          const slab = new THREE.Mesh(new THREE.BoxGeometry(b.w - 1, 0.6, b.d - 1), this.mat("dfloor" + f, this.mode === "hud" ? "#0f2240" : "#e4e7e3", { transparent: true, opacity: 0.85 }));
          slab.position.y = f * b.h + 0.3;
          slab.visible = false;
          g.add(slab);
          this.dFloors.push(slab);
        }
      } else if (b.kind === "office") {
        const roof = new THREE.Mesh(new THREE.BoxGeometry(b.w + 2, 1.2, b.d + 2), this.roofMat);
        roof.position.y = H + 0.6;
        roof.castShadow = true;
        g.add(roof);
        const front = new THREE.Mesh(new THREE.BoxGeometry(b.w - 6, 7, 0.4), glassMat);
        front.position.set(0, 4.5, b.d / 2 + 0.2);
        g.add(front);
        const sign = new THREE.Mesh(new THREE.BoxGeometry(14, 2.4, 0.6), this.mat("sign", this.mode === "hud" ? "#8fb6ff" : "#1d1f1d"));
        sign.position.set(0, H - 1.6, b.d / 2 + 0.5);
        g.add(sign);
      }
      this.root.add(g);
      this.buildingGroups.push({ group: g, delay: idx++ * 0.12 });
    }
  }

  private buildDoors() {
    const tex = doorTexture();
    const mat = new THREE.MeshLambertMaterial({ map: tex, color: 0xffffff });
    this.doorUnits = UNITS.filter(u => u.kind === "drive-up");
    const geo = new THREE.BoxGeometry(1, 1, 1);
    const mesh = new THREE.InstancedMesh(geo, mat, this.doorUnits.length);
    const m4 = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    this.doorUnits.forEach((u, i) => {
      const b = BUILDINGS.find(b => b.id === u.building)!;
      const h = Math.min(8.5, b.h - 2.2);
      const w = u.w - 1.6;
      const faceZ = u.facing === "south" ? b.z + b.d + 0.18 : b.z - 0.18;
      m4.compose(new THREE.Vector3(u.x + u.w / 2, h / 2 + 0.05, faceZ), q, new THREE.Vector3(w, h, 0.36));
      mesh.setMatrixAt(i, m4);
      this.doorIndex.set(u.id, i);
      this.doorBase.push(new THREE.Color(this.pal.door));
      mesh.setColorAt(i, new THREE.Color(this.pal.door));
    });
    mesh.castShadow = false;
    mesh.receiveShadow = true;
    this.doorMesh = mesh;
    this.root.add(mesh);

    // Divider pilasters between drive-up units
    const pil = new THREE.InstancedMesh(new THREE.BoxGeometry(0.7, 1, 0.5), this.materials["trim"], this.doorUnits.length);
    this.doorUnits.forEach((u, i) => {
      const b = BUILDINGS.find(b => b.id === u.building)!;
      const faceZ = u.facing === "south" ? b.z + b.d + 0.25 : b.z - 0.25;
      m4.compose(new THREE.Vector3(u.x, (b.h - 1) / 2, faceZ), q, new THREE.Vector3(0.7, b.h - 1, 0.5));
      pil.setMatrixAt(i, m4);
    });
    this.root.add(pil);

    // Parking spaces: a few boats and RVs parked in the occupied ones.
    const pk = UNITS.filter(u => u.kind === "parking");
    const hull = this.mat("hull", this.mode === "hud" ? "#14284a" : "#ffffff");
    const rv = this.mat("rv", this.mode === "hud" ? "#14284a" : "#f1f2ef");
    pk.forEach((u, i) => {
      if (u.status === "vacant") return;
      const isBoat = i % 2 === 0;
      const m = new THREE.Mesh(new THREE.BoxGeometry(8, isBoat ? 5 : 10, isBoat ? 26 : 32), isBoat ? hull : rv);
      m.position.set(u.x + 6, isBoat ? 3.5 : 5, u.z + u.d / 2 + 2);
      m.castShadow = true;
      this.root.add(m);
    });
  }

  private buildInterior() {
    this.interiorUnits = UNITS.filter(u => u.kind === "climate");
    const b = BUILDINGS.find(b => b.id === "D")!;
    const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.95 }), this.interiorUnits.length);
    const m4 = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    this.interiorUnits.forEach((u, i) => {
      const y = (u.floor - 1) * b.h + 0.6;
      const h = b.h - 2.4;
      m4.compose(new THREE.Vector3(u.x + u.w / 2, y + h / 2, u.z + u.d / 2), q, new THREE.Vector3(u.w - 0.7, h, u.d - 0.7));
      mesh.setMatrixAt(i, m4);
      mesh.setColorAt(i, new THREE.Color(STATUS_COLORS[u.status]));
      this.interiorIndex.set(u.id, i);
    });
    mesh.visible = false;
    this.interiorMesh = mesh;
    this.root.add(mesh);
  }

  private buildTrees() {
    if (this.mode === "hud") return;
    const r = rng(11);
    const b = FACILITY.bounds;
    const spots: { x: number; z: number; s: number; kind: number }[] = [];
    const slab = { x0: b.x - 36, x1: b.x + b.w + 36, z0: b.z - 18, z1: b.z + b.d + 40 };
    const inYard = (x: number, z: number) => x > b.x - 8 && x < b.x + b.w + 8 && z > b.z - 8 && z < b.z + b.d + 8;
    const onRoad = (z: number) => z > b.z + b.d + 10 && z < b.z + b.d + 38;
    for (let i = 0; i < 260 && spots.length < 120; i++) {
      const x = slab.x0 + r() * (slab.x1 - slab.x0);
      const z = slab.z0 + r() * (slab.z1 - slab.z0);
      if (inYard(x, z) || onRoad(z)) continue;
      if (Math.abs(x - FACILITY.gate.x) < 24 && z > b.z + b.d - 4) continue;
      spots.push({ x, z, s: 0.7 + r() * 0.7, kind: r() < 0.62 ? 0 : 1 });
    }
    // A few trees inside the yard by the office.
    spots.push({ x: -186, z: 132, s: 0.8, kind: 1 }, { x: -168, z: 134, s: 0.7, kind: 0 });

    const coneGeo = new THREE.ConeGeometry(6, 16, 7);
    const coneGeo2 = new THREE.ConeGeometry(4.6, 12, 7);
    const ballGeo = new THREE.IcosahedronGeometry(7, 0);
    const trunkGeo = new THREE.CylinderGeometry(0.8, 1, 5, 5);
    const pineMat = this.mat("pine", this.pal.pine, { flatShading: true });
    const leafMat = this.mat("leaf", this.pal.leaf, { flatShading: true });
    const trunkMat = this.mat("trunk", "#b9b2a6");
    const pines = spots.filter(s => s.kind === 0);
    const leaves = spots.filter(s => s.kind === 1);
    const c1 = new THREE.InstancedMesh(coneGeo, pineMat, pines.length);
    const c2 = new THREE.InstancedMesh(coneGeo2, pineMat, pines.length);
    const lb = new THREE.InstancedMesh(ballGeo, leafMat, leaves.length);
    const tr = new THREE.InstancedMesh(trunkGeo, trunkMat, spots.length);
    const m4 = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    pines.forEach((s, i) => {
      m4.compose(new THREE.Vector3(s.x, 4 + 8 * s.s, s.z), q, new THREE.Vector3(s.s, s.s, s.s));
      c1.setMatrixAt(i, m4);
      m4.compose(new THREE.Vector3(s.x, 4 + 15 * s.s, s.z), q, new THREE.Vector3(s.s, s.s, s.s));
      c2.setMatrixAt(i, m4);
    });
    leaves.forEach((s, i) => {
      m4.compose(new THREE.Vector3(s.x, 4 + 7 * s.s, s.z), q, new THREE.Vector3(s.s, s.s * 0.9, s.s));
      lb.setMatrixAt(i, m4);
    });
    spots.forEach((s, i) => {
      m4.compose(new THREE.Vector3(s.x, 2.5, s.z), q, new THREE.Vector3(s.s, s.s, s.s));
      tr.setMatrixAt(i, m4);
    });
    for (const m of [c1, c2, lb]) {
      m.castShadow = true;
      m.receiveShadow = true;
      this.root.add(m);
    }
    this.root.add(tr);
  }

  private buildHighlight() {
    this.beamMat = new THREE.ShaderMaterial({
      vertexShader: beamVert,
      fragmentShader: beamFrag,
      uniforms: { uColor: { value: new THREE.Color(this.pal.accent) }, uTime: { value: 0 }, uOpacity: { value: this.mode === "hud" ? 0.75 : 0.5 } },
      transparent: true,
      depthWrite: false,
      blending: this.mode === "hud" ? THREE.AdditiveBlending : THREE.NormalBlending,
      side: THREE.DoubleSide,
    });
    this.beam = new THREE.Mesh(new THREE.CylinderGeometry(4, 6, 90, 24, 1, true), this.beamMat);
    this.beam.position.y = 45;
    this.highlight.add(this.beam);
    const ringMat = new THREE.MeshBasicMaterial({ color: this.pal.accent, transparent: true, opacity: 0.7, depthWrite: false, side: THREE.DoubleSide });
    this.ring = new THREE.Mesh(new THREE.RingGeometry(7, 8.4, 48), ringMat);
    this.ring.rotation.x = -Math.PI / 2;
    this.ring.position.y = 0.3;
    this.highlight.add(this.ring);
    this.outline = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1)), new THREE.LineBasicMaterial({ color: this.pal.accent, transparent: true, opacity: 1 }));
    this.outlineFill = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ color: this.pal.accent, transparent: true, opacity: 0.22, depthWrite: false }));
    this.root.add(this.outline, this.outlineFill);
    this.outline.visible = false;
    this.outlineFill.visible = false;
    this.highlight.visible = false;
    this.root.add(this.highlight);
  }

  // ---------------------------------------------------------------- modes & state

  private applyMode() {
    this.setStatusColors();
  }

  setStatusColors(override?: Partial<Record<string, UnitStatus>>) {
    const hud = this.mode === "hud";
    this.doorUnits.forEach((u, i) => {
      const st = override?.[u.id] ?? u.status;
      const c = new THREE.Color(hud ? this.pal.door : this.mode === "store" ? this.pal.door : STATUS_COLORS[st]);
      this.doorBase[i] = c;
      this.doorMesh.setColorAt(i, c);
    });
    this.doorMesh.instanceColor!.needsUpdate = true;
    this.interiorUnits.forEach((u, i) => {
      const st = override?.[u.id] ?? u.status;
      this.interiorMesh.setColorAt(i, new THREE.Color(hud ? "#14284a" : this.mode === "store" ? (st === "vacant" ? "#cddcff" : "#e6e9e5") : STATUS_COLORS[st]));
    });
    this.interiorMesh.instanceColor!.needsUpdate = true;
  }

  setUnitStatus(id: string, st: UnitStatus) {
    const i = this.doorIndex.get(id);
    if (i !== undefined) {
      const c = new THREE.Color(this.mode === "store" ? this.pal.door : STATUS_COLORS[st]);
      this.doorBase[i] = c;
      this.doorMesh.setColorAt(i, c);
      this.doorMesh.instanceColor!.needsUpdate = true;
    }
    const j = this.interiorIndex.get(id);
    if (j !== undefined) {
      this.interiorMesh.setColorAt(j, new THREE.Color(STATUS_COLORS[st]));
      this.interiorMesh.instanceColor!.needsUpdate = true;
    }
  }

  /** Make these units breathe (available units of a size on the storefront). */
  setPulse(ids: string[]) {
    for (const i of this.pulse) this.doorMesh.setColorAt(i, this.doorBase[i]);
    this.pulse.clear();
    for (const id of ids) {
      const i = this.doorIndex.get(id);
      if (i !== undefined) this.pulse.add(i);
    }
    // Dim everything else in store mode so the available ones read.
    if (this.mode === "store") {
      this.doorUnits.forEach((_, i) => {
        const c = new THREE.Color(this.pulse.has(i) ? "#5b8dff" : ids.length ? this.pal.doorDim : this.pal.door);
        this.doorBase[i] = c;
        this.doorMesh.setColorAt(i, c);
      });
    }
    this.doorMesh.instanceColor!.needsUpdate = true;
    const climate = ids.filter(id => UNIT_BY_ID.get(id)?.kind === "climate");
    this.setXray(climate.length > 0 || (this.selected ? UNIT_BY_ID.get(this.selected)?.kind === "climate" : false));
    if (climate.length && this.mode === "store") {
      this.interiorUnits.forEach((u, i) => this.interiorMesh.setColorAt(i, new THREE.Color(ids.includes(u.id) ? "#5b8dff" : "#e6e9e5")));
      this.interiorMesh.instanceColor!.needsUpdate = true;
    }
  }

  setXray(on: boolean) {
    if (this.xray === on) return;
    this.xray = on;
    for (const m of this.dShell) {
      const mat = m.material as THREE.MeshLambertMaterial;
      if (Array.isArray(mat)) continue;
      mat.transparent = on;
      mat.opacity = on ? 0.12 : 1;
      mat.depthWrite = !on;
      mat.needsUpdate = true;
      m.castShadow = !on;
    }
    for (const f of this.dFloors) f.visible = on;
    this.interiorMesh.visible = on;
  }

  select(id: string | null, opts: { fly?: boolean; zoom?: number } = {}) {
    this.selected = id;
    if (!id) {
      this.highlight.visible = false;
      this.outline.visible = false;
      this.outlineFill.visible = false;
      this.setXray(false);
      return;
    }
    const u = UNIT_BY_ID.get(id);
    if (!u) return;
    const b = BUILDINGS.find(b => b.id === u.building)!;
    const isClimate = u.kind === "climate";
    this.setXray(isClimate);
    const y0 = isClimate ? (u.floor - 1) * b.h + 0.6 : 0;
    const h = isClimate ? b.h - 2.2 : u.kind === "parking" ? 1 : b.h + 0.4;
    this.outline.scale.set(u.w + 0.4, h, u.d + 0.4);
    this.outline.position.set(u.x + u.w / 2, y0 + h / 2, u.z + u.d / 2);
    this.outlineFill.scale.copy(this.outline.scale);
    this.outlineFill.position.copy(this.outline.position);
    this.outline.visible = true;
    this.outlineFill.visible = true;
    this.highlight.position.set(u.door.x, isClimate ? y0 : 0, isClimate ? u.z + u.d / 2 : u.door.z);
    this.highlight.visible = true;
    if (opts.fly) {
      const az = u.facing === "south" ? 0.62 : u.facing === "north" ? Math.PI - 0.62 : this.target.az;
      this.flyTo({ x: u.x + u.w / 2, z: u.z + u.d / 2, zoom: opts.zoom ?? 2.6, az: isClimate ? 0.62 : az, el: 0.62 });
    }
  }

  flyTo(v: Partial<View>) {
    Object.assign(this.target, v);
    if (this.reduced) Object.assign(this.view, this.target);
  }

  getView() {
    return { ...this.view };
  }

  /** Buildings rise out of the site plan. */
  playExtrude() {
    this.extrude = 0;
    this.extruding = true;
    this.extrudeStart = this.time;
    if (this.reduced) {
      this.extrude = 1;
      this.extruding = false;
    }
    this.applyExtrude();
  }

  private applyExtrude() {
    const t = (this.time - this.extrudeStart) / 2.6;
    for (const { group, delay } of this.buildingGroups) {
      const k = this.extruding ? easeInOut(Math.min(1, Math.max(0.001, (t - delay) / 0.9))) : 1;
      group.scale.y = Math.max(0.001, k);
    }
    const doorsOn = !this.extruding || t > 1.2;
    this.doorMesh.visible = doorsOn;
    if (this.extruding && t > 2.2) this.extruding = false;
  }

  // ---------------------------------------------------------------- route (hud)

  setRoute(unitId: string | null) {
    this.routeGroup.clear();
    this.car = undefined;
    this.routeCurve = undefined;
    if (!unitId) return;
    const r = routeTo(unitId);
    const pts = r.points.map(p => new THREE.Vector3(p.x, 0.5, p.z));
    const lens = [0];
    for (let i = 1; i < pts.length; i++) lens.push(lens[i - 1] + pts[i].distanceTo(pts[i - 1]));
    const total = lens[lens.length - 1];
    this.routeCurve = { pts, lens, total };

    // Ribbon geometry along the polyline (with rounded joins approximated by small overlaps).
    const width = 5;
    const pos: number[] = [];
    const uv: number[] = [];
    const idx: number[] = [];
    let base = 0;
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1];
      const dir = new THREE.Vector3().subVectors(b, a).normalize();
      const n = new THREE.Vector3(-dir.z, 0, dir.x).multiplyScalar(width / 2);
      const ext = dir.clone().multiplyScalar(width / 2);
      const a0 = a.clone().sub(i === 0 ? new THREE.Vector3() : ext);
      const b0 = b.clone().add(i === pts.length - 2 ? new THREE.Vector3() : ext);
      const u0 = (lens[i] - (i === 0 ? 0 : width / 2)) / total;
      const u1 = (lens[i + 1] + (i === pts.length - 2 ? 0 : width / 2)) / total;
      pos.push(a0.x + n.x, 0.6, a0.z + n.z, a0.x - n.x, 0.6, a0.z - n.z, b0.x + n.x, 0.6, b0.z + n.z, b0.x - n.x, 0.6, b0.z - n.z);
      uv.push(u0, 0, u0, 1, u1, 0, u1, 1);
      idx.push(base, base + 1, base + 2, base + 1, base + 3, base + 2);
      base += 4;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(idx);
    this.routeMat = new THREE.ShaderMaterial({
      vertexShader: beamVert,
      fragmentShader: routeFrag,
      uniforms: { uColor: { value: new THREE.Color(this.mode === "hud" ? "#4d8bff" : "#0358f7") }, uTime: { value: 0 }, uReveal: { value: 0 }, uLen: { value: total } },
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: this.mode === "hud" ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    const ribbon = new THREE.Mesh(geo, this.routeMat);
    this.routeGroup.add(ribbon);

    // Car: a small glowing wedge with headlights.
    const car = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(7, 3.2, 14), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    body.position.y = 2.2;
    car.add(body);
    const cab = new THREE.Mesh(new THREE.BoxGeometry(6.2, 2.4, 7), new THREE.MeshBasicMaterial({ color: this.mode === "hud" ? 0x4d8bff : 0x1d1f1d }));
    cab.position.set(0, 4.6, 1);
    car.add(cab);
    const glow = new THREE.Mesh(new THREE.CircleGeometry(12, 32), new THREE.MeshBasicMaterial({ color: 0x4d8bff, transparent: true, opacity: 0.22, depthWrite: false }));
    glow.rotation.x = -Math.PI / 2;
    glow.position.y = 0.7;
    car.add(glow);
    this.car = car;
    this.routeGroup.add(car);

    // Gate ring
    const gr = new THREE.Mesh(new THREE.RingGeometry(9, 10.5, 48), new THREE.MeshBasicMaterial({ color: 0x8fb6ff, transparent: true, opacity: 0.8, depthWrite: false, side: THREE.DoubleSide }));
    gr.rotation.x = -Math.PI / 2;
    gr.position.set(FACILITY.gate.x, 0.8, FACILITY.gate.z);
    this.gateRing = gr;
    this.routeGroup.add(gr);

    this.routeClock = 0;
    this.routePhase = 0;
    this.select(unitId);
  }

  /** In HUD mode the camera follows the car; otherwise the route plays over a fixed view. */
  setFollow(on: boolean) {
    this.hudFollow = on;
  }

  private carAt(d: number) {
    const c = this.routeCurve!;
    d = Math.max(0, Math.min(c.total, d));
    let i = 1;
    while (i < c.lens.length - 1 && c.lens[i] < d) i++;
    const t = (d - c.lens[i - 1]) / (c.lens[i] - c.lens[i - 1] || 1);
    const p = new THREE.Vector3().lerpVectors(c.pts[i - 1], c.pts[i], t);
    const dir = new THREE.Vector3().subVectors(c.pts[i], c.pts[i - 1]).normalize();
    return { p, dir, leg: i - 1 };
  }

  private tickRoute(dt: number) {
    if (!this.routeCurve || !this.routeMat || !this.car) return;
    const c = this.routeCurve;
    this.routeClock += dt;
    const OVER = 2.2, DRIVE = Math.max(4, c.total / 70), ARRIVE = 3.2;
    const T = this.routeClock % (OVER + DRIVE + ARRIVE);
    this.routeMat.uniforms.uTime.value = this.time;
    let phase: "overview" | "drive" | "arrive";
    let d = 0;
    if (T < OVER) {
      phase = "overview";
      this.routeMat.uniforms.uReveal.value = easeInOut(T / OVER);
      d = 0;
      if (this.hudFollow) this.flyTo({ x: -10, z: -5, zoom: 1.05, az: 0.62, el: 0.72 });
    } else if (T < OVER + DRIVE) {
      phase = "drive";
      this.routeMat.uniforms.uReveal.value = 1;
      const k = easeInOut((T - OVER) / DRIVE);
      d = k * c.total;
      if (this.hudFollow) {
        const at = this.carAt(d);
        this.flyTo({ x: at.p.x, z: at.p.z, zoom: 2.2, el: 0.66 });
      }
    } else {
      phase = "arrive";
      this.routeMat.uniforms.uReveal.value = 1;
      d = c.total;
      if (this.hudFollow) {
        const end = c.pts[c.pts.length - 1];
        this.flyTo({ x: end.x, z: end.z - 6, zoom: 3.2, el: 0.62 });
      }
    }
    const at = this.carAt(d);
    this.car.position.copy(at.p);
    this.car.rotation.y = Math.atan2(at.dir.x, at.dir.z);
    if (this.gateRing) {
      const s = 1 + ((this.time * 0.8) % 1) * 0.8;
      this.gateRing.scale.set(s, s, s);
      (this.gateRing.material as THREE.MeshBasicMaterial).opacity = 0.8 * (1 - ((this.time * 0.8) % 1));
    }
    this.onRouteProgress?.({ phase, t: d / c.total, leg: at.leg });
  }

  // ---------------------------------------------------------------- labels

  track(el: HTMLElement, pos: () => THREE.Vector3 | null) {
    const t = { el, pos };
    this.tracked.push(t);
    return () => {
      this.tracked = this.tracked.filter(x => x !== t);
    };
  }

  unitAnchor(id: string, lift = 0) {
    const u = UNIT_BY_ID.get(id);
    if (!u) return null;
    const b = BUILDINGS.find(b => b.id === u.building)!;
    if (u.kind === "climate") return new THREE.Vector3(u.x + u.w / 2, (u.floor - 1) * b.h + b.h + lift, u.z + u.d / 2);
    return new THREE.Vector3(u.door.x, (b.h || 4) + 6 + lift, u.facing === "south" ? b.z + b.d : u.kind === "parking" ? u.z + u.d / 2 : b.z);
  }

  carPosition() {
    return this.car ? this.car.position.clone().add(new THREE.Vector3(0, 10, 0)) : null;
  }

  project(v: THREE.Vector3) {
    const p = v.clone().project(this.cam);
    const r = this.container.getBoundingClientRect();
    return { x: (p.x * 0.5 + 0.5) * r.width, y: (-p.y * 0.5 + 0.5) * r.height, onScreen: p.z < 1 && Math.abs(p.x) < 1.1 && Math.abs(p.y) < 1.1 };
  }

  private updateLabels() {
    for (const t of this.tracked) {
      const v = t.pos();
      if (!v) {
        t.el.style.opacity = "0";
        continue;
      }
      const p = this.project(v);
      t.el.style.transform = `translate3d(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px, 0)`;
      t.el.style.opacity = p.onScreen ? "1" : "0";
    }
  }

  // ---------------------------------------------------------------- loop

  private onVis = () => {
    if (!document.hidden) this.start();
  };

  private start() {
    if (this.running || this.disposed) return;
    this.running = true;
    this.last = performance.now();
    requestAnimationFrame(this.frame);
  }

  private frame = (now: number) => {
    if (this.disposed) return;
    if (!this.visible || document.hidden) {
      this.running = false;
      return;
    }
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    this.time += dt;

    if (this.opts.idleSpin && !this.drag && !this.selected) this.target.az += dt * 0.05;
    const k = 1 - Math.exp(-dt * 3.2);
    const v = this.view, t = this.target;
    let daz = t.az - v.az;
    while (daz > Math.PI) daz -= Math.PI * 2;
    while (daz < -Math.PI) daz += Math.PI * 2;
    v.az += daz * k;
    v.el += (t.el - v.el) * k;
    v.x += (t.x - v.x) * k;
    v.z += (t.z - v.z) * k;
    v.zoom += (t.zoom - v.zoom) * k;
    this.placeCamera();

    // Selection animation
    if (this.highlight.visible) {
      this.beamMat.uniforms.uTime.value = this.time;
      const s = 1 + ((this.time * 0.7) % 1) * 1.6;
      this.ring.scale.set(s, s, s);
      (this.ring.material as THREE.MeshBasicMaterial).opacity = 0.75 * (1 - ((this.time * 0.7) % 1));
      (this.outlineFill.material as THREE.MeshBasicMaterial).opacity = 0.18 + 0.12 * Math.sin(this.time * 3);
    }
    if (this.pulse.size) {
      const a = 0.5 + 0.5 * Math.sin(this.time * 3.2);
      for (const i of this.pulse) {
        this.pulseColor.copy(this.doorBase[i]).lerp(new THREE.Color(this.mode === "store" ? "#0358f7" : "#ffffff"), a * 0.5);
        this.doorMesh.setColorAt(i, this.pulseColor);
      }
      this.doorMesh.instanceColor!.needsUpdate = true;
    }
    if (this.water) (this.water.material as THREE.MeshLambertMaterial).opacity = 0.88 + 0.05 * Math.sin(this.time * 0.8);
    if (this.extruding) this.applyExtrude();
    this.tickRoute(dt);
    this.renderer.render(this.scene, this.cam);
    this.updateLabels();
    this.onFrame?.(this.time);
    requestAnimationFrame(this.frame);
  };

  private placeCamera() {
    const r = this.container.getBoundingClientRect();
    const aspect = Math.max(0.2, r.width / Math.max(1, r.height));
    const v = this.view;
    // Frame roughly the whole site at zoom 1, adapting to narrow containers.
    const base = aspect < 1.1 ? 560 / aspect : 420;
    const vh = base / v.zoom;
    this.cam.left = (-vh * aspect) / 2;
    this.cam.right = (vh * aspect) / 2;
    this.cam.top = vh / 2;
    this.cam.bottom = -vh / 2;
    this.cam.updateProjectionMatrix();
    const dist = 1200;
    const dir = new THREE.Vector3(Math.cos(v.el) * Math.sin(v.az), Math.sin(v.el), Math.cos(v.el) * Math.cos(v.az));
    const target = new THREE.Vector3(v.x, 0, v.z);
    this.cam.position.copy(target).addScaledVector(dir, dist);
    this.cam.up.set(0, 1, 0);
    this.cam.lookAt(target);
  }

  private resize() {
    const r = this.container.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return;
    this.renderer.setSize(r.width, r.height, false);
    this.placeCamera();
  }

  // ---------------------------------------------------------------- input

  private bindPointer() {
    const el = this.renderer.domElement;
    el.addEventListener("pointerdown", e => {
      this.drag = { x: e.clientX, y: e.clientY, az: this.target.az, el: this.target.el, moved: false };
      el.setPointerCapture(e.pointerId);
    });
    el.addEventListener("pointermove", e => {
      if (this.drag) {
        const dx = e.clientX - this.drag.x;
        const dy = e.clientY - this.drag.y;
        if (Math.abs(dx) + Math.abs(dy) > 4) this.drag.moved = true;
        this.target.az = this.drag.az - dx * 0.006;
        this.target.el = Math.min(1.2, Math.max(0.35, this.drag.el + dy * 0.004));
        return;
      }
      this.pick(e.clientX, e.clientY, false);
    });
    el.addEventListener("pointerup", e => {
      const d = this.drag;
      this.drag = null;
      if (d && !d.moved) this.pick(e.clientX, e.clientY, true);
    });
    el.addEventListener("pointerleave", () => {
      if (this.hovered) {
        this.hovered = null;
        this.opts.onHover?.(null, 0, 0);
      }
    });
    el.addEventListener(
      "wheel",
      e => {
        e.preventDefault();
        this.target.zoom = Math.min(6, Math.max(0.7, this.target.zoom * (e.deltaY > 0 ? 0.9 : 1.1)));
      },
      { passive: false },
    );
  }

  private pick(cx: number, cy: number, click: boolean) {
    const r = this.renderer.domElement.getBoundingClientRect();
    this.pointer.set(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
    this.raycaster.setFromCamera(this.pointer, this.cam);
    let id: string | null = null;
    const targets: THREE.Object3D[] = [this.doorMesh];
    if (this.xray) targets.push(this.interiorMesh);
    const hit = this.raycaster.intersectObjects(targets, false)[0];
    if (hit && hit.instanceId !== undefined) {
      id = hit.object === this.doorMesh ? this.doorUnits[hit.instanceId].id : this.interiorUnits[hit.instanceId].id;
    }
    if (click) {
      this.opts.onSelect?.(id);
      return;
    }
    if (id !== this.hovered) {
      this.hovered = id;
      this.renderer.domElement.style.cursor = id ? "pointer" : "grab";
    }
    this.opts.onHover?.(id, cx - r.left, cy - r.top);
  }

  dispose() {
    this.disposed = true;
    this.ro.disconnect();
    this.io.disconnect();
    document.removeEventListener("visibilitychange", this.onVis);
    this.scene.traverse(o => {
      const m = o as THREE.Mesh;
      m.geometry?.dispose?.();
      const mat = m.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(mat)) mat.forEach(x => x.dispose());
      else mat?.dispose?.();
    });
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}

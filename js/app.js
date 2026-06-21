"use strict";
/* ---------------------------------------------------------------------------
   2. SCENE SETUP
--------------------------------------------------------------------------- */
const canvas = document.getElementById("scene");
const renderer = new THREE.WebGLRenderer({ canvas, antialias:true, alpha:true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputEncoding = THREE.sRGBEncoding;

const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(42, window.innerWidth/window.innerHeight, 0.1, 100);
const CAM_HOME = new THREE.Vector3(0, 0.15, 5.0);
camera.position.copy(CAM_HOME);
camera.lookAt(0, 0, 0);

// Lighting — soft key + cool/warm rims for a "premium" glow.
scene.add(new THREE.AmbientLight(0x5566aa, 0.7));
const key = new THREE.DirectionalLight(0xffffff, 0.9); key.position.set(3,4,5); scene.add(key);
const rimCyan = new THREE.PointLight(0x49c7ff, 0.9, 30); rimCyan.position.set(-4,1,3); scene.add(rimCyan);
const rimAmber = new THREE.PointLight(0xff7a45, 0.8, 30); rimAmber.position.set(3,-3,-3); scene.add(rimAmber);
const fill = new THREE.DirectionalLight(0x9fb6ff, 0.35); fill.position.set(-2,-1,-4); scene.add(fill);

// brainGroup holds everything that rotates/explodes together.
const brainGroup = new THREE.Group();
scene.add(brainGroup);

/* ---------------------------------------------------------------------------
   3. PROCEDURAL BRAIN
   Own value-noise (no external lib) drives gyri/sulci displacement.
--------------------------------------------------------------------------- */
function hash3(i,j,k){
  let n = i*374761393 + j*668265263 + k*2147483647;
  n = (n ^ (n >> 13)) * 1274126177;
  n = (n ^ (n >> 16)) >>> 0;
  return n / 4294967295;             // -> [0,1)
}
function lerp(a,b,t){ return a + (b-a)*t; }
function fade(t){ return t*t*(3-2*t); }  // smoothstep
function valueNoise(x,y,z){
  const xi=Math.floor(x), yi=Math.floor(y), zi=Math.floor(z);
  const xf=x-xi, yf=y-yi, zf=z-zi;
  const u=fade(xf), v=fade(yf), w=fade(zf);
  const c000=hash3(xi,yi,zi),     c100=hash3(xi+1,yi,zi);
  const c010=hash3(xi,yi+1,zi),   c110=hash3(xi+1,yi+1,zi);
  const c001=hash3(xi,yi,zi+1),   c101=hash3(xi+1,yi,zi+1);
  const c011=hash3(xi,yi+1,zi+1), c111=hash3(xi+1,yi+1,zi+1);
  const x00=lerp(c000,c100,u), x10=lerp(c010,c110,u);
  const x01=lerp(c001,c101,u), x11=lerp(c011,c111,u);
  const y0=lerp(x00,x10,v), y1=lerp(x01,x11,v);
  return lerp(y0,y1,w);
}
// Fractal noise (a few octaves) for the wrinkly cortical surface.
function fbm(x,y,z){
  let amp=0.5, freq=1.0, sum=0;
  for(let o=0;o<4;o++){ sum += amp*valueNoise(x*freq,y*freq,z*freq); amp*=0.5; freq*=2.05; }
  return sum;
}

// Build one cerebral hemisphere-ish lobe shaped + folded ellipsoid.
function buildCortex(){
  const geo = new THREE.SphereGeometry(1, 180, 140);
  const pos = geo.attributes.position;
  const v = new THREE.Vector3();
  for(let idx=0; idx<pos.count; idx++){
    v.fromBufferAttribute(pos, idx);
    const n = v.clone().normalize();
    // brain proportions: longer front-back (z), a touch narrower in height (y).
    let px = n.x*1.12, py = n.y*0.96, pz = n.z*1.42;

    // gyri/sulci: high-frequency folds along the surface.
    const folds = fbm(n.x*4.0+11, n.y*4.0+5, n.z*4.0+19);
    let disp = (folds-0.5)*0.20;

    // Longitudinal fissure: deep groove down the top midline (small |x|, upper y).
    const fissure = Math.exp(-(px*px)/0.012) * Math.max(0, py) ;
    disp -= fissure*0.16;

    // Flatten the underside slightly (brain sits flatter at the base).
    if(py<0) py *= 0.92;

    const len = Math.sqrt(px*px+py*py+pz*pz) || 1;
    const k = (1 + disp/len);
    pos.setXYZ(idx, px*k, py*k, pz*k);
  }
  geo.computeVertexNormals();

  const mat = new THREE.MeshPhysicalMaterial({
    color:0xd7b9cf, roughness:0.55, metalness:0.0,
    transparent:true, opacity:0.30, transmission:0.0,
    clearcoat:0.4, clearcoatRoughness:0.6,
    emissive:0x2a1830, emissiveIntensity:0.35,
    side:THREE.DoubleSide, depthWrite:false,
  });
  const mesh = new THREE.Mesh(geo, mat);
  return mesh;
}

const cortex = buildCortex();
brainGroup.add(cortex);

// Cerebellum (small folded blob, lower-back) for silhouette realism.
(function addCerebellum(){
  const g = new THREE.SphereGeometry(0.42, 64, 48);
  const p = g.attributes.position; const v = new THREE.Vector3();
  for(let i=0;i<p.count;i++){
    v.fromBufferAttribute(p,i); const n=v.clone().normalize();
    const f = fbm(n.x*9+3, n.y*9+7, n.z*9+1);
    const d = 1 + (f-0.5)*0.22;
    p.setXYZ(i, n.x*0.5*d, n.y*0.34*d, n.z*0.42*d);
  }
  g.computeVertexNormals();
  const m = new THREE.MeshStandardMaterial({color:0xc9a9c2, roughness:0.7, transparent:true, opacity:0.34, emissive:0x241226, emissiveIntensity:0.3, depthWrite:false});
  const mesh = new THREE.Mesh(g,m);
  mesh.position.set(0,-0.55,-1.05);
  brainGroup.add(mesh);
})();

// Brain stem.
(function addStem(){
  const g = new THREE.CylinderGeometry(0.10,0.16,0.55,24);
  const m = new THREE.MeshStandardMaterial({color:0xc7a6c0, roughness:0.7, transparent:true, opacity:0.4, emissive:0x241226, emissiveIntensity:0.3, depthWrite:false});
  const mesh = new THREE.Mesh(g,m);
  mesh.position.set(0,-0.78,-0.5); mesh.rotation.x = 0.5;
  brainGroup.add(mesh);
})();

/* ---- Rational highlight: a translucent cyan "skin" over the frontal lobe ---- */
function buildFrontalShell(){
  // Cap of a sphere facing +z, scaled to hug the front of the cortex.
  const geo = new THREE.SphereGeometry(1.02, 64, 48, 0, Math.PI*2, 0, Math.PI*0.62);
  const pos = geo.attributes.position; const v=new THREE.Vector3();
  for(let i=0;i<pos.count;i++){
    v.fromBufferAttribute(pos,i);
    // reorient cap to point along +z and match brain proportions
    pos.setXYZ(i, v.x*1.10, v.z*0.95, v.y*1.40);
  }
  geo.computeVertexNormals();
  const mat = new THREE.MeshStandardMaterial({
    color:0x49c7ff, transparent:true, opacity:0.16, emissive:0x1d6fae,
    emissiveIntensity:0.7, roughness:0.4, side:THREE.DoubleSide, depthWrite:false,
  });
  const m = new THREE.Mesh(geo, mat);
  m.userData = { pick:RATIONAL, baseEmissive:0.7, system:"r", master:true };
  return m;
}
const frontalShell = buildFrontalShell();
brainGroup.add(frontalShell);

/* ---------------------------------------------------------------------------
   Build hotspot meshes for every part. Each returns picker userData.
--------------------------------------------------------------------------- */
const pickables = [ frontalShell ];   // everything raycastable
const glowables = [ ];                // meshes that pulse during scenario
const labelEntries = [];              // {el, obj, system}

function makeStructureMesh(part, posVec, isLeft){
  let geo;
  const s = part.size || 0.09;
  if(part.shape === "curve"){
    // little banana for the hippocampus
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-s*1.4,0,-s), new THREE.Vector3(0,s*0.4,0), new THREE.Vector3(s*1.4,0,s)
    ]);
    geo = new THREE.TubeGeometry(curve, 20, s*0.55, 10, false);
  } else {
    geo = new THREE.SphereGeometry(s, 28, 24);
    // gentle noise so structures aren't perfect spheres
    const p=geo.attributes.position, vv=new THREE.Vector3();
    for(let i=0;i<p.count;i++){ vv.fromBufferAttribute(p,i); const n=vv.clone().normalize();
      const f=fbm(n.x*6+part.id.length, n.y*6+2, n.z*6+5); const d=1+(f-0.5)*0.25;
      p.setXYZ(i, n.x*s*d, n.y*s*d, n.z*s*d); }
    geo.computeVertexNormals();
  }
  const col = part.system==="r" ? 0x49c7ff : 0xff7a45;
  const emi = part.system==="r" ? 0x1d6fae : 0xb83a16;
  const mat = new THREE.MeshStandardMaterial({
    color:col, emissive:emi, emissiveIntensity:1.1, roughness:0.35,
    transparent:true, opacity:0.95,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.copy(posVec);
  mesh.userData = { pick:part, baseEmissive:1.1, system:part.system, homePos:posVec.clone() };
  return mesh;
}

function addPart(part){
  const positions = [];
  const [x,y,z] = part.pos;
  if(part.side === "mirror"){ positions.push(new THREE.Vector3(x,y,z), new THREE.Vector3(-x,y,z)); }
  else { positions.push(new THREE.Vector3(x,y,z)); }

  positions.forEach((p,i)=>{
    const mesh = makeStructureMesh(part, p, i===1);
    brainGroup.add(mesh);
    pickables.push(mesh);
    glowables.push(mesh);
    if(i===0){
      // one label per part (anchored to the right-side instance)
      const el = document.createElement("div");
      el.className = "lbl " + part.system;
      el.textContent = part.name.replace(/\s*\(.*\)/,""); // short name
      document.getElementById("labels").appendChild(el);
      labelEntries.push({ el, obj:mesh, system:part.system });
    }
  });
}

RATIONAL_PARTS.forEach(addPart);
EMOTIONAL_PARTS.forEach(addPart);

// Label + glow registration for the frontal shell (master rational region).
glowables.push(frontalShell);
(function frontalLabel(){
  const el=document.createElement("div"); el.className="lbl r"; el.textContent="Prefrontal Cortex";
  document.getElementById("labels").appendChild(el);
  const anchor = new THREE.Object3D(); anchor.position.set(0,0.35,1.25); brainGroup.add(anchor);
  labelEntries.push({el, obj:anchor, system:"r"});
})();

/* ---------------------------------------------------------------------------
   3b. GLOWING NEURON NETWORK
   A web of neuron nodes sitting on the cortex surface, linked by synaptic
   threads, with sparks of light firing between them. Pure procedural glow
   (additive sprites) so it stays self-contained and fully 3D.
--------------------------------------------------------------------------- */
let sparkSpeed = 1;                         // boosted during the scenario
const neuronGroup = new THREE.Group();
brainGroup.add(neuronGroup);

// Soft radial-gradient sprite used for every glowing dot.
function makeGlowSprite(){
  const c=document.createElement("canvas"); c.width=c.height=64;
  const g=c.getContext("2d");
  const grad=g.createRadialGradient(32,32,0,32,32,32);
  grad.addColorStop(0,  "rgba(255,255,255,1)");
  grad.addColorStop(0.25,"rgba(210,240,255,0.85)");
  grad.addColorStop(1,  "rgba(150,210,255,0)");
  g.fillStyle=grad; g.fillRect(0,0,64,64);
  return new THREE.CanvasTexture(c);
}
const glowSprite = makeGlowSprite();

// Place a point on the folded cortex surface (mirrors the cortex displacement).
function brainSurfacePoint(n){
  let px=n.x*1.12, py=n.y*0.96, pz=n.z*1.42;
  const folds=fbm(n.x*4.0+11, n.y*4.0+5, n.z*4.0+19);
  let disp=(folds-0.5)*0.20;
  const fissure=Math.exp(-(px*px)/0.012)*Math.max(0,py);
  disp-=fissure*0.16;
  if(py<0) py*=0.92;
  const len=Math.sqrt(px*px+py*py+pz*pz)||1;
  return new THREE.Vector3(px,py,pz).multiplyScalar(1+disp/len);
}

// --- neuron nodes (evenly scattered via a Fibonacci sphere) ---
const NODES = 150;
const nodePositions = [];
const nodeColorArr = [];
const cyan=new THREE.Color(0x8fe3ff), amber=new THREE.Color(0xffb877),
      white=new THREE.Color(0xffffff), violet=new THREE.Color(0xb9a8ff);
for(let i=0;i<NODES;i++){
  const y=1-(i/(NODES-1))*2, r=Math.sqrt(Math.max(0,1-y*y));
  const phi=i*Math.PI*(3-Math.sqrt(5));
  const dir=new THREE.Vector3(Math.cos(phi)*r, y, Math.sin(phi)*r);
  const p=brainSurfacePoint(dir).add(dir.clone().multiplyScalar(0.045)); // float just above
  nodePositions.push(p);
  // Tint: cyan toward the front (rational), amber toward the lower middle (limbic).
  let col;
  const limbicish = (p.y < -0.02) && (Math.abs(p.x) < 0.75) && (p.z > -0.35);
  if(limbicish) col = amber.clone().lerp(white, Math.random()*0.4);
  else if(p.z > 0.4) col = cyan.clone().lerp(white, Math.random()*0.5);
  else col = cyan.clone().lerp(violet, Math.random()*0.35).lerp(white, Math.random()*0.3);
  col.multiplyScalar(0.7 + Math.random()*0.3);
  nodeColorArr.push(col.r, col.g, col.b);
}
const nodeGeo = new THREE.BufferGeometry();
nodeGeo.setAttribute("position", new THREE.Float32BufferAttribute(
  nodePositions.flatMap(p=>[p.x,p.y,p.z]), 3));
nodeGeo.setAttribute("color", new THREE.Float32BufferAttribute(nodeColorArr, 3));
const nodePoints = new THREE.Points(nodeGeo, new THREE.PointsMaterial({
  size:0.085, map:glowSprite, vertexColors:true, transparent:true, opacity:0.85,
  blending:THREE.AdditiveBlending, depthWrite:false, sizeAttenuation:true,
}));
neuronGroup.add(nodePoints);

// --- synaptic threads: link each node to a few nearby neighbours ---
const edges = [];
const seen = new Set();
const linePos = [];
const TH = 0.46, MAXC = 3;
for(let i=0;i<NODES;i++){
  const cand=[];
  for(let j=0;j<NODES;j++){
    if(j===i) continue;
    const d=nodePositions[i].distanceTo(nodePositions[j]);
    if(d<TH) cand.push([d,j]);
  }
  cand.sort((a,b)=>a[0]-b[0]);
  let cnt=0;
  for(const [,j] of cand){
    if(cnt>=MAXC) break; cnt++;
    const key = i<j ? i+"_"+j : j+"_"+i;
    if(seen.has(key)) continue; seen.add(key);
    edges.push([i,j]);
    const a=nodePositions[i], b=nodePositions[j];
    linePos.push(a.x,a.y,a.z, b.x,b.y,b.z);
  }
}
const lineGeo = new THREE.BufferGeometry();
lineGeo.setAttribute("position", new THREE.Float32BufferAttribute(linePos, 3));
const synapses = new THREE.LineSegments(lineGeo, new THREE.LineBasicMaterial({
  color:0x5fb8ff, transparent:true, opacity:0.16,
  blending:THREE.AdditiveBlending, depthWrite:false,
}));
neuronGroup.add(synapses);

// --- sparks: bright pulses travelling along the threads ---
const SPARKS = Math.min(46, edges.length);
const sparks = [];
for(let i=0;i<SPARKS;i++){
  const e=edges[(Math.random()*edges.length)|0];
  sparks.push({ a:e[0], b:e[1], t:Math.random(), speed:0.25+Math.random()*0.55 });
}
const sparkGeo = new THREE.BufferGeometry();
sparkGeo.setAttribute("position", new THREE.Float32BufferAttribute(new Float32Array(SPARKS*3), 3));
const sparkPts = new THREE.Points(sparkGeo, new THREE.PointsMaterial({
  size:0.13, map:glowSprite, color:0xeaffff, transparent:true, opacity:0.95,
  blending:THREE.AdditiveBlending, depthWrite:false, sizeAttenuation:true,
}));
neuronGroup.add(sparkPts);

// --- soft ambient halo behind the brain for an overall glow ---
(function addHalo(){
  const halo = new THREE.Mesh(
    new THREE.SphereGeometry(1, 48, 32),
    new THREE.MeshBasicMaterial({ color:0x3aa0ff, transparent:true, opacity:0.05,
      blending:THREE.AdditiveBlending, side:THREE.BackSide, depthWrite:false })
  );
  halo.scale.set(1.4,1.22,1.75);
  brainGroup.add(halo);
})();

function updateNeurons(dt, t){
  if(!neuronGroup.visible) return;
  nodePoints.material.opacity = 0.74 + Math.sin(t*1.6)*0.14;   // gentle breathing
  const arr = sparkPts.geometry.attributes.position.array;
  for(let i=0;i<sparks.length;i++){
    const s=sparks[i];
    s.t += dt*s.speed*sparkSpeed;
    if(s.t>=1){                                                // fire down a new thread
      const e=edges[(Math.random()*edges.length)|0];
      s.a=e[0]; s.b=e[1]; s.t=0; s.speed=0.25+Math.random()*0.55;
    }
    const pa=nodePositions[s.a], pb=nodePositions[s.b];
    arr[i*3]   = pa.x+(pb.x-pa.x)*s.t;
    arr[i*3+1] = pa.y+(pb.y-pa.y)*s.t;
    arr[i*3+2] = pa.z+(pb.z-pa.z)*s.t;
  }
  sparkPts.geometry.attributes.position.needsUpdate = true;
}

/* ---------------------------------------------------------------------------
   4. NEURAL PATHWAYS  (PFC <-> amygdala / hippocampus / nucleus accumbens)
   Each pathway: a glowing tube + two particle streams (both directions).
--------------------------------------------------------------------------- */
const PFC_ANCHOR = new THREE.Vector3(0, 0.12, 0.95);
const pathways = [];
const pathGroup = new THREE.Group();
brainGroup.add(pathGroup);

function makePathway(targetPos){
  const mid = PFC_ANCHOR.clone().add(targetPos).multiplyScalar(0.5);
  mid.y += 0.35; mid.z += 0.05;                       // arc the fibre upward
  const curve = new THREE.QuadraticBezierCurve3(PFC_ANCHOR.clone(), mid, targetPos.clone());

  const tube = new THREE.Mesh(
    new THREE.TubeGeometry(curve, 60, 0.012, 8, false),
    new THREE.MeshBasicMaterial({ color:0x8fdcff, transparent:true, opacity:0.28, blending:THREE.AdditiveBlending, depthWrite:false })
  );
  pathGroup.add(tube);

  // two particle streams: cyan (PFC->limbic) and amber (limbic->PFC)
  function stream(color, dir){
    const N = 26;
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(N*3), 3));
    const m = new THREE.PointsMaterial({ color, size:0.055, transparent:true, opacity:0.9,
      blending:THREE.AdditiveBlending, depthWrite:false });
    const pts = new THREE.Points(g, m);
    pathGroup.add(pts);
    return { pts, N, dir, offset:Math.random() };
  }
  const streams = [ stream(0x9fe6ff, 1), stream(0xffb877, -1) ];
  pathways.push({ curve, tube, streams });
}

[ EMOTIONAL_PARTS[0].pos, EMOTIONAL_PARTS[1].pos, EMOTIONAL_PARTS[3].pos ]
  .forEach(p => makePathway(new THREE.Vector3(p[0], p[1], p[2])));

let pathSpeed = 1;   // boosted during scenario
function animatePathways(t){
  pathways.forEach(pw=>{
    pw.streams.forEach(s=>{
      const arr = s.pts.geometry.attributes.position.array;
      for(let i=0;i<s.N;i++){
        let tt = ((i/s.N) + (s.offset + t*0.12*pathSpeed)*s.dir) % 1;
        if(tt<0) tt+=1;
        const p = pw.curve.getPointAt(tt);
        arr[i*3]=p.x; arr[i*3+1]=p.y; arr[i*3+2]=p.z;
      }
      s.pts.geometry.attributes.position.needsUpdate = true;
    });
  });
}

/* ---------------------------------------------------------------------------
   5. CUSTOM CONTROLS  (drag-rotate, zoom, pinch, auto-rotate, idle resume)
--------------------------------------------------------------------------- */
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const ctrl = {
  autoRotate:true, dragging:false, lastX:0, lastY:0,
  velX:0, velY:0, idleAt:0, downX:0, downY:0, moved:false,
  zoom:CAM_HOME.z, zoomTarget:CAM_HOME.z,
  pinchDist:0,
};

function onDown(e){
  const p = pointer(e);
  ctrl.dragging=true; ctrl.moved=false;
  ctrl.lastX=p.x; ctrl.lastY=p.y; ctrl.downX=p.x; ctrl.downY=p.y;
  ctrl.idleAt = performance.now();
}
function onMove(e){
  if(!ctrl.dragging) return;
  if(e.touches && e.touches.length===2){ handlePinch(e); return; }
  const p = pointer(e);
  const dx = p.x-ctrl.lastX, dy = p.y-ctrl.lastY;
  ctrl.lastX=p.x; ctrl.lastY=p.y;
  if(Math.abs(p.x-ctrl.downX)+Math.abs(p.y-ctrl.downY) > 6) ctrl.moved=true;
  brainGroup.rotation.y += dx*0.006;
  brainGroup.rotation.x = clamp(brainGroup.rotation.x + dy*0.006, -0.9, 0.9);
  ctrl.velX = dy*0.006; ctrl.velY = dx*0.006;
}
function onUp(e){
  if(ctrl.dragging && !ctrl.moved) handleClick(e);   // tap = pick
  ctrl.dragging=false; ctrl.idleAt = performance.now();
}
function handlePinch(e){
  const a=e.touches[0], b=e.touches[1];
  const d=Math.hypot(a.clientX-b.clientX, a.clientY-b.clientY);
  if(ctrl.pinchDist){ ctrl.zoomTarget = clamp(ctrl.zoomTarget - (d-ctrl.pinchDist)*0.01, 3.0, 8.5); }
  ctrl.pinchDist = d;
}
function pointer(e){
  if(e.touches && e.touches.length) return {x:e.touches[0].clientX, y:e.touches[0].clientY};
  return {x:e.clientX, y:e.clientY};
}
function clamp(v,a,b){ return Math.max(a, Math.min(b,v)); }

canvas.addEventListener("mousedown", onDown);
window.addEventListener("mousemove", onMove);
window.addEventListener("mouseup", onUp);
canvas.addEventListener("touchstart", e=>{ if(e.touches.length===2){ctrl.pinchDist=0;} onDown(e); }, {passive:true});
canvas.addEventListener("touchmove", e=>{ onMove(e); }, {passive:true});
canvas.addEventListener("touchend", e=>{ ctrl.pinchDist=0; onUp(e); });
canvas.addEventListener("wheel", e=>{ e.preventDefault(); ctrl.zoomTarget = clamp(ctrl.zoomTarget + e.deltaY*0.0016, 3.0, 8.5); }, {passive:false});

/* ---------------------------------------------------------------------------
   6. RAYCAST PICKING
--------------------------------------------------------------------------- */
const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();
let selected = null;

function handleClick(e){
  const p = pointer(e);
  ndc.x = (p.x/window.innerWidth)*2 - 1;
  ndc.y = -(p.y/window.innerHeight)*2 + 1;
  raycaster.setFromCamera(ndc, camera);
  const hits = raycaster.intersectObjects(pickables, false);
  if(hits.length){
    const obj = hits[0].object;
    selectObject(obj);
  }
}

function selectObject(obj){
  clearSelectionGlow();
  selected = obj;
  obj.userData._selGlow = true;
  // gentle camera nudge inward on selection
  ctrl.zoomTarget = clamp(ctrl.zoom - 0.5, 3.0, 8.5);
  const part = obj.userData.pick;
  if(part.master) openMasterPanel(part);
  else openPartPanel(part);
}
function clearSelectionGlow(){
  glowables.forEach(g=>{ g.userData._selGlow=false; });
}

/* ---------------------------------------------------------------------------
   PANELS
--------------------------------------------------------------------------- */
const panel = document.getElementById("panel");
const pTag=document.getElementById("pTag"), pTitle=document.getElementById("pTitle"),
      pSub=document.getElementById("pSub"), pBody=document.getElementById("pBody");

function setPanelClass(system){
  panel.classList.remove("r","e");
  panel.classList.add(system);
}
function openMasterPanel(data){
  setPanelClass(data.system);
  pTag.textContent = data.tag;
  pTitle.textContent = data.title;
  pSub.textContent = data.sub;
  pBody.innerHTML =
    `<h3>Functions</h3><div class="chips">${data.functions.map(f=>`<span class="chip">${f}</span>`).join("")}</div>`+
    `<h3>Teen insight</h3><div class="insight">${data.insight}</div>`;
  showPanel();
}
function openPartPanel(part){
  setPanelClass(part.system);
  pTag.textContent = part.system==="r" ? "Prefrontal sub-region" : "Limbic structure";
  pTitle.textContent = part.name;
  pSub.textContent = part.system==="r" ? "Rational Mind" : "Emotional Mind";
  pBody.innerHTML =
    `<h3>Functions</h3><div class="chips">${part.functions.map(f=>`<span class="chip">${f}</span>`).join("")}</div>`+
    `<h3>Teen relevance</h3><div class="insight">${part.relevance}</div>`+
    `<h3>Everyday example</h3><div class="example"><em>“${part.example}”</em></div>`;
  showPanel();
}
function showPanel(){ panel.classList.add("show"); }
function hidePanel(){ panel.classList.remove("show"); selected=null; clearSelectionGlow(); }
document.getElementById("panelClose").addEventListener("click", hidePanel);

// Legend cards open the master panels.
document.querySelectorAll(".legend-card").forEach(card=>{
  const open = ()=>{
    const which = card.getAttribute("data-open");
    clearSelectionGlow();
    if(which==="rational"){ frontalShell.userData._selGlow=true; openMasterPanel(RATIONAL); }
    else { glowables.filter(g=>g.userData.system==="e").forEach(g=>g.userData._selGlow=true); openMasterPanel(EMOTIONAL); }
  };
  card.addEventListener("click", open);
  card.addEventListener("keydown", e=>{ if(e.key==="Enter"||e.key===" "){ e.preventDefault(); open(); }});
});

/* ---------------------------------------------------------------------------
   COMPARISON DASHBOARD
--------------------------------------------------------------------------- */
const cmpRows = document.getElementById("cmpRows");
COMPARISON.forEach(([r,e])=>{
  const row=document.createElement("div"); row.className="cmp-row";
  row.innerHTML=`<span class="cr">${r}</span><span class="vs">VS</span><span class="ce">${e}</span>`;
  cmpRows.appendChild(row);
});
const compareEl = document.getElementById("compare");
function toggleCompare(force){
  const show = force!==undefined ? force : !compareEl.classList.contains("show");
  compareEl.classList.toggle("show", show);
  document.getElementById("btnCompare").classList.toggle("on", show);
  if(show){
    [...cmpRows.children].forEach((r,i)=> setTimeout(()=>r.classList.add("in"), i*70));
  } else {
    [...cmpRows.children].forEach(r=>r.classList.remove("in"));
  }
}

/* ---------------------------------------------------------------------------
   TIMELINE
--------------------------------------------------------------------------- */
const track = document.getElementById("track");
TIMELINE.forEach(st=>{
  const el=document.createElement("div"); el.className="stage "+st.cls;
  el.innerHTML=`<div class="age">${st.age}</div><div class="what">${st.what}</div>`;
  el.addEventListener("click", ()=> spotlight(st.focus));
  track.appendChild(el);
});
const timelineEl = document.getElementById("timeline");
function toggleTimeline(force){
  const show = force!==undefined ? force : !timelineEl.classList.contains("show");
  timelineEl.classList.toggle("show", show);
  document.getElementById("btnTimeline").classList.toggle("on", show);
}
function spotlight(focus){
  clearSelectionGlow();
  if(focus==="emotional"||focus==="reward"){
    glowables.filter(g=>g.userData.system==="e").forEach(g=>g.userData._selGlow=true);
  } else if(focus==="rational"){
    glowables.filter(g=>g.userData.system==="r").forEach(g=>g.userData._selGlow=true);
  } else if(focus==="both"){
    glowables.forEach(g=>g.userData._selGlow=true);
  }
}

/* ---------------------------------------------------------------------------
   EXPLODE VIEW
--------------------------------------------------------------------------- */
let explodeT = 0, explodeTarget = 0;
function applyExplode(amount){
  glowables.forEach(g=>{
    if(g.userData.homePos){
      const dir = g.userData.homePos.clone().normalize();
      g.position.copy(g.userData.homePos).add(dir.multiplyScalar(amount*0.6));
    }
  });
  frontalShell.position.z = amount*0.5;
}

/* ---------------------------------------------------------------------------
   SCENARIO  ("Teen Brain Scenario")
--------------------------------------------------------------------------- */
const scNote=document.getElementById("scenarioNote"), scStep=document.getElementById("scStep"), scTxt=document.getElementById("scTxt");
let scenario = { active:false, t:0, phase:-1 };
const SCENARIO_STEPS = [
  { at:0.0, step:"Step 1 · Trigger", html:`The <b class="e">Emotional Brain</b> fires first — fast and strong.`, focus:"e" },
  { at:2.4, step:"Step 2 · Signal", html:`Signals race along the neural pathways toward the front of the brain.`, focus:"flow" },
  { at:4.8, step:"Step 3 · Catch-up", html:`The <b class="r">Prefrontal Cortex</b> activates a moment later to reason it out.`, focus:"r" },
  { at:7.4, step:"Why it matters", html:`In teenagers, emotions often react faster than rational thinking because the emotional brain matures earlier than the prefrontal cortex.`, focus:"both" },
];
function startScenario(){
  if(scenario.active) return;
  hidePanel(); toggleCompare(false); toggleTimeline(false);
  scenario.active=true; scenario.t=0; scenario.phase=-1;
  pathSpeed = 2.6; sparkSpeed = 3.0;
  ctrl.autoRotate=false; document.getElementById("btnRotate").classList.remove("on");
  scNote.classList.add("show");
}
function endScenario(){
  scenario.active=false; pathSpeed=1; sparkSpeed=1; clearSelectionGlow();
  scNote.classList.remove("show");
  ctrl.autoRotate=true; document.getElementById("btnRotate").classList.add("on");
}
function updateScenario(dt){
  if(!scenario.active) return;
  scenario.t += dt;
  // advance phase
  let ph=-1;
  for(let i=0;i<SCENARIO_STEPS.length;i++){ if(scenario.t>=SCENARIO_STEPS[i].at) ph=i; }
  if(ph!==scenario.phase){
    scenario.phase=ph;
    const s=SCENARIO_STEPS[ph];
    scStep.textContent=s.step; scTxt.innerHTML=s.html;
    clearSelectionGlow();
    if(s.focus==="e"||s.focus==="flow") glowables.filter(g=>g.userData.system==="e").forEach(g=>g.userData._selGlow=true);
    if(s.focus==="r") glowables.filter(g=>g.userData.system==="r").forEach(g=>g.userData._selGlow=true);
    if(s.focus==="both") glowables.forEach(g=>g.userData._selGlow=true);
  }
  if(scenario.t > 11){ endScenario(); }
}

/* ---------------------------------------------------------------------------
   TOOLBAR WIRING
--------------------------------------------------------------------------- */
function reset(){
  brainGroup.rotation.set(0,0,0);
  ctrl.zoomTarget = CAM_HOME.z; ctrl.autoRotate=true;
  document.getElementById("btnRotate").classList.add("on");
  explodeTarget=0; document.getElementById("btnExplode").classList.remove("on");
  hidePanel(); toggleCompare(false); toggleTimeline(false); endScenario();
}
document.getElementById("btnReset").addEventListener("click", reset);
document.getElementById("btnScenario").addEventListener("click", startScenario);
document.getElementById("btnRotate").addEventListener("click", e=>{
  ctrl.autoRotate=!ctrl.autoRotate; e.currentTarget.classList.toggle("on", ctrl.autoRotate);
});
let labelsOn=true;
document.getElementById("btnLabels").addEventListener("click", e=>{
  labelsOn=!labelsOn; e.currentTarget.classList.toggle("on", labelsOn);
  document.getElementById("labels").style.display = labelsOn ? "block":"none";
});
let pathsOn=true;
document.getElementById("btnPaths").addEventListener("click", e=>{
  pathsOn=!pathsOn; e.currentTarget.classList.toggle("on", pathsOn);
  pathGroup.visible = pathsOn;
});
let neuronsOn=true;
document.getElementById("btnNeurons").addEventListener("click", e=>{
  neuronsOn=!neuronsOn; e.currentTarget.classList.toggle("on", neuronsOn);
  neuronGroup.visible = neuronsOn;
});
document.getElementById("btnExplode").addEventListener("click", e=>{
  explodeTarget = explodeTarget>0.5 ? 0 : 1;
  e.currentTarget.classList.toggle("on", explodeTarget>0.5);
});
document.getElementById("btnCompare").addEventListener("click", ()=>toggleCompare());
document.getElementById("btnTimeline").addEventListener("click", ()=>toggleTimeline());

// Open comparison by default on wider screens to anchor the lesson.
if(window.innerWidth > 900) toggleCompare(true);

/* ---------------------------------------------------------------------------
   PROJECT 3D -> SCREEN for HTML labels
--------------------------------------------------------------------------- */
const projV = new THREE.Vector3();
function updateLabels(){
  if(!labelsOn) return;
  labelEntries.forEach(L=>{
    L.obj.getWorldPosition(projV);
    projV.project(camera);
    const behind = projV.z > 1;
    const x = (projV.x*0.5+0.5)*window.innerWidth;
    const y = (-projV.y*0.5+0.5)*window.innerHeight;
    L.el.style.left = x+"px"; L.el.style.top = y+"px";
    L.el.style.opacity = behind ? 0 : 0.96;
  });
}

/* ---------------------------------------------------------------------------
   MAIN LOOP
--------------------------------------------------------------------------- */
const clock = new THREE.Clock();
let pulse = 0;

function tick(){
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;
  pulse += dt;

  // auto-rotate when idle and enabled
  const idle = (performance.now() - ctrl.idleAt) > 1400;
  if(ctrl.autoRotate && !ctrl.dragging && idle && !reduceMotion){
    brainGroup.rotation.y += dt*0.18;
  }
  // inertia after drag
  if(!ctrl.dragging){
    brainGroup.rotation.y += ctrl.velY; brainGroup.rotation.x = clamp(brainGroup.rotation.x + ctrl.velX, -0.9, 0.9);
    ctrl.velX*=0.92; ctrl.velY*=0.92;
  }

  // smooth zoom
  ctrl.zoom += (ctrl.zoomTarget - ctrl.zoom)*0.12;
  camera.position.set(0, 0.15, ctrl.zoom);
  camera.lookAt(0,0,0);

  // explode lerp
  explodeT += (explodeTarget - explodeT)*0.10;
  if(Math.abs(explodeT-explodeTarget) > 0.001) applyExplode(explodeT);

  // glow pulsing for selected/scenario structures
  glowables.forEach(g=>{
    const base = g.userData.baseEmissive || 1.0;
    const sel = g.userData._selGlow;
    const targetE = sel ? base*(2.0 + Math.sin(pulse*6)*0.6) : base;
    g.material.emissiveIntensity += (targetE - g.material.emissiveIntensity)*0.15;
    if(g.userData.homePos){               // structures scale-pulse when selected
      const sc = sel ? 1.18 + Math.sin(pulse*6)*0.06 : 1.0;
      g.scale.setScalar(g.scale.x + (sc - g.scale.x)*0.15);
    }
  });

  animatePathways(t);
  updateNeurons(dt, t);
  updateScenario(dt);
  updateLabels();

  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}

/* ---------------------------------------------------------------------------
   RESIZE + BOOT
--------------------------------------------------------------------------- */
window.addEventListener("resize", ()=>{
  camera.aspect = window.innerWidth/window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

ctrl.idleAt = performance.now();
tick();
setTimeout(()=>document.getElementById("veil").classList.add("hide"), 500);

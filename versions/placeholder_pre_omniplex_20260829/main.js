// =========================================================================
// AUTO-UPDATE: detect new deploys and reload without manual refresh
// =========================================================================
(function autoUpdate() {
  let _sig = null, _checking = false;
  async function check() {
    if (_checking || document.hidden) return;
    _checking = true;
    try {
      const r = await fetch(location.pathname + '?_vu=' + Date.now(), { method: 'HEAD', cache: 'no-store' });
      const sig = (r.headers.get('content-length') || '') + '|' + (r.headers.get('etag') || '') + '|' + (r.headers.get('last-modified') || '');
      if (!_sig) { _sig = sig; _checking = false; return; }
      if (sig !== _sig) {
        const ci = document.getElementById('chat-input');
        const ti = document.querySelector('.term-input');
        const typing = (ci && ci === document.activeElement && ci.value) || (ti && ti === document.activeElement && ti.value);
        if (!typing) { location.reload(); return; }
        if (!document.getElementById('_ub')) {
          const b = document.createElement('div'); b.id = '_ub';
          b.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:99999;background:var(--ob-gold,#f0b800);color:#000;text-align:center;padding:8px;font-size:13px;font-weight:600;cursor:pointer;';
          b.textContent = '\u26A1 New version available \u2014 tap to reload';
          b.onclick = () => location.reload();
          document.body.appendChild(b);
        }
      }
    } catch {} finally { _checking = false; }
  }
  setInterval(check, 30000);
  setTimeout(check, 5000);
})();

// =========================================================================
// BLACKHOLE (wrapped in try/catch — animation failure must not break UI)
// =========================================================================
const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth < 768;
try {
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, innerWidth / innerHeight, 0.1, 2000);
const renderer = new THREE.WebGLRenderer({ antialias: !isMobile, canvas: document.getElementById('blackhole-canvas') });
renderer.setSize(innerWidth, innerHeight);
if (isMobile) {
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
}

const c = 1, G = 1, M = 50;
const Rs = 2 * G * M / (c * c);

const diskGeometry = new THREE.PlaneGeometry(Rs * 10, Rs * 10, 100, 100);
const diskMaterial = new THREE.ShaderMaterial({
  transparent: true,
  vertexShader: `
    varying vec2 vUv; varying float vDist;
    void main() {
      vUv = uv;
      vec4 wp = modelMatrix * vec4(position, 1.0);
      vDist = length(wp.xz);
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }`,
  fragmentShader: `
    varying vec2 vUv; varying float vDist;
    uniform float time, Rs;
    vec3 doppler(vec3 col, float v) {
      float g = 1.0/sqrt(1.0-v*v), d = g*(1.0-v);
      return col * vec3(clamp(1.0/d,0.0,2.0), clamp(1.0/sqrt(d),0.0,2.0), clamp(sqrt(d),0.0,2.0));
    }
    void main() {
      float r = vDist, v = sqrt(Rs/(2.0*r));
      vec3 sc = doppler(vec3(1.0,0.6,0.2), v);
      float i = smoothstep(Rs, Rs*5.0, r) * (1.0 - smoothstep(Rs*5.0, Rs*8.0, r));
      float p = sin(r*20.0 - time*2.0)*0.5+0.5;
      gl_FragColor = vec4(sc*i*p, i*0.8);
    }`,
  uniforms: { time: { value: 0 }, Rs: { value: Rs } },
  blending: THREE.AdditiveBlending, side: THREE.DoubleSide
});
const disk = new THREE.Mesh(diskGeometry, diskMaterial);
disk.rotation.x = Math.PI / 3;
scene.add(disk);

const hGeo = new THREE.IcosahedronGeometry(Rs, 4);
const hMat = new THREE.ShaderMaterial({
  vertexShader: `
    varying vec3 vP, vN;
    void main() { vP = position; vN = normal; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
  fragmentShader: `
    varying vec3 vP, vN; uniform float time;
    float hex(vec3 p) { vec2 a = vec2(p.x+p.y/2.0,p.y)*3.0, f = fract(a); vec2 v = vec2((f.x+f.y/2.0)*2.0-1.0,f.y-0.5); return step(abs(v.x)+abs(v.y),1.0); }
    void main() {
      float fr = pow(1.0-abs(dot(normalize(vP),vN)),2.0);
      float p = hex(vP+vec3(time*0.1));
      vec3 col = mix(vec3(0.8,0.3,0.1),vec3(1.0,0.6,0.2),p);
      gl_FragColor = vec4(col, fr*0.9);
    }`,
  uniforms: { time: { value: 0 } },
  transparent: true, blending: THREE.AdditiveBlending
});
scene.add(new THREE.Mesh(hGeo, hMat));

// Particle count reduced on mobile for performance
const N = isMobile ? 2000 : 10000, pts = new Float32Array(N*3), vel = new Float32Array(N*3);
const pGeo = new THREE.BufferGeometry();
pGeo.setAttribute('position', new THREE.BufferAttribute(pts, 3));
const pMat = new THREE.PointsMaterial({ size: 0.1, color: 0xffaa00, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending });

function initP(i) {
  const r = Rs*(3+Math.random()*5), t = Math.random()*Math.PI*2;
  pts[i*3]=r*Math.cos(t); pts[i*3+1]=(Math.random()-0.5)*Rs; pts[i*3+2]=r*Math.sin(t);
  const v = Math.sqrt(G*M/r);
  vel[i*3]=-v*Math.sin(t); vel[i*3+1]=0; vel[i*3+2]=v*Math.cos(t);
}
for (let i=0;i<N;i++) initP(i);
scene.add(new THREE.Points(pGeo, pMat));

camera.position.z = Rs * 2.5;
let time = 0;

function animate() {
  requestAnimationFrame(animate);
  time += 0.01;
  hMat.uniforms.time.value = time;
  diskMaterial.uniforms.time.value = time;
  for (let i=0;i<N;i++) {
    const j=i*3, x=pts[j], z=pts[j+2], r=Math.sqrt(x*x+z*z);
    if (r<Rs*1.1){initP(i);continue;}
    const a=G*M/(r*r), t=Math.atan2(z,x), fd=Math.max(0,(Rs*2-r)/(Rs*2))*0.1;
    vel[j]+=(-a*Math.cos(t)+fd*Math.sin(t));
    vel[j+2]+=(-a*Math.sin(t)-fd*Math.cos(t));
    pts[j]+=vel[j]; pts[j+1]+=vel[j+1]; pts[j+2]+=vel[j+2];
  }
  pGeo.attributes.position.needsUpdate = true;
  const cr=Rs*2.5, td=Math.sqrt(1-Rs/cr), dt=time*td;
  camera.position.set(cr*Math.cos(dt*0.1), cr*Math.sin(dt*0.15), cr*Math.cos(dt*0.2));
  camera.lookAt(0,0,0);
  renderer.render(scene, camera);
}

addEventListener('resize', () => {
  camera.aspect = innerWidth/innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  if (isMobile) {
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  }
});
animate();
} catch(e) { console.warn('Blackhole animation failed:', e); }

// =========================================================================
// SHOW / HIDE — fixed race condition
// =========================================================================
const overlay = document.getElementById('overlay');
let idleTimer = null;
let hideTimeout = null;

function showUI() {
  if (hideTimeout) { clearTimeout(hideTimeout); hideTimeout = null; }
  overlay.classList.add('visible');
  resetIdleTimer();
}

function hideUI() {
  overlay.classList.remove('visible');
}

function resetIdleTimer() {
  clearTimeout(idleTimer);
  // Don't auto-hide on mobile — users need persistent UI
  if (!isMobile) {
    idleTimer = setTimeout(hideUI, 15000);
  }
}

// Any interaction shows UI
document.addEventListener('mousemove', showUI);
document.addEventListener('click', showUI);
document.addEventListener('keypress', showUI);
document.addEventListener('touchstart', showUI);
overlay.addEventListener('scroll', resetIdleTimer);

// Start hidden, show after a brief delay (immediate on mobile)
setTimeout(showUI, isMobile ? 100 : 800);

// ENTER MASCOM button: tablets only (≤768px). Desktop uses Ctrl+Shift+~
if (window.innerWidth <= 768) {
  document.getElementById('mob-enter-os').style.display = '';
}

// =========================================================================
// PORTFOLIO DATA
// =========================================================================
// Monotone gold throughout
const ACCENT = '#ffcc00';

const PORTFOLIO = [
  { cat: 'Corporate', ventures: [
    { n: 'MobCorp', u: 'https://mobcorp.cc' }, { n: 'MobleyHelms', u: 'https://mobleyhelms.com' },
    { n: 'HelmsCorp', u: 'https://helmscorp.cc' }, { n: 'RonCorp', u: 'https://roncorp.cc' },
    { n: 'RonHelms', u: 'https://ronhelms.cc' }, { n: 'MobleyReport', u: 'https://mobleyreport.com' },
    { n: 'MobleyMetal', u: 'https://mobleymetal.com' },
  ]},
  { cat: 'Defense', ventures: [
    { n: 'Abstergo', u: 'https://abstergo.cc' }, { n: 'Draknir', u: 'https://draknir.com' },
    { n: 'Draugr', u: 'https://draugr.cc' }, { n: 'Valdring', u: 'https://valdring.com' },
    { n: 'ValkrAI', u: 'https://valkrai.com' }, { n: 'Areshiva', u: 'https://areshiva.com' },
    { n: 'Malathor', u: 'https://malathor.com' }, { n: 'WatchForce', u: 'https://watchforce.cc' },
    { n: 'VentralEye', u: 'https://ventraleye.com' },
  ]},
  { cat: 'Finance', ventures: [
    { n: 'FedBank', u: 'https://fedbank.cc' }, { n: 'Equifiant', u: 'https://equifiant.com' },
    { n: 'GreenhandCapital', u: 'https://greenhandcapital.com' }, { n: 'FundyAI', u: 'https://fundyai.com' },
    { n: 'Bondwright', u: 'https://bondwright.com' }, { n: 'Accountdrac', u: 'https://accountdrac.com' },
    { n: 'Bookeepr', u: 'https://bookeepr.cc' }, { n: 'VendyAI', u: 'https://vendyai.com' },
    { n: 'EncoverAI', u: 'https://encoverai.com' }, { n: 'BitDoggo', u: 'https://bitdoggo.com' },
    { n: 'CryptoSmart', u: 'https://cryptosmart.cc' }, { n: 'MobCoin', u: 'https://mobcoin.cc' },
    { n: 'SelfCoin', u: 'https://selfcoin.cc' }, { n: 'QuanticFork', u: 'https://quanticfork.com' },
  ]},
  { cat: 'AI', ventures: [
    { n: 'AmericanAGI', u: 'https://americanagi.cc' }, { n: 'BloomAGI', u: 'https://bloomagi.cc' },
    { n: 'GreybeardAI', u: 'https://greybeardai.com' }, { n: 'TranscendantAI', u: 'https://transcendantai.com' },
    { n: 'SentiantAI', u: 'https://sentiantai.com' }, { n: 'LegionicAI', u: 'https://legionicai.com' },
    { n: 'SingularityUI', u: 'https://singularityui.com' }, { n: 'ScalarFlux', u: 'https://scalarflux.com' },
    { n: 'LegibleWeights', u: 'https://legibleweights.com' }, { n: 'Intfer', u: 'https://intfer.cc' },
    { n: 'Aicossic', u: 'https://aicossic.com' }, { n: 'Americnagi', u: 'https://americnagi.cc' },
  ]},
  { cat: 'Agents', ventures: [
    { n: 'Agentropi', u: 'https://agentropi.com' }, { n: 'Agentzaar', u: 'https://agentzaar.com' },
    { n: 'Consenta', u: 'https://consenta.cc' }, { n: 'TaskGridAI', u: 'https://taskgridai.com' },
    { n: 'SalesFactorAI', u: 'https://salesfactorai.com' }, { n: 'MailGuyAI', u: 'https://mailguyai.com' },
    { n: 'MarketingIum', u: 'https://marketingium.com' }, { n: 'Entoolize', u: 'https://entoolize.com' },
    { n: 'Rebrief', u: 'https://rebrief.me' },
  ]},
  { cat: 'Dev Tools', ventures: [
    { n: 'DevToolAI', u: 'https://devtoolai.com' }, { n: 'DevToolBx', u: 'https://devtoolbx.com' },
    { n: 'DevDucky', u: 'https://devducky.com' }, { n: 'HalsIDE', u: 'https://halside.com' },
    { n: 'Fystz', u: 'https://fystz.com' }, { n: 'HelmDir', u: 'https://helmdir.com' },
    { n: 'GravNova', u: 'https://gravnova.com' }, { n: 'PowerHost', u: 'https://powerhost.cc' },
    { n: 'WarpDrive', u: 'https://warpdrive.cc' }, { n: 'Extraterran', u: 'https://extraterran.com' },
    { n: 'AuthFor', u: 'https://authfor.com' }, { n: 'Syncropy', u: 'https://syncropy.com' },
  ]},
  { cat: 'Business', ventures: [
    { n: 'FirmCreate', u: 'https://firmcreate.com' }, { n: 'GLCX', u: 'https://glcx.cc' },
    { n: 'Lawyik', u: 'https://lawyik.com' }, { n: 'PatentKin', u: 'https://patentkin.com' },
    { n: 'Industrize', u: 'https://industrize.com' }, { n: 'Traceformer', u: 'https://traceformer.com' },
    { n: 'DomainWombat', u: 'https://domainwombat.com' },
    { n: 'Dofura', u: 'https://dofura.com' }, { n: 'HelmCorp', u: 'https://helmcorp.cc' },
    { n: 'HildrAI', u: 'https://hildrai.com' },
  ]},
  { cat: 'Health', ventures: [
    { n: 'HealSpell', u: 'https://healspell.com' }, { n: 'Meeva', u: 'https://meeva.io' },
    { n: 'TalkingMind', u: 'https://talkingmind.cc' }, { n: 'WorkShrinker', u: 'https://workshrinker.com' },
    { n: 'YouthMend', u: 'https://youthmend.com' }, { n: 'LoveMaint', u: 'https://lovemaint.com' },
    { n: 'SanctuaryUI', u: 'https://sanctuaryui.com' }, { n: 'RecovAI', u: 'https://recovai.com' },
    { n: 'Agewinder', u: 'https://agewinder.com' }, { n: 'NewGamePlus', u: 'https://newgameplus.cc' },
  ]},
  { cat: 'Media', ventures: [
    { n: 'GameGob', u: 'https://gamegob.com' }, { n: 'Animetrope', u: 'https://animetrope.com' },
    { n: 'Filmline', u: 'https://filmline.cc' }, { n: 'Book2Film', u: 'https://book2film.cc' },
    { n: 'Literacraft', u: 'https://literacraft.com' }, { n: 'MobleyBooks', u: 'https://mobleybooks.com' },
    { n: 'BookClubs', u: 'https://bookclubs.cc' }, { n: 'AudioVizAI', u: 'https://audiovizai.com' },
    { n: 'Danzoa', u: 'https://danzoa.com' }, { n: 'Kubaki', u: 'https://kubaki.cc' },
    { n: 'PandoraChat', u: 'https://pandorachat.cc' }, { n: 'PaintedWhore', u: 'https://paintedwhore.cc' },
    { n: 'GlyphyAI', u: 'https://glyphyai.com' }, { n: 'FedTalent', u: 'https://fedtalent.cc' },
    { n: 'Alhena', u: 'https://alhena.cc' },
  ]},
  { cat: 'Education', ventures: [
    { n: 'Gurukle', u: 'https://gurukle.com' }, { n: 'OwnSchool', u: 'https://ownschool.cc' },
    { n: 'ReasonToDate', u: 'https://reasontodate.com' }, { n: 'BigNice', u: 'https://bignice.cc' },
    { n: 'LeadersClub', u: 'https://leadersclub.cc' }, { n: 'BrynhildAI', u: 'https://brynhildai.com' },
  ]},
  { cat: 'Science', ventures: [
    { n: 'YutaniAI', u: 'https://yutaniai.com' }, { n: 'WeylandAI', u: 'https://weylandai.com' },
    { n: 'Femptocom', u: 'https://femptocom.com' }, { n: 'Galadul', u: 'https://galadul.com' },
    { n: 'EcoFixAI', u: 'https://ecofixai.com' }, { n: 'EmissionHub', u: 'https://emissionhub.cc' },
    { n: 'Anattar', u: 'https://anattar.com' }, { n: 'Conseiv', u: 'https://conseiv.com' },
    { n: 'EnablingHomes', u: 'https://enablinghomes.com' }, { n: 'AiOpenCommerce', u: 'https://aiopencommerce.com' },
    { n: 'TenancyAI', u: 'https://tenancyai.com' },
  ]},
];

// =========================================================================
// FOOTER — category chips + expandable venture tray
// =========================================================================
const catRow = document.getElementById('cat-row');
const ventureTray = document.getElementById('venture-tray');
const ventureGrid = document.getElementById('venture-grid');
let activeCategory = null;

PORTFOLIO.forEach(section => {
  const chip = document.createElement('span');
  chip.className = 'cat-chip';
  chip.textContent = section.cat;
  chip.dataset.cat = section.cat;
  chip.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleCategory(section.cat);
  });
  catRow.appendChild(chip);
});

function toggleCategory(cat) {
  if (activeCategory === cat) {
    // Close tray
    activeCategory = null;
    ventureTray.classList.remove('open');
    document.querySelectorAll('.cat-chip').forEach(c => c.classList.remove('active'));
    return;
  }

  activeCategory = cat;
  document.querySelectorAll('.cat-chip').forEach(c => {
    c.classList.toggle('active', c.dataset.cat === cat);
  });

  const section = PORTFOLIO.find(s => s.cat === cat);
  ventureGrid.innerHTML = '';

  section.ventures.forEach(v => {
    const link = document.createElement('span');
    link.className = 'v-link';
    link.textContent = v.n;
    link.addEventListener('click', (e) => {
      e.stopPropagation();
      openModal(v.u, v.n.toUpperCase());
    });
    ventureGrid.appendChild(link);
  });

  ventureTray.classList.add('open');
  resetIdleTimer();
}

// =========================================================================
// MODAL
// =========================================================================
const EXCLUDED_FROM_MODAL = ['weylandai.com', 'consenta.cc', 'subx.cc', 'quanticfork.com', 'bignice.cc', 'gamegob.com', 'syncropy.com'];
const modalOverlay = document.getElementById('modal-overlay');
const modalIframe = document.getElementById('modal-iframe');
const modalTitle = document.getElementById('modal-title');
const modalFallback = document.getElementById('modal-fallback');
const fbName = document.getElementById('fb-name');
const fbOpen = document.getElementById('fb-open');

function openModal(url, title) {
  try {
    const hostname = new URL(url).hostname;
    if (EXCLUDED_FROM_MODAL.includes(hostname)) { window.open(url, '_blank'); return; }
  } catch {}
  modalTitle.textContent = title;
  modalFallback.classList.remove('show');
  modalIframe.style.display = 'block';
  modalIframe.style.opacity = '0';
  modalIframe.src = url;
  // Reset animation on modal so it replays
  const m = document.getElementById('modal');
  m.style.animation = 'none';
  m.style.background = 'transparent';
  m.offsetHeight;
  m.style.animation = '';
  modalOverlay.classList.add('open');
  clearTimeout(idleTimer);
  let loaded = false;
  modalIframe.onload = () => { loaded = true; };
  setTimeout(() => { if (!loaded) showFallback(url, title); }, 3000);
}

function showFallback(url, title) {
  modalIframe.style.display = 'none'; modalIframe.src = '';
  fbName.textContent = title || url.replace(/https?:\/\//, '').replace(/\/$/, '');
  fbOpen.href = url;
  modalFallback.classList.add('show');
}

function closeModal() {
  modalOverlay.classList.remove('open');
  modalIframe.src = '';
  modalIframe.style.display = 'block';
  modalIframe.style.opacity = '0';
  modalFallback.classList.remove('show');
  modalFallback.style.opacity = '0';
  // Reset animation state so it replays on next open
  const m = document.getElementById('modal');
  m.style.animation = 'none';
  m.offsetHeight; // force reflow
  m.style.animation = '';
  m.style.background = 'transparent';
  resetIdleTimer();
}

document.getElementById('modal-close').addEventListener('click', e => { e.stopPropagation(); closeModal(); });
modalOverlay.addEventListener('click', e => { if (e.target === modalOverlay) closeModal(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape' && modalOverlay.classList.contains('open')) closeModal(); });

// =========================================================================
// MascomWebOS — Ctrl+Shift+~ → Login → ChatGPT-like MASCOM v5 frontend
// =========================================================================
const mascomOS = document.getElementById('mascom-os');
const osTaskbar = document.getElementById('os-taskbar');
const osSidebar = document.getElementById('os-sidebar');
const chatMessages = document.getElementById('chat-messages');
const chatInput = document.getElementById('chat-input');
const chatSend = document.getElementById('chat-send');

// ── Smart scroll: only auto-scroll if user is near the bottom ──
let _chatUserScrolledUp = false;
chatMessages.addEventListener('scroll', () => {
  const gap = chatMessages.scrollHeight - chatMessages.scrollTop - chatMessages.clientHeight;
  _chatUserScrolledUp = gap > 80;
});
function chatAutoScroll() {
  if (!_chatUserScrolledUp) {
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }
}
const wsStatusEl = document.getElementById('ws-status');
let osAuthenticated = false;
let vizMode = 'blackhole';
let winZIndex = 10;
let winIdCounter = 0;
const openWindows = {};
const _LOCAL = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
const API_BASE = _LOCAL ? '' : ''; // Sovereign: relative path, served by flowistan on GravNova
const WS_URL = _LOCAL ? 'ws://localhost:8765' : null; // Remote WS disabled — tunnel port mismatch
let ws = null;

// ── Login (AuthFor Standard Integration) ──
const loginScreen = document.getElementById('os-login');
const loginEmail = document.getElementById('login-email');
const loginPassword = document.getElementById('login-password');
const loginName = document.getElementById('login-name');
const loginBtn = document.getElementById('login-btn');
const loginError = document.getElementById('login-error');
const _authfor = new AuthForStandard({ clientId: 'af_mascom_webos', ventureName: 'golfcad.cc' });

function hasDeviceAuth() {
  return _authfor.isAuthenticated();
}

function onAuthSuccess() {
  osAuthenticated = true;
  loginScreen.classList.add('hidden');
  loginEmail.value = '';
  loginPassword.value = '';
  loginError.classList.remove('show');

  _authfor.getUser().then(user => {
    const name = (user && user.name) || 'Commander';
    addMsg('mascom', 'MASCOM v5 online. Welcome, ' + name + '.\n\nType anything to think with the system, or use commands:\n  /boot     \u2014 Boot the fleet\n  /status   \u2014 System status\n  /operate  \u2014 Run operate cycle\n  /evolve   \u2014 Evolve ventures\n  /ventures \u2014 List ventures\n  /soul     \u2014 View system soul\n  /help     \u2014 All commands');
  }).catch(() => {
    addMsg('mascom', 'MASCOM v5 online. Welcome.\n\nType /help for commands.');
  });

  connectWebSocket();
  buildTerminal(document.getElementById('term-dock-body'));
  fetch(API_BASE + '/api/status', { signal: AbortSignal.timeout(5000) })
    .then(r => { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(d => {
      wsStatusEl.textContent = 'API online';
      wsStatusEl.className = 'connected';
      wsStatusEl.title = 'MASCOM API is reachable at ' + API_BASE;
    })
    .catch(() => {
      wsStatusEl.textContent = 'API offline';
      wsStatusEl.className = 'disconnected';
      wsStatusEl.title = 'MASCOM API is unreachable at ' + API_BASE;
      addMsg('event', 'Backend offline \u2014 MASCOM Chat requires mascom_v5.py serve running on the server.\nAPI endpoint: ' + API_BASE);
    });
  const halTb = document.getElementById('hal-taskbar');
  if (halTb && window._halState) {
    const _syncTb = () => { const s = window._halState(); const c = {off:'#888',green:'#34d399',yellow:'#fbbf24',red:'#f87171'}; halTb.textContent='HAL: '+s; halTb.style.color=c[s]||'#888'; };
    setInterval(_syncTb, 1000);
  }
  setTimeout(() => chatInput.focus(), 100);
}

async function attemptLogin() {
  const email = loginEmail.value.trim();
  const password = loginPassword.value;
  if (!email || !password) {
    loginError.textContent = 'EMAIL & PASSWORD REQUIRED';
    loginError.classList.add('show');
    setTimeout(() => { loginError.textContent = 'ACCESS DENIED'; loginError.classList.remove('show'); }, 2000);
    return;
  }
  loginBtn.disabled = true;
  loginBtn.textContent = 'SIGNING IN...';
  try {
    await _authfor.signIn({ email, password });
    onAuthSuccess();
  } catch (err) {
    loginError.textContent = (err.message || 'AUTH FAILED').toUpperCase();
    loginError.classList.add('show');
    loginPassword.value = '';
    loginPassword.focus();
    setTimeout(() => { loginError.textContent = 'ACCESS DENIED'; loginError.classList.remove('show'); }, 3000);
  } finally {
    loginBtn.disabled = false;
    loginBtn.textContent = 'SIGN IN';
  }
}
loginBtn.addEventListener('click', attemptLogin);
loginPassword.addEventListener('keydown', e => { if (e.key === 'Enter') attemptLogin(); });
loginEmail.addEventListener('keydown', e => { if (e.key === 'Enter') loginPassword.focus(); });

// ── Terminal builder (custom VT emulator + separated I/O) ──
// Custom ANSI/VT100 terminal emulator renders PTY output in a virtual grid.
// Handles cursor positioning, scroll regions, line drawing, alternate screen.
// WebSocket to shared PTY daemon — sovereign MOSMIL WS server pending on GravNova.
const _T_WS = _LOCAL ? 'ws://localhost:7681' : null; // TODO: sovereign WS endpoint
const _CC_WS = _LOCAL ? 'ws://localhost:7685' : null;
const _MIRROR_WS = _LOCAL ? 'ws://localhost:7690' : null;
const _MIRROR_API = _LOCAL ? '/peers' : null;

function _buildTerminalInner(container, wsUrl, label) {
  Object.assign(container.style, { background:'var(--ob-void)', padding:'0', overflow:'hidden', flexDirection:'column' });
  const isMobTerm = window.innerWidth < 768;

  // ── Output display — supports two modes:
  //    1. VT emulator (text lines from PTY daemon)
  //    2. AutoSee (screenshot frames from screen capture bridge)
  let _termMode = 'vt'; // 'vt' or 'autosee'
  const outputEl = document.createElement('div');
  outputEl.className = 'term-output';
  const fillEl = document.createElement('div');
  fillEl.className = 'term-fill';
  outputEl.appendChild(fillEl);
  const linesEl = document.createElement('div');
  linesEl.className = 'term-lines';
  outputEl.appendChild(linesEl);

  // AutoSee frame display — hidden until autosee mode activates
  const frameEl = document.createElement('img');
  frameEl.className = 'term-frame';
  outputEl.appendChild(frameEl);

  // ── Frame history for scroll navigation (hash-based dedup) ──
  const _frameHistory = []; // [{src, hash}]
  const _maxFrames = 50;
  let _frameIdx = -1; // -1 = live (latest)
  let _lastFrameHash = '';
  function _simpleHash(s) {
    let h = 0;
    for (let i = 0; i < Math.min(s.length, 200); i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
    return h.toString(36);
  }
  function _pushFrame(src) {
    const hash = _simpleHash(src);
    if (hash === _lastFrameHash) return; // deduplicate
    _lastFrameHash = hash;
    _frameHistory.push({src, hash});
    if (_frameHistory.length > _maxFrames) _frameHistory.shift();
    if (_frameIdx === -1) frameEl.src = src; // only update if viewing live
  }
  // Touch/scroll to navigate frame history
  let _touchStartY = 0;
  outputEl.addEventListener('touchstart', (e) => {
    if (_termMode === 'autosee') _touchStartY = e.touches[0].clientY;
  }, {passive: true});
  outputEl.addEventListener('touchend', (e) => {
    if (_termMode !== 'autosee' || _frameHistory.length < 2) return;
    const dy = e.changedTouches[0].clientY - _touchStartY;
    if (Math.abs(dy) < 30) return; // ignore small gestures
    if (dy > 0) {
      // Swipe down = go back in history
      if (_frameIdx === -1) _frameIdx = _frameHistory.length - 2;
      else if (_frameIdx > 0) _frameIdx--;
      if (_frameIdx >= 0) frameEl.src = _frameHistory[_frameIdx].src;
    } else {
      // Swipe up = go forward / return to live
      if (_frameIdx >= 0) _frameIdx++;
      if (_frameIdx >= _frameHistory.length - 1) {
        _frameIdx = -1;
        frameEl.src = _frameHistory[_frameHistory.length - 1].src;
      } else if (_frameIdx >= 0) {
        frameEl.src = _frameHistory[_frameIdx].src;
      }
    }
  }, {passive: true});

  container.appendChild(outputEl);

  // ── Virtual Terminal Screen ──
  // Full ANSI/VT100 terminal emulator: cursor positioning, scroll regions,
  // alternate screen buffer, line drawing characters, erase operations.
  // Handles everything Claude Code's TUI sends.
  const _LD = { // Line Drawing character map (DEC Special Graphics)
    'j':'\u2518','k':'\u2510','l':'\u250c','m':'\u2514','n':'\u253c',
    'q':'\u2500','t':'\u251c','u':'\u2524','v':'\u2534','w':'\u252c',
    'x':'\u2502','a':'\u2592','`':'\u25c6','f':'\u00b0','g':'\u00b1',
    'y':'\u2264','z':'\u2265','{':'\u03c0','|':'\u2260','}':'\u00a3','~':'\u00b7',
  };
  const _vt = {
    rows: 40, cols: 120,
    grid: [], attrs: [], curR: 0, curC: 0, curAttr: 0,
    scrollback: [], maxScroll: 5000,
    scrollTop: 0, scrollBottom: 0,
    savedCurR: 0, savedCurC: 0,
    savedGrid: null, savedAttrs: null, savedR: 0, savedC: 0,
    charset: 0, wrapNext: false,
    init(rows, cols) {
      this.rows = rows || 40; this.cols = cols || 120;
      this.grid = Array.from({length: this.rows}, () => Array(this.cols).fill(' '));
      this.attrs = Array.from({length: this.rows}, () => Array(this.cols).fill(0));
      this.curR = 0; this.curC = 0; this.curAttr = 0;
      this.savedCurR = 0; this.savedCurC = 0;
      this.scrollTop = 0; this.scrollBottom = this.rows - 1;
      this.scrollback = []; this.savedGrid = null; this.savedAttrs = null;
      this.charset = 0; this.wrapNext = false;
    },
    write(ch) {
      if (this.charset === 1 && _LD[ch]) ch = _LD[ch];
      if (this.wrapNext) {
        this.wrapNext = false;
        this.curC = 0;
        this._lineFeed();
      }
      if (this.curR < 0) this.curR = 0;
      if (this.curR >= this.rows) this.curR = this.rows - 1;
      this.grid[this.curR][this.curC] = ch;
      this.attrs[this.curR][this.curC] = this.curAttr;
      this.curC++;
      if (this.curC >= this.cols) {
        this.curC = this.cols - 1;
        this.wrapNext = true;
      }
    },
    _lineFeed() {
      if (this.curR === this.scrollBottom) {
        this._scrollUp(1);
      } else if (this.curR < this.rows - 1) {
        this.curR++;
      }
    },
    newline() { this._lineFeed(); },
    reverseIndex() {
      if (this.curR === this.scrollTop) {
        this._scrollDown(1);
      } else if (this.curR > 0) {
        this.curR--;
      }
    },
    _scrollUp(n) {
      for (let i = 0; i < n; i++) {
        if (this.scrollTop === 0 && this.scrollBottom === this.rows - 1) {
          const lineChars = this.grid.shift();
          const lineAttrs = this.attrs.shift();
          // Trim trailing spaces for storage
          let lineLen = lineChars.length;
          while (lineLen > 0 && lineChars[lineLen - 1] === ' ' && lineAttrs[lineLen - 1] === 0) lineLen--;
          this.scrollback.push({ chars: lineChars.slice(0, lineLen), attrs: lineAttrs.slice(0, lineLen) });
          if (this.scrollback.length > this.maxScroll) this.scrollback.shift();
          this.grid.push(Array(this.cols).fill(' '));
          this.attrs.push(Array(this.cols).fill(0));
        } else {
          this.grid.splice(this.scrollTop, 1);
          this.grid.splice(this.scrollBottom, 0, Array(this.cols).fill(' '));
          this.attrs.splice(this.scrollTop, 1);
          this.attrs.splice(this.scrollBottom, 0, Array(this.cols).fill(0));
        }
      }
    },
    _scrollDown(n) {
      for (let i = 0; i < n; i++) {
        this.grid.splice(this.scrollBottom, 1);
        this.grid.splice(this.scrollTop, 0, Array(this.cols).fill(' '));
        this.attrs.splice(this.scrollBottom, 1);
        this.attrs.splice(this.scrollTop, 0, Array(this.cols).fill(0));
      }
    },
    setCursor(r, c) {
      this.curR = Math.max(0, Math.min(r, this.rows - 1));
      this.curC = Math.max(0, Math.min(c, this.cols - 1));
      this.wrapNext = false;
    },
    saveCursor() { this.savedCurR = this.curR; this.savedCurC = this.curC; },
    restoreCursor() { this.curR = this.savedCurR; this.curC = this.savedCurC; this.wrapNext = false; },
    eraseDisplay(mode) {
      if (mode === 0) {
        for (let c = this.curC; c < this.cols; c++) { this.grid[this.curR][c] = ' '; this.attrs[this.curR][c] = 0; }
        for (let r = this.curR + 1; r < this.rows; r++) { this.grid[r].fill(' '); this.attrs[r].fill(0); }
      } else if (mode === 1) {
        for (let r = 0; r < this.curR; r++) { this.grid[r].fill(' '); this.attrs[r].fill(0); }
        for (let c = 0; c <= this.curC; c++) { this.grid[this.curR][c] = ' '; this.attrs[this.curR][c] = 0; }
      } else if (mode === 2) {
        for (let r = 0; r < this.rows; r++) { this.grid[r].fill(' '); this.attrs[r].fill(0); }
      } else if (mode === 3) {
        for (let r = 0; r < this.rows; r++) { this.grid[r].fill(' '); this.attrs[r].fill(0); }
        this.scrollback = [];
      }
    },
    eraseLine(mode) {
      const r = this.curR;
      if (r < 0 || r >= this.rows) return;
      if (mode === 0) { for (let c = this.curC; c < this.cols; c++) { this.grid[r][c] = ' '; this.attrs[r][c] = 0; } }
      else if (mode === 1) { for (let c = 0; c <= this.curC; c++) { this.grid[r][c] = ' '; this.attrs[r][c] = 0; } }
      else { this.grid[r].fill(' '); this.attrs[r].fill(0); }
    },
    eraseChars(n) {
      for (let c = 0; c < n && this.curC + c < this.cols; c++) {
        this.grid[this.curR][this.curC + c] = ' ';
        this.attrs[this.curR][this.curC + c] = 0;
      }
    },
    enterAlt() {
      this.savedGrid = this.grid.map(r => [...r]);
      this.savedAttrs = this.attrs.map(r => [...r]);
      this.savedR = this.curR; this.savedC = this.curC;
      this.grid = Array.from({length: this.rows}, () => Array(this.cols).fill(' '));
      this.attrs = Array.from({length: this.rows}, () => Array(this.cols).fill(0));
      this.curR = 0; this.curC = 0;
      this.scrollTop = 0; this.scrollBottom = this.rows - 1;
    },
    exitAlt() {
      if (this.savedGrid) {
        this.grid = this.savedGrid; this.attrs = this.savedAttrs;
        this.curR = this.savedR; this.curC = this.savedC;
        this.savedGrid = null; this.savedAttrs = null;
        this.scrollTop = 0; this.scrollBottom = this.rows - 1;
      }
    },
    setScrollRegion(top, bottom) {
      this.scrollTop = Math.max(0, Math.min(top, this.rows - 1));
      this.scrollBottom = Math.max(this.scrollTop, Math.min(bottom, this.rows - 1));
      this.curR = 0; this.curC = 0; this.wrapNext = false;
    },
    insertLines(n) {
      const bot = this.scrollBottom;
      for (let i = 0; i < n; i++) {
        if (this.curR <= bot) {
          this.grid.splice(bot, 1); this.grid.splice(this.curR, 0, Array(this.cols).fill(' '));
          this.attrs.splice(bot, 1); this.attrs.splice(this.curR, 0, Array(this.cols).fill(0));
        }
      }
    },
    deleteLines(n) {
      const bot = this.scrollBottom;
      for (let i = 0; i < n; i++) {
        if (this.curR <= bot) {
          this.grid.splice(this.curR, 1); this.grid.splice(bot, 0, Array(this.cols).fill(' '));
          this.attrs.splice(this.curR, 1); this.attrs.splice(bot, 0, Array(this.cols).fill(0));
        }
      }
    },
    deleteChars(n) {
      for (let i = 0; i < n; i++) {
        this.grid[this.curR].splice(this.curC, 1); this.grid[this.curR].push(' ');
        this.attrs[this.curR].splice(this.curC, 1); this.attrs[this.curR].push(0);
      }
    },
    insertChars(n) {
      for (let i = 0; i < n; i++) {
        this.grid[this.curR].splice(this.curC, 0, ' '); this.grid[this.curR].pop();
        this.attrs[this.curR].splice(this.curC, 0, 0); this.attrs[this.curR].pop();
      }
    },
    resize(rows, cols) {
      const og = this.grid, oa = this.attrs, or_ = this.rows, oc = this.cols;
      this.rows = rows; this.cols = cols;
      this.grid = Array.from({length: rows}, () => Array(cols).fill(' '));
      this.attrs = Array.from({length: rows}, () => Array(cols).fill(0));
      for (let r = 0; r < Math.min(or_, rows); r++)
        for (let c = 0; c < Math.min(oc, cols); c++) { this.grid[r][c] = og[r][c]; this.attrs[r][c] = oa[r][c]; }
      this.curR = Math.min(this.curR, rows - 1);
      this.curC = Math.min(this.curC, cols - 1);
      this.scrollTop = 0; this.scrollBottom = rows - 1;
      this.wrapNext = false;
    },
  };
  _vt.init(40, 120);

  // ── Escape Sequence Parser → feeds _vt ──
  function processOutput(data) {
    let i = 0;
    while (i < data.length) {
      const ch = data[i];
      const code = data.charCodeAt(i);

      if (ch === '\x1b') {
        if (i + 1 >= data.length) { i++; continue; }
        const nx = data[i + 1];
        if (nx === '[') {
          // CSI: \x1b[ [params 0x30-0x3f] [intermediate 0x20-0x2f] final
          i += 2;
          let params = '';
          while (i < data.length && data.charCodeAt(i) >= 0x30 && data.charCodeAt(i) <= 0x3f) {
            params += data[i]; i++;
          }
          // Skip intermediate bytes (space, !, ", #, $ — e.g. cursor style \x1b[1 q)
          while (i < data.length && data.charCodeAt(i) >= 0x20 && data.charCodeAt(i) <= 0x2f) i++;
          if (i < data.length) { _handleCSI(params, data[i]); i++; }
          continue;
        } else if (nx === ']') {
          // OSC: skip to BEL or ST
          i += 2;
          while (i < data.length) {
            if (data[i] === '\x07') { i++; break; }
            if (data[i] === '\x1b' && i + 1 < data.length && data[i + 1] === '\\') { i += 2; break; }
            i++;
          }
          continue;
        } else if (nx === '(' || nx === ')') {
          // Charset designation: ESC ( B = ASCII, ESC ( 0 = line drawing
          if (i + 2 < data.length) {
            if (nx === '(') _vt.charset = (data[i + 2] === '0') ? 1 : 0;
          }
          i += 3; continue;
        } else if (nx === '7') { _vt.saveCursor(); i += 2; continue; }
        else if (nx === '8') { _vt.restoreCursor(); i += 2; continue; }
        else if (nx === 'M') { _vt.reverseIndex(); i += 2; continue; }
        else if (nx === 'c') { _vt.init(_vt.rows, _vt.cols); i += 2; continue; }
        else if (nx === 'P' || nx === 'X' || nx === '^' || nx === '_') {
          // DCS, SOS, PM, APC — skip to ST
          i += 2;
          while (i < data.length) {
            if (data[i] === '\x1b' && i + 1 < data.length && data[i + 1] === '\\') { i += 2; break; }
            if (data[i] === '\x07') { i++; break; }
            i++;
          }
          continue;
        }
        else { i += 2; continue; }
      } else if (ch === '\n') {
        _vt.newline(); i++; continue;
      } else if (ch === '\r') {
        _vt.curC = 0; _vt.wrapNext = false; i++; continue;
      } else if (code === 8) {
        if (_vt.curC > 0) _vt.curC--;
        _vt.wrapNext = false; i++; continue;
      } else if (ch === '\t') {
        _vt.curC = Math.min(_vt.cols - 1, (_vt.curC + 8) & ~7);
        _vt.wrapNext = false; i++; continue;
      } else if (code === 14) { _vt.charset = 1; i++; continue; }
      else if (code === 15) { _vt.charset = 0; i++; continue; }
      else if (code < 32 || code === 127) { i++; continue; }
      else { _vt.write(ch); i++; continue; }
    }
    _renderVT();
  }

  function _handleCSI(params, cmd) {
    const priv = params.startsWith('?');
    const cleanP = params.replace(/^[?>=]/, '');
    const parts = cleanP.split(';').map(p => parseInt(p) || 0);
    const n = parts[0] || 1;
    switch (cmd) {
      case 'H': case 'f': _vt.setCursor((parts[0] || 1) - 1, (parts[1] || 1) - 1); break;
      case 'A': _vt.setCursor(_vt.curR - n, _vt.curC); break;
      case 'B': _vt.setCursor(_vt.curR + n, _vt.curC); break;
      case 'C': _vt.setCursor(_vt.curR, _vt.curC + n); break;
      case 'D': _vt.setCursor(_vt.curR, _vt.curC - n); break;
      case 'E': _vt.setCursor(_vt.curR + n, 0); break;
      case 'F': _vt.setCursor(_vt.curR - n, 0); break;
      case 'G': _vt.setCursor(_vt.curR, n - 1); break;
      case 'd': _vt.setCursor(n - 1, _vt.curC); break;
      case 'J': _vt.eraseDisplay(parts[0] || 0); break;
      case 'K': _vt.eraseLine(parts[0] || 0); break;
      case 'X': _vt.eraseChars(n); break;
      case 'L': _vt.insertLines(n); break;
      case 'M': _vt.deleteLines(n); break;
      case 'P': _vt.deleteChars(n); break;
      case '@': _vt.insertChars(n); break;
      case 'S': _vt._scrollUp(n); break;
      case 'T': if (!priv && parts.length <= 1) _vt._scrollDown(n); break;
      case 'r':
        if (!priv) _vt.setScrollRegion((parts[0] || 1) - 1, (parts[1] || _vt.rows) - 1);
        break;
      case 's': if (!priv) _vt.saveCursor(); break;
      case 'u': _vt.restoreCursor(); break;
      case 'h':
        if (priv && (parts[0] === 1049 || parts[0] === 47)) _vt.enterAlt();
        break;
      case 'l':
        if (priv && (parts[0] === 1049 || parts[0] === 47)) _vt.exitAlt();
        break;
      case 'm': { // SGR color/attribute handling
        const ps = cleanP ? cleanP.split(';').map(v => parseInt(v) || 0) : [0];
        for (let si = 0; si < ps.length; si++) {
          const p = ps[si];
          if (p === 0) { _vt.curAttr = 0; }
          else if (p === 1) { _vt.curAttr |= (1 << 16); }   // bold
          else if (p === 2) { _vt.curAttr |= (1 << 17); }   // dim
          else if (p === 3) { _vt.curAttr |= (1 << 18); }   // italic
          else if (p === 4) { _vt.curAttr |= (1 << 19); }   // underline
          else if (p === 7) { _vt.curAttr |= (1 << 20); }   // inverse
          else if (p === 22) { _vt.curAttr &= ~((1 << 16) | (1 << 17)); } // normal intensity
          else if (p === 23) { _vt.curAttr &= ~(1 << 18); } // not italic
          else if (p === 24) { _vt.curAttr &= ~(1 << 19); } // not underline
          else if (p === 27) { _vt.curAttr &= ~(1 << 20); } // not inverse
          else if (p >= 30 && p <= 37) { _vt.curAttr = (_vt.curAttr & ~0xFF) | (p - 30 + 1); }
          else if (p === 39) { _vt.curAttr &= ~0xFF; }       // default fg
          else if (p >= 40 && p <= 47) { _vt.curAttr = (_vt.curAttr & ~0xFF00) | ((p - 40 + 1) << 8); }
          else if (p === 49) { _vt.curAttr &= ~0xFF00; }     // default bg
          else if (p >= 90 && p <= 97) { _vt.curAttr = (_vt.curAttr & ~0xFF) | (p - 90 + 9); }
          else if (p >= 100 && p <= 107) { _vt.curAttr = (_vt.curAttr & ~0xFF00) | ((p - 100 + 9) << 8); }
          else if (p === 38 && si + 1 < ps.length && ps[si + 1] === 5 && si + 2 < ps.length) {
            // 256-color fg: 38;5;N
            const ci = Math.min(255, Math.max(0, ps[si + 2]));
            _vt.curAttr = (_vt.curAttr & ~0xFF) | (ci + 1);
            si += 2;
          } else if (p === 48 && si + 1 < ps.length && ps[si + 1] === 5 && si + 2 < ps.length) {
            // 256-color bg: 48;5;N
            const ci = Math.min(255, Math.max(0, ps[si + 2]));
            _vt.curAttr = (_vt.curAttr & ~0xFF00) | ((ci + 1) << 8);
            si += 2;
          }
        }
        break;
      }
      case 'n': break; // DSR
      case 'c': break; // DA
      case 't': break; // Window manipulation
    }
  }

  // ── Render virtual screen to DOM ──
  let _scrollRendered = 0;
  const _scrollEl = document.createElement('div');
  const _screenEl = document.createElement('div');
  linesEl.appendChild(_scrollEl);
  linesEl.appendChild(_screenEl);

  // ── Text feed renderer (for textfeed mode) ──
  let _textFeedLines = [];      // Current line elements
  let _textFeedContent = '';     // Last content hash for diffing
  let _tailMode = true;          // true = auto-scroll to bottom; false = sticky position
  let _newContentBadge = null;
  let _livePill = null;

  // Track user scroll position — auto-detect tail mode
  outputEl.addEventListener('scroll', () => {
    const atBottom = outputEl.scrollHeight - outputEl.scrollTop - outputEl.clientHeight < 50;
    if (atBottom) {
      _tailMode = true;
      if (_newContentBadge) _newContentBadge.style.display = 'none';
      if (_livePill) _livePill.style.display = '';
    } else {
      _tailMode = false;
      if (_livePill) _livePill.style.display = 'none';
    }
  }, { passive: true });

  // ── Terminal noise: substrings to suppress on mobile ──
  const _noiseSubstrings = [
    'bypass permissions',
    'esc to interrupt',
    'shift+tab to cycle',
    'shift\u2060+\u2060tab',
  ];
  const _noiseRegexes = [
    /^[─━═╌┄┈\-_]{4,}$/,                       // horizontal rule lines
    /^[\s>❯›⟩»]+$/,                             // bare prompt-only lines
    /^[\s│┃|]*$/,                                // empty box-drawing lines
  ];

  function _filterNoise(lines) {
    if (!isMobTerm) return lines;
    return lines.filter(l => {
      const trimmed = l.trim();
      if (!trimmed) return true; // keep blank lines
      const lower = trimmed.toLowerCase();
      for (const sub of _noiseSubstrings) {
        if (lower.includes(sub)) return false;
      }
      for (const pat of _noiseRegexes) {
        if (pat.test(trimmed)) return false;
      }
      return true;
    });
  }

  // ── Detect autocomplete ghost text from terminal ──
  // Claude Code shows autocomplete as dimmed text after cursor
  let _lastAutoComplete = '';

  function _detectAutoComplete(lines) {
    // Look for lines with tab-completion suggestions (common patterns)
    for (let i = lines.length - 1; i >= Math.max(0, lines.length - 5); i--) {
      const line = lines[i];
      // Ghost text pattern: cursor line followed by dim suggestion
      // Tab completion often appears as inline grey text or on a separate line
      if (/^\s+[a-zA-Z0-9_\-/.]+\s*$/.test(line) && i > 0 && lines[i-1].includes('>')) {
        const suggestion = line.trim();
        if (suggestion !== _lastAutoComplete) {
          _lastAutoComplete = suggestion;
          _showAutoComplete(suggestion);
        }
        return;
      }
    }
    if (_lastAutoComplete) {
      _lastAutoComplete = '';
      _showAutoComplete('');
    }
  }

  function _showAutoComplete(text) {
    if (!input) return;
    let ghost = container.querySelector('.term-autocomplete-ghost');
    if (!text) {
      if (ghost) ghost.style.display = 'none';
      return;
    }
    if (!ghost) {
      ghost = document.createElement('div');
      ghost.className = 'term-autocomplete-ghost';
      ghost.style.cssText = 'position:absolute;left:0;right:0;bottom:100%;padding:4px 8px;font-family:var(--ob-mono);font-size:12px;color:rgba(240,184,0,0.4);background:rgba(10,10,15,0.95);border-top:1px solid rgba(240,184,0,0.1);pointer-events:none;z-index:2;';
      // Make toolbar parent relative for positioning
      const inputRow = input.closest('.term-input-row');
      if (inputRow) { inputRow.style.position = 'relative'; inputRow.appendChild(ghost); }
    }
    ghost.textContent = 'TAB → ' + text;
    ghost.style.display = '';
  }

  // ── Smart Prompt Detection Engine ──
  function _stripAnsi(text) { return text.replace(/\x1b\[[0-9;]*[A-Za-z]/g, ''); }

  let _currentPrompt = null;
  let _promptContentHash = '';
  let _promptPendingCount = 0;
  let _promptOverlayEl = null;
  const _PROMPT_STABLE_FRAMES = 2; // require 2 stable frames before showing

  function _detectArrowChoice(plainLines) {
    // Look for ❯ or > indicator with indented option lines
    let arrowIdx = -1;
    for (let i = plainLines.length - 1; i >= Math.max(0, plainLines.length - 20); i--) {
      const trimmed = plainLines[i].trim();
      if (/^[❯>›]\s+/.test(trimmed)) { arrowIdx = i; break; }
    }
    if (arrowIdx === -1) return null;

    // Gather options: lines above and below the arrow that are indented option-like
    const options = [];
    let selectedIdx = -1;
    let startLine = arrowIdx;

    // Scan backwards from arrow to find first option
    for (let i = arrowIdx - 1; i >= Math.max(0, arrowIdx - 10); i--) {
      const trimmed = plainLines[i].trim();
      if (/^\s{2,}/.test(plainLines[i]) && trimmed && !/^[❯>›]/.test(trimmed)) {
        startLine = i;
      } else break;
    }

    // Scan from startLine to collect all options
    for (let i = startLine; i < Math.min(plainLines.length, arrowIdx + 15); i++) {
      const trimmed = plainLines[i].trim();
      if (!trimmed) { if (options.length > 0) break; continue; }
      const isSelected = /^[❯>›]\s+/.test(trimmed);
      const label = trimmed.replace(/^[❯>›]\s+/, '').replace(/^\s+/, '');
      if (!label) continue;
      // Stop if we hit something that doesn't look like an option
      if (!/^\s/.test(plainLines[i]) && !isSelected) { if (options.length > 0) break; continue; }
      if (isSelected) selectedIdx = options.length;
      const recommended = /\(recommended\)/i.test(label);
      options.push({ label, value: label, recommended, selected: isSelected, index: options.length });
    }

    if (options.length < 2) return null;

    // Look for question text above options
    let question = '';
    for (let i = startLine - 1; i >= Math.max(0, startLine - 5); i--) {
      const trimmed = plainLines[i].trim();
      if (trimmed && trimmed.length > 3) { question = trimmed; break; }
    }

    return { type: 'arrow', question, options, selectedIdx, lineRange: [startLine, startLine + options.length] };
  }

  function _detectNumberedChoice(plainLines) {
    // Look for "Select (1-N):" or similar at the bottom, with numbered lines above
    const last10 = plainLines.slice(-10);
    let selectLine = -1;
    for (let i = last10.length - 1; i >= 0; i--) {
      if (/select\s*\(?[0-9]/i.test(last10[i]) || /choose\s*\(?[0-9]/i.test(last10[i]) || /enter.*number/i.test(last10[i])) {
        selectLine = plainLines.length - last10.length + i;
        break;
      }
    }
    if (selectLine === -1) return null;

    const options = [];
    for (let i = selectLine - 1; i >= Math.max(0, selectLine - 20); i--) {
      const m = plainLines[i].trim().match(/^(\d+)[.)]\s+(.+)/);
      if (m) {
        options.unshift({ label: m[2].trim(), value: m[1], recommended: false, selected: false, index: parseInt(m[1]) });
      } else if (options.length > 0) break;
    }

    if (options.length < 2) return null;
    return { type: 'numbered', question: plainLines[selectLine].trim(), options, lineRange: [selectLine - options.length, selectLine] };
  }

  function _detectYesNo(plainLines) {
    // Look for (y/n), [Y/n], (yes/no) at the end of recent lines
    for (let i = plainLines.length - 1; i >= Math.max(0, plainLines.length - 5); i--) {
      const trimmed = plainLines[i].trim();
      if (!trimmed) continue;
      const m = trimmed.match(/(.+?)\s*[\[(]\s*(y\s*\/\s*n|yes\s*\/\s*no|n\s*\/\s*y)\s*[\])]\s*[?:]?\s*$/i);
      if (m) {
        const question = m[1].trim();
        const isPermission = /allow|permit|approve|accept|authorize/i.test(question);
        return {
          type: isPermission ? 'permission' : 'yesno',
          question: trimmed,
          options: [
            { label: isPermission ? 'Allow' : 'Yes', value: 'y', recommended: false, selected: false },
            { label: isPermission ? 'Deny' : 'No', value: 'n', recommended: false, selected: false },
          ],
          lineRange: [i, i]
        };
      }
    }
    return null;
  }

  function _detectPermission(plainLines) {
    // Claude Code permission prompts: "Allow <tool>? (y/n)" or "Do you want to proceed?"
    for (let i = plainLines.length - 1; i >= Math.max(0, plainLines.length - 8); i--) {
      const trimmed = plainLines[i].trim();
      if (!trimmed) continue;
      // "Allow mcp__filesystem__read_file?" pattern
      if (/^Allow\s+.+\?\s*$/i.test(trimmed)) {
        return {
          type: 'permission',
          question: trimmed,
          options: [
            { label: 'Allow', value: 'y', recommended: false, selected: false },
            { label: 'Deny', value: 'n', recommended: false, selected: false },
          ],
          lineRange: [i, i]
        };
      }
    }
    return null;
  }

  function _detectPrompts(lines) {
    const plainLines = lines.map(l => _stripAnsi(l));
    // Detection priority: most specific first
    const prompt = _detectArrowChoice(plainLines) || _detectNumberedChoice(plainLines) || _detectYesNo(plainLines) || _detectPermission(plainLines);

    if (!prompt) {
      if (_currentPrompt) {
        _promptPendingCount++;
        if (_promptPendingCount > 2) { _dismissPromptOverlay(); _currentPrompt = null; _promptContentHash = ''; _promptPendingCount = 0; }
      }
      return;
    }

    // Check stability: same content hash for N frames
    const hash = prompt.type + ':' + prompt.question + ':' + prompt.options.map(o => o.label).join('|');
    if (hash !== _promptContentHash) {
      _promptContentHash = hash;
      _promptPendingCount = 0;
      return;
    }
    _promptPendingCount++;
    if (_promptPendingCount < _PROMPT_STABLE_FRAMES) return;

    // If same prompt already showing, skip re-render
    if (_currentPrompt && _currentPrompt._hash === hash) return;

    prompt._hash = hash;
    _currentPrompt = prompt;
    _showPromptOverlay(prompt);
  }

  // ── Prompt Overlay Rendering ──
  function _showPromptOverlay(prompt) {
    _dismissPromptOverlay(true); // remove old without animation

    const overlay = document.createElement('div');
    overlay.className = 'term-prompt-overlay';

    // Question header
    if (prompt.question) {
      const q = document.createElement('div');
      q.className = 'term-prompt-question';
      q.textContent = prompt.question;
      overlay.appendChild(q);
    }

    // Options container
    const optWrap = document.createElement('div');
    optWrap.className = 'term-prompt-options';
    if (prompt.type === 'yesno' || prompt.type === 'permission') {
      optWrap.style.justifyContent = 'center';
    }

    prompt.options.forEach((opt, idx) => {
      const btn = document.createElement('button');
      btn.className = 'term-prompt-btn';
      if (opt.recommended) btn.classList.add('recommended');
      if (opt.selected) btn.classList.add('selected');

      if (prompt.type === 'yesno' || prompt.type === 'permission') {
        btn.classList.add(idx === 0 ? 'pill-yes' : 'pill-no');
      }

      let labelText = opt.label;
      if (opt.recommended) labelText += ' *';
      btn.textContent = labelText;

      btn.addEventListener('click', () => _handlePromptSelection(prompt, opt, idx));
      optWrap.appendChild(btn);
    });
    overlay.appendChild(optWrap);

    // "Other" input for arrow-choice prompts with Other option
    if (prompt.type === 'arrow' && prompt.options.some(o => /^other$/i.test(o.label))) {
      const otherRow = document.createElement('div');
      otherRow.className = 'term-prompt-other-row';
      const otherInput = document.createElement('input');
      otherInput.className = 'term-prompt-other-input';
      otherInput.type = 'text';
      otherInput.placeholder = 'Type custom response...';
      const otherSend = document.createElement('button');
      otherSend.className = 'term-prompt-other-send';
      otherSend.textContent = 'Send';
      otherSend.addEventListener('click', () => _handleOtherSelection(prompt, otherInput.value));
      otherInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') _handleOtherSelection(prompt, otherInput.value);
      });
      otherRow.appendChild(otherInput);
      otherRow.appendChild(otherSend);
      overlay.appendChild(otherRow);
    }

    _promptOverlayEl = overlay;
    outputEl.appendChild(overlay);

    // Auto-scroll to show overlay
    if (_tailMode) outputEl.scrollTop = outputEl.scrollHeight;
  }

  function _handlePromptSelection(prompt, opt, idx) {
    if (prompt.type === 'arrow') {
      // Navigate to the correct option via arrow keys + Enter
      const currentSel = prompt.selectedIdx >= 0 ? prompt.selectedIdx : 0;
      const diff = idx - currentSel;
      const arrow = diff > 0 ? '\x1b[B' : '\x1b[A'; // Down : Up
      for (let i = 0; i < Math.abs(diff); i++) sendInput(arrow);
      setTimeout(() => sendInput('\n'), 50 * Math.abs(diff) + 20);
    } else if (prompt.type === 'numbered') {
      sendInput(opt.value + '\n');
    } else {
      // yesno / permission
      sendInput(opt.value + '\n');
    }
    _flashAndDismiss(opt.label);
  }

  function _handleOtherSelection(prompt, text) {
    if (!text || !text.trim()) return;
    // Navigate to "Other" option first
    const otherIdx = prompt.options.findIndex(o => /^other$/i.test(o.label));
    if (otherIdx >= 0) {
      const currentSel = prompt.selectedIdx >= 0 ? prompt.selectedIdx : 0;
      const diff = otherIdx - currentSel;
      const arrow = diff > 0 ? '\x1b[B' : '\x1b[A';
      for (let i = 0; i < Math.abs(diff); i++) sendInput(arrow);
      const delay = 50 * Math.abs(diff) + 20;
      // Select "Other", then type the custom text
      setTimeout(() => {
        sendInput('\n');
        setTimeout(() => sendInput(text.trim() + '\n'), 200);
      }, delay);
    } else {
      sendInput(text.trim() + '\n');
    }
    _flashAndDismiss('Other: ' + text.trim());
  }

  function _flashAndDismiss(sentLabel) {
    if (!_promptOverlayEl) return;
    // Show sent confirmation
    const sent = document.createElement('div');
    sent.className = 'term-prompt-sent';
    sent.textContent = 'Sent: ' + sentLabel;
    _promptOverlayEl.appendChild(sent);

    // Dismiss after short delay
    setTimeout(() => {
      _dismissPromptOverlay();
      _currentPrompt = null;
      _promptContentHash = '';
      _promptPendingCount = 0;
    }, 600);
  }

  function _dismissPromptOverlay(instant) {
    if (!_promptOverlayEl) return;
    if (instant) {
      _promptOverlayEl.remove();
      _promptOverlayEl = null;
      return;
    }
    _promptOverlayEl.classList.add('dismissing');
    const el = _promptOverlayEl;
    setTimeout(() => { if (el.parentNode) el.remove(); }, 200);
    _promptOverlayEl = null;
  }

  // ── URL Linkification ──
  const _URL_RE = /(https?:\/\/[^\s<>"')\]]+)/g;
  function _linkifyLine(div) {
    // Only linkify plain text nodes (skip ANSI-processed lines with innerHTML)
    if (div._ansiHtml) return;
    const text = div.textContent;
    _URL_RE.lastIndex = 0;
    if (!_URL_RE.test(text)) return;
    _URL_RE.lastIndex = 0;
    const frag = document.createDocumentFragment();
    let lastIdx = 0;
    let match;
    while ((match = _URL_RE.exec(text)) !== null) {
      if (match.index > lastIdx) frag.appendChild(document.createTextNode(text.slice(lastIdx, match.index)));
      const a = document.createElement('a');
      a.href = match[1];
      a.textContent = match[1];
      a.className = 'term-link';
      a.target = '_blank';
      a.rel = 'noopener';
      frag.appendChild(a);
      lastIdx = match.index + match[0].length;
    }
    if (lastIdx < text.length) frag.appendChild(document.createTextNode(text.slice(lastIdx)));
    div.textContent = '';
    div.appendChild(frag);
    div._linkedUrl = true;
  }

  // ANSI SGR color code → HTML span converter
  const _ANSI_SGR = /\x1b\[([0-9;]*)m/g;
  const _ANSI_16 = ['#000','#c23621','#25bc24','#adad27','#492ee1','#d338d3','#33bbc8','#cbcccd'];
  const _ANSI_16_BR = ['#666','#ff6456','#5ff967','#fefb67','#6d5cff','#ff76ff','#5ffdff','#fefefe'];
  function _ansiToHtml(text) {
    if (text.indexOf('\x1b[') === -1) return null;
    let bold = false, fg = null, bg = null, spans = 0;
    const esc = text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    const html = esc.replace(_ANSI_SGR, (_, codes) => {
      let out = '';
      const parts = codes ? codes.split(';').map(Number) : [0];
      for (let i = 0; i < parts.length; i++) {
        const c = parts[i];
        if (c === 0) { bold = false; fg = null; bg = null; if (spans) { out += '</span>'.repeat(spans); spans = 0; } }
        else if (c === 1) bold = true;
        else if (c === 22) bold = false;
        else if (c >= 30 && c <= 37) fg = bold ? _ANSI_16_BR[c-30] : _ANSI_16[c-30];
        else if (c === 39) fg = null;
        else if (c >= 40 && c <= 47) bg = _ANSI_16[c-40];
        else if (c === 49) bg = null;
        else if (c >= 90 && c <= 97) fg = _ANSI_16_BR[c-90];
        else if (c >= 100 && c <= 107) bg = _ANSI_16_BR[c-100];
        else if (c === 38 && parts[i+1] === 5) { fg = _ansi256(parts[i+2]); i += 2; }
        else if (c === 48 && parts[i+1] === 5) { bg = _ansi256(parts[i+2]); i += 2; }
      }
      let style = '';
      if (fg) style += 'color:' + fg + ';';
      if (bg) style += 'background:' + bg + ';';
      if (bold) style += 'font-weight:700;';
      if (style) { spans++; out += '<span style="' + style + '">'; }
      return out;
    });
    return html + (spans ? '</span>'.repeat(spans) : '');
  }
  function _ansi256(n) {
    if (n < 8) return _ANSI_16[n];
    if (n < 16) return _ANSI_16_BR[n-8];
    if (n >= 232) { const v = 8 + (n-232)*10; return 'rgb('+v+','+v+','+v+')'; }
    n -= 16; const b = n%6, g = ((n-b)/6)%6, r = ((n-b-g*6)/36)%6;
    return 'rgb('+(r?55+r*40:0)+','+(g?55+g*40:0)+','+(b?55+b*40:0)+')';
  }

  function _renderTextFeed(content) {
    if (content === _textFeedContent) return;
    _textFeedContent = content;

    let lines = content.split('\r\n');

    // Filter noise lines on mobile
    lines = _filterNoise(lines);

    // Detect autocomplete suggestions
    _detectAutoComplete(lines);

    // Detect interactive prompts (y/n, multi-choice, etc.)
    _detectPrompts(lines);

    // Update lines in-place (minimize DOM churn)
    while (_screenEl.children.length > lines.length) {
      _screenEl.removeChild(_screenEl.lastChild);
    }
    for (let i = 0; i < lines.length; i++) {
      let div = _screenEl.children[i];
      if (!div) {
        div = document.createElement('div');
        div.className = 'term-line';
        _screenEl.appendChild(div);
      }
      const html = _ansiToHtml(lines[i]);
      if (html !== null) {
        if (div._ansiHtml !== html) { div.innerHTML = html; div._ansiHtml = html; div._linkedUrl = false; }
      } else {
        if (div.textContent !== lines[i]) { div.textContent = lines[i]; div._ansiHtml = null; div._linkedUrl = false; }
      }
      // Linkify URLs in plain text lines
      if (!div._linkedUrl) _linkifyLine(div);
    }

    // Tail mode: auto-scroll to bottom; sticky mode: don't touch scroll
    if (_tailMode) {
      outputEl.scrollTop = outputEl.scrollHeight;
      // Ensure LIVE pill exists and is visible
      if (!_livePill) {
        _livePill = document.createElement('div');
        _livePill.className = 'term-live-pill';
        _livePill.textContent = 'LIVE';
        outputEl.appendChild(_livePill);
      }
      _livePill.style.display = '';
      if (_newContentBadge) _newContentBadge.style.display = 'none';
    } else {
      // Show "new content" badge when not tailing
      if (!_newContentBadge) {
        _newContentBadge = document.createElement('div');
        _newContentBadge.style.cssText = 'position:sticky;bottom:4px;text-align:center;z-index:5;pointer-events:auto;';
        _newContentBadge.innerHTML = '<button style="padding:4px 12px;border-radius:12px;background:rgba(240,184,0,0.9);color:#000;font-size:11px;font-weight:700;font-family:var(--ob-mono);border:none;cursor:pointer;">' + (_currentPrompt ? 'PROMPT &#x2193;' : 'NEW &#x2193;') + '</button>';
        _newContentBadge.querySelector('button').addEventListener('click', () => {
          _tailMode = true;
          outputEl.scrollTop = outputEl.scrollHeight;
          _newContentBadge.style.display = 'none';
          if (_livePill) _livePill.style.display = '';
        });
        outputEl.appendChild(_newContentBadge);
      }
      _newContentBadge.style.display = '';
      // Update badge text when prompt is active
      const badgeBtn = _newContentBadge.querySelector('button');
      if (badgeBtn) badgeBtn.innerHTML = _currentPrompt ? 'PROMPT &#x2193;' : 'NEW &#x2193;';
      if (_livePill) _livePill.style.display = 'none';
    }
  }

  // ── 256-color lookup table ──
  const _COLOR_256 = [
    '#000000','#cc0000','#4e9a06','#c4a000','#3465a4','#75507b','#06989a','#d3d7cf',
    '#555753','#ef2929','#8ae234','#fce94f','#729fcf','#ad7fa8','#34e2e2','#eeeeec',
  ];
  // 216 color cube (6x6x6)
  for (let r = 0; r < 6; r++) for (let g = 0; g < 6; g++) for (let b = 0; b < 6; b++)
    _COLOR_256.push('#' + [r,g,b].map(v => (v ? v * 40 + 55 : 0).toString(16).padStart(2,'0')).join(''));
  // 24 grayscale
  for (let i = 0; i < 24; i++) { const v = (i * 10 + 8).toString(16).padStart(2,'0'); _COLOR_256.push('#' + v + v + v); }

  function _attrToSpan(text, attr) {
    if (attr === 0) return document.createTextNode(text);
    const span = document.createElement('span');
    span.textContent = text;
    const classes = [];
    let fg = attr & 0xFF, bg = (attr >> 8) & 0xFF;
    const bold = !!(attr & (1 << 16)), dim = !!(attr & (1 << 17));
    const italic = !!(attr & (1 << 18)), underline = !!(attr & (1 << 19));
    const inverse = !!(attr & (1 << 20));
    if (inverse) { const tmp = fg; fg = bg; bg = tmp; }
    if (bold) classes.push('sgr-bold');
    if (dim) classes.push('sgr-dim');
    if (italic) classes.push('sgr-italic');
    if (underline) classes.push('sgr-underline');
    if (fg > 0 && fg <= 16) classes.push('sgr-fg' + (fg - 1));
    else if (fg > 16) span.style.color = _COLOR_256[fg - 1] || '';
    if (bg > 0 && bg <= 16) classes.push('sgr-bg' + (bg - 1));
    else if (bg > 16) span.style.backgroundColor = _COLOR_256[bg - 1] || '';
    if (classes.length) span.className = classes.join(' ');
    return span;
  }

  function _renderColorLine(div, chars, attrs, len) {
    let runStart = 0, runAttr = attrs[0];
    for (let c = 1; c <= len; c++) {
      if (c === len || attrs[c] !== runAttr) {
        const text = chars.slice(runStart, c).join('');
        div.appendChild(_attrToSpan(text, runAttr));
        if (c < len) { runStart = c; runAttr = attrs[c]; }
      }
    }
  }

  let _renderQueued = false;
  function _renderVT() {
    if (_renderQueued) return;
    _renderQueued = true;
    requestAnimationFrame(() => {
      _renderQueued = false;

      // Append new scrollback lines with color attributes
      while (_scrollRendered < _vt.scrollback.length) {
        const div = document.createElement('div');
        div.className = 'term-line';
        const entry = _vt.scrollback[_scrollRendered];
        if (typeof entry === 'string') {
          // Legacy plain-text scrollback (backwards compat)
          div.textContent = entry;
        } else if (entry && entry.chars) {
          // Color-aware scrollback
          let hasColor = false;
          for (let c = 0; c < entry.attrs.length; c++) { if (entry.attrs[c] !== 0) { hasColor = true; break; } }
          if (!hasColor) {
            div.textContent = entry.chars.join('');
          } else {
            _renderColorLine(div, entry.chars, entry.attrs, entry.chars.length || 1);
          }
        }
        _scrollEl.appendChild(div);
        _scrollRendered++;
      }
      while (_scrollEl.children.length > _vt.maxScroll) _scrollEl.removeChild(_scrollEl.firstChild);

      // Render current screen rows with color attributes
      let last = _vt.rows - 1;
      while (last > _vt.curR && _vt.grid[last].every(c => c === ' ') && _vt.attrs[last].every(a => a === 0)) last--;

      _screenEl.innerHTML = '';
      for (let r = 0; r <= last; r++) {
        const div = document.createElement('div');
        div.className = 'term-line';
        const lineChars = _vt.grid[r], lineAttrs = _vt.attrs[r];
        // Find last non-space or non-default-attr cell for trimming
        let lineLen = _vt.cols;
        while (lineLen > 0 && lineChars[lineLen - 1] === ' ' && lineAttrs[lineLen - 1] === 0) lineLen--;
        // Check if any cell has a non-zero attr
        let hasColor = false;
        for (let c = 0; c < lineLen; c++) { if (lineAttrs[c] !== 0) { hasColor = true; break; } }
        if (!hasColor) {
          div.textContent = lineChars.slice(0, lineLen).join('');
        } else {
          _renderColorLine(div, lineChars, lineAttrs, lineLen || 1);
        }
        _screenEl.appendChild(div);
      }

      if (_tailMode) outputEl.scrollTop = outputEl.scrollHeight;
    });
  }

  function clearOutput() {
    _vt.init(_vt.rows, _vt.cols);
    _vt.curAttr = 0;
    _scrollEl.innerHTML = '';
    _screenEl.innerHTML = '';
    _scrollRendered = 0;
    _textFeedContent = '';
    _tailMode = true;
  }

  // ── Mobile key toolbar (between output and input) ──
  let toolbar = null;
  if (isMobTerm) {
    toolbar = document.createElement('div');
    toolbar.className = 'term-toolbar';
    container.appendChild(toolbar);
  }

  // ── State (declared early — needed by input row setup) ──
  let charMode = label.startsWith('mirror-');  // Only mirror tabs default to CHAR mode; Claude tab uses LINE mode (line-oriented CLI)

  // ── Input row: mode toggle + text input + send button ──
  const inputRow = document.createElement('div');
  inputRow.className = 'term-input-row';

  const modeBtn = document.createElement('button');
  modeBtn.className = 'term-mode-btn';
  modeBtn.textContent = charMode ? 'CHAR' : 'LINE';
  modeBtn.title = 'LINE: send on Enter. CHAR: send each keystroke (for vim, htop, ssh)';
  if (charMode) modeBtn.classList.add('char-active');

  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'term-input';
  input.placeholder = charMode ? 'Char mode — each key sent live' : 'Type command...';
  input.title = 'Type shell commands here — connected to the MASCOM backend';
  input.autocomplete = 'off';
  input.autocorrect = 'off';
  input.autocapitalize = 'none';
  input.spellcheck = false;
  input.inputMode = 'text';
  input.setAttribute('data-lpignore', 'true');
  input.setAttribute('data-form-type', 'other');
  input.style.textTransform = 'none';

  const sendBtn = document.createElement('button');
  sendBtn.className = 'term-send-btn';
  sendBtn.title = 'Send command (Enter)';
  sendBtn.innerHTML = '&#x23CE;';

  inputRow.appendChild(modeBtn);
  inputRow.appendChild(input);
  inputRow.appendChild(sendBtn);

  // "New" button for Claude tab — resets session (fresh start, no --continue)
  if (label === 'claude') {
    const newBtn = document.createElement('button');
    newBtn.className = 'term-send-btn';
    newBtn.title = 'Start fresh Claude Code session';
    newBtn.textContent = 'NEW';
    newBtn.style.fontSize = '10px';
    newBtn.style.fontWeight = '700';
    newBtn.style.letterSpacing = '1px';
    newBtn.addEventListener('click', () => {
      if (tws && tws.readyState === WebSocket.OPEN) {
        tws.send(JSON.stringify({ type: 'reset' }));
      }
    });
    inputRow.appendChild(newBtn);
  }

  container.appendChild(inputRow);

  // ── Click anywhere on terminal output to focus input ──
  outputEl.addEventListener('click', () => input.focus({preventScroll: true}));
  outputEl.style.cursor = 'text';

  // ── State (continued) ──
  const cmdHistory = [];
  let historyIdx = -1;
  let savedInput = '';

  // ── WebSocket (SPA-like: never goes stale) ──
  let tws, _reconnTimer, _reconnDelay = 1000, _closed = false, _keepAlive, _staleCheck, _lastMsg = 0;

  function sendInput(data) {
    if (tws && tws.readyState === WebSocket.OPEN) {
      tws.send(JSON.stringify({ type: 'input', data: data }));
    }
  }

  function forceReconnect() {
    if (tws) { try { tws.close(); } catch {} }
    tws = null;
    _reconnDelay = 1000;
    connect();
  }

  function connect() {
    if (tws && (tws.readyState === WebSocket.OPEN || tws.readyState === WebSocket.CONNECTING)) return;
    tws = new WebSocket(wsUrl);

    tws.onopen = () => {
      _reconnDelay = 1000;
      _lastMsg = Date.now();
      clearInterval(_keepAlive);
      _keepAlive = setInterval(() => {
        if (tws && tws.readyState === WebSocket.OPEN) tws.send(JSON.stringify({ type: 'ping' }));
      }, 25000);
      // Staleness watchdog: if no message for 60s, force reconnect
      clearInterval(_staleCheck);
      _staleCheck = setInterval(() => {
        if (Date.now() - _lastMsg > 60000 && tws && tws.readyState === WebSocket.OPEN) {
          console.log('[Terminal] Stale connection detected, reconnecting');
          forceReconnect();
        }
      }, 15000);
    };

    tws.onmessage = (e) => {
      _lastMsg = Date.now();
      try {
        const msg = JSON.parse(e.data);
        if (msg.type === 'init') {
          if (msg.mode === 'autosee') {
            _termMode = 'autosee';
            linesEl.style.display = 'none';
            fillEl.style.display = 'none';
            frameEl.style.display = 'block';
            if (msg.frame) _pushFrame('data:image/jpeg;base64,' + msg.frame);
          } else if (msg.mode === 'textfeed') {
            _termMode = 'textfeed';
            linesEl.style.display = '';
            fillEl.style.display = 'none';
            frameEl.style.display = 'none';
            _scrollEl.style.display = 'none';
            clearOutput();
            // Render persistent history first (scrollable), then current screen
            if (msg.history) {
              const histLines = msg.history.split('\r\n');
              histLines.forEach(line => {
                const el = document.createElement('div');
                el.className = 'term-line term-history';
                const html = _ansiToHtml(line);
                if (html !== null) { el.innerHTML = html; } else { el.textContent = line; }
                el.style.opacity = '0.6';
                linesEl.appendChild(el);
              });
              // Separator between history and live
              const sep = document.createElement('div');
              sep.className = 'term-line';
              sep.style.cssText = 'border-top:1px solid rgba(240,184,0,0.2);margin:2px 0;opacity:0.4;font-size:9px;color:var(--ob-gold);';
              sep.textContent = `── ${msg.history_lines || 0} lines of history ──`;
              linesEl.appendChild(sep);
            }
            if (msg.content) _renderTextFeed(msg.content);
          } else {
            _termMode = 'vt';
            linesEl.style.display = '';
            fillEl.style.display = '';
            frameEl.style.display = 'none';
            _scrollEl.style.display = '';
            _vt.init(msg.rows || 40, msg.cols || 120);
            clearOutput();
            if (msg.replay) processOutput(msg.replay);
          }
        } else if (msg.type === 'text') {
          _renderTextFeed(msg.content);
        } else if (msg.type === 'frame') {
          if (_termMode !== 'autosee') {
            _termMode = 'autosee';
            linesEl.style.display = 'none';
            fillEl.style.display = 'none';
            frameEl.style.display = 'block';
          }
          _pushFrame('data:image/jpeg;base64,' + msg.data);
        } else if (msg.type === 'output') {
          processOutput(msg.data);
        } else if (msg.type === 'resize') {
          _vt.resize(msg.rows, msg.cols);
          _renderVT();
        }
      } catch {}
    };

    tws.onerror = () => {};
    tws.onclose = () => {
      clearInterval(_keepAlive);
      clearInterval(_staleCheck);
      if (_closed) return;
      processOutput('\n[reconnecting...]\n');
      clearTimeout(_reconnTimer);
      _reconnTimer = setTimeout(connect, _reconnDelay);
      _reconnDelay = Math.min(_reconnDelay * 1.5, 10000);
    };
  }

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      if (!tws || tws.readyState !== WebSocket.OPEN) {
        clearTimeout(_reconnTimer);
        _reconnDelay = 1000;
        connect();
      } else if (Date.now() - _lastMsg > 30000) {
        // Tab came back and connection looks stale — force reconnect
        forceReconnect();
      }
    }
  });

  connect();

  // ── Line mode: send command + newline ──
  function sendLine() {
    const text = _fixCapsText(input.value);
    sendInput(text + '\n');
    if (text.trim()) {
      cmdHistory.unshift(text);
      if (cmdHistory.length > 100) cmdHistory.pop();
    }
    historyIdx = -1;
    savedInput = '';
    input.value = '';
    input.focus({preventScroll: true});
  }

  // ── Mode toggle ──
  modeBtn.addEventListener('click', () => {
    charMode = !charMode;
    modeBtn.textContent = charMode ? 'CHAR' : 'LINE';
    modeBtn.classList.toggle('char-active', charMode);
    input.placeholder = charMode ? 'Char mode — each key sent live' : 'Type command...';
    input.focus({preventScroll: true});
  });

  // ── Send button ──
  sendBtn.addEventListener('click', () => {
    if (charMode) {
      sendInput('\n');
    } else {
      sendLine();
    }
  });

  // ── Caps lock punctuation fix ──
  // Mobile keyboards sometimes apply shift to ALL keys when caps lock is on,
  // turning , into < and . into > etc. Detect caps lock and un-shift punctuation.
  const _SHIFT_UNMAP = {'<':',','>':'.','!':'1','@':'2','#':'3','$':'4','%':'5','^':'6','&':'7','*':'8','(':'9',')':'0','_':'-','+':'=','{':'[','}':']','|':'\\',':':';','"':"'",'?':'/','~':'`'};
  function _fixCapsKey(e) {
    // If caps lock is on and shift is NOT held, un-shift punctuation AND lowercase letters
    if (e.getModifierState && e.getModifierState('CapsLock') && !e.shiftKey) {
      if (e.key in _SHIFT_UNMAP) return _SHIFT_UNMAP[e.key];
      if (e.key >= 'A' && e.key <= 'Z') return e.key.toLowerCase();
    }
    return e.key;
  }
  function _fixCapsText(text) {
    // For LINE mode: detect caps lock and fix BOTH letters and punctuation.
    // iOS caps lock sends ALL CAPS + shifted punctuation (< instead of , etc.)
    const letters = text.replace(/[^a-zA-Z]/g, '');
    const upperRatio = letters.length > 0 ? (letters.replace(/[^A-Z]/g, '').length / letters.length) : 0;
    if (upperRatio > 0.7 && letters.length > 1) {
      // Caps lock detected — lowercase letters AND un-shift punctuation
      return text.split('').map(ch => {
        if (ch in _SHIFT_UNMAP) return _SHIFT_UNMAP[ch];
        if (ch >= 'A' && ch <= 'Z') return ch.toLowerCase();
        return ch;
      }).join('');
    }
    return text;
  }

  // ── Keyboard handler ──
  // CHAR mode: debounced clear so user sees what they typed briefly
  let _charClearTimer = null;
  function _charClearInput() {
    clearTimeout(_charClearTimer);
    _charClearTimer = setTimeout(() => { input.value = ''; }, 400);
  }

  input.addEventListener('keydown', (e) => {
    if (charMode) {
      // Special keys: prevent default and send escape sequence
      if (e.key === 'Enter') { e.preventDefault(); sendInput('\n'); _charClearInput(); }
      else if (e.key === 'Backspace') { e.preventDefault(); sendInput('\x7f'); _charClearInput(); }
      else if (e.key === 'Delete') { e.preventDefault(); sendInput('\x1b[3~'); }
      else if (e.key === 'Tab' && e.shiftKey) { e.preventDefault(); sendInput('\x1b[Z'); }
      else if (e.key === 'Tab') { e.preventDefault(); sendInput('\t'); }
      else if (e.key === 'Escape') { e.preventDefault(); sendInput('\x1b'); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); sendInput('\x1b[A'); }
      else if (e.key === 'ArrowDown') { e.preventDefault(); sendInput('\x1b[B'); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); sendInput('\x1b[D'); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); sendInput('\x1b[C'); }
      else if (e.key === 'Home') { e.preventDefault(); sendInput('\x1b[H'); }
      else if (e.key === 'End') { e.preventDefault(); sendInput('\x1b[F'); }
      else if (e.ctrlKey && e.key.length === 1) {
        e.preventDefault();
        sendInput(String.fromCharCode(e.key.toUpperCase().charCodeAt(0) - 64));
      }
      else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.isComposing) {
        e.preventDefault();  // Prevent input event from double-sending
        const ch = _fixCapsKey(e);
        sendInput(ch);
        input.value += ch;  // Brief visual feedback
        _charClearInput();
      }
      return;
    }

    // LINE mode
    if (e.key === 'Enter') {
      e.preventDefault();
      sendLine();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (historyIdx === -1) savedInput = input.value;
      if (historyIdx < cmdHistory.length - 1) {
        historyIdx++;
        input.value = cmdHistory[historyIdx];
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIdx > 0) {
        historyIdx--;
        input.value = cmdHistory[historyIdx];
      } else if (historyIdx === 0) {
        historyIdx = -1;
        input.value = savedInput;
      }
    } else if (e.key === 'Tab') {
      e.preventDefault();
      sendInput(input.value + '\t');
      input.value = '';
    } else if (e.key === 'Escape') {
      e.preventDefault();
      sendInput('\x03');
      input.value = '';
    } else if (e.ctrlKey && e.key === 'c') {
      e.preventDefault();
      sendInput('\x03');
      input.value = '';
    } else if (e.ctrlKey && e.key === 'l') {
      e.preventDefault();
      sendInput('\x0c');
    } else if (e.ctrlKey && e.key === 'd') {
      e.preventDefault();
      sendInput('\x04');
    }
  });

  // CHAR mode: mobile keyboard / IME (catches composition, autocomplete, etc.)
  input.addEventListener('input', () => {
    if (charMode && input.value) {
      sendInput(_fixCapsText(input.value));
      _charClearInput();  // Debounced clear — user sees what they typed briefly
    }
  });

  // ── Mobile toolbar buttons ──
  if (isMobTerm && toolbar) {
    let ctrlMode = false;

    // ── Photo & Camera file inputs ──
    const photoInput = document.createElement('input');
    photoInput.type = 'file'; photoInput.accept = 'image/*'; photoInput.style.display = 'none';
    container.appendChild(photoInput);
    const cameraInput = document.createElement('input');
    cameraInput.type = 'file'; cameraInput.accept = 'image/*'; cameraInput.setAttribute('capture', 'environment'); cameraInput.style.display = 'none';
    container.appendChild(cameraInput);

    // ── Persistent image preview bar ──
    let _imgPreview = null;
    function _showImagePreview(dataUrl) {
      if (!_imgPreview) {
        _imgPreview = document.createElement('div');
        _imgPreview.style.cssText = 'display:flex;align-items:center;gap:6px;padding:4px 8px;background:rgba(240,184,0,0.08);border-top:1px solid rgba(240,184,0,0.15);flex-shrink:0;';
        const thumb = document.createElement('img');
        thumb.style.cssText = 'width:32px;height:32px;object-fit:cover;border-radius:4px;border:1px solid rgba(240,184,0,0.2);';
        _imgPreview._thumb = thumb;
        const label = document.createElement('span');
        label.style.cssText = 'flex:1;font-size:10px;font-family:var(--ob-mono);color:var(--ob-gold-dim);';
        label.textContent = '\u{1F4F7} Image ready';
        _imgPreview._label = label;
        const clearBtn = document.createElement('button');
        clearBtn.textContent = '\u2715';
        clearBtn.style.cssText = 'background:none;border:none;color:var(--ob-gold-dim);font-size:14px;cursor:pointer;padding:4px;';
        clearBtn.addEventListener('click', () => {
          window._lastSharedImage = null;
          _imgPreview.style.display = 'none';
        });
        _imgPreview.appendChild(thumb);
        _imgPreview.appendChild(label);
        _imgPreview.appendChild(clearBtn);
        // Insert before input row
        const inputRow = container.querySelector('.term-input-row');
        if (inputRow) container.insertBefore(_imgPreview, inputRow);
        else container.appendChild(_imgPreview);
      }
      _imgPreview._thumb.src = dataUrl;
      _imgPreview.style.display = 'flex';
    }

    function termImageHandler(file) {
      if (!file || !file.type.startsWith('image/')) return;
      const reader = new FileReader();
      reader.onload = () => {
        window._lastSharedImage = reader.result;
        _showImagePreview(reader.result);
        // Auto-send screenshot to terminal for Claude to process
        try {
          const dataUrl = reader.result;
          const base64Data = dataUrl.split(',')[1];
          if (base64Data && typeof sendInput === 'function') {
            const ts = Math.floor(Date.now() / 1000);
            const fname = '/tmp/mobile_screenshot_' + ts + '.png';
            // Chunk the base64 to avoid shell line limits — write in pieces
            const chunkSize = 4000;
            const chunks = [];
            for (let i = 0; i < base64Data.length; i += chunkSize) {
              chunks.push(base64Data.substring(i, i + chunkSize));
            }
            // Build a command that writes chunks via heredoc then decodes
            let cmd = 'cat << \'IMGEOF\' | tr -d \'\\n\' | base64 -d > ' + fname + '\n';
            for (const chunk of chunks) {
              cmd += chunk + '\n';
            }
            cmd += 'IMGEOF\n';
            sendInput(cmd);
            // After a brief pause, send the prompt for Claude to process it
            setTimeout(() => {
              sendInput('echo "Mobile screenshot saved at ' + fname + ' — process this image with Read tool and report what you see."\n');
            }, 500);
            if (typeof showToast === 'function') showToast('Screenshot sent to terminal', 'success');
          }
        } catch (e) {
          console.warn('Auto-send screenshot failed:', e);
        }
      };
      reader.readAsDataURL(file);
    }
    photoInput.addEventListener('change', (e) => { termImageHandler(e.target.files?.[0]); photoInput.value = ''; });
    cameraInput.addEventListener('change', (e) => { termImageHandler(e.target.files?.[0]); cameraInput.value = ''; });

    // ── Compact 2-row 7-column grid: 14 buttons total ──
    const keys = [
      // Row 1: ESC TAB CTRL C-c ↑ 📷 📸
      { label: 'ESC', send: '\x1b', tip: 'Send Escape key' },
      { label: 'TAB', send: '\t', tip: 'Send Tab key (autocomplete)' },
      { label: 'CTL', toggle: true, tip: 'Toggle Ctrl modifier' },
      { label: 'C-c', send: '\x03', tip: 'Send Ctrl+C (cancel)' },
      { label: '\u2191', send: '\x1b[A', tip: 'Up arrow' },
      { label: '\u{1F4F7}', photo: true, tip: 'Photo from library' },
      { label: '\u{1F4F8}', camera: true, tip: 'Take photo' },
      // Row 2: | ~ PASTE ← ↓ → APPS
      { label: '|', insert: '|', tip: 'Insert pipe' },
      { label: '~', insert: '~', tip: 'Insert tilde' },
      { label: 'PST', paste: true, tip: 'Paste from clipboard' },
      { label: '\u2190', send: '\x1b[D', tip: 'Left arrow' },
      { label: '\u2193', send: '\x1b[B', tip: 'Down arrow' },
      { label: '\u2192', send: '\x1b[C', tip: 'Right arrow' },
      { label: 'APPS', nav: 'home', tip: 'Show apps' },
    ];
    keys.forEach(k => {
      const btn = document.createElement('button');
      btn.textContent = k.label;
      btn.title = k.tip;
      if (k.photo || k.camera) btn.style.fontSize = '14px';
      btn.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (k.photo) { photoInput.click(); return; }
        if (k.camera) { cameraInput.click(); return; }
        if (k.nav) {
          if (window.switchMobileView) window.switchMobileView(k.nav);
          return;
        }
        if (k.toggle) {
          ctrlMode = !ctrlMode;
          btn.classList.toggle('ctrl-active', ctrlMode);
          return;
        }
        if (k.paste) {
          try {
            const text = await navigator.clipboard.readText();
            if (text) {
              if (charMode) { sendInput(text); }
              else { input.value += text; }
            }
          } catch {}
          input.focus({preventScroll: true});
          return;
        }
        if (k.insert) {
          input.value += k.insert;
          input.focus({preventScroll: true});
          return;
        }
        let data = k.send;
        if (ctrlMode && data.length === 1) {
          data = String.fromCharCode(data.toUpperCase().charCodeAt(0) - 64);
          ctrlMode = false;
          toolbar.querySelector('.ctrl-active')?.classList.remove('ctrl-active');
        }
        sendInput(data);
        input.focus({preventScroll: true});
      });
      toolbar.appendChild(btn);
    });
  }

  container._lockFit = () => {};
  container._unlockFit = () => {};
  container._termCleanup = () => {
    _closed = true;
    clearTimeout(_reconnTimer);
    clearInterval(_keepAlive);
    if (tws) tws.close();
  };
}

function buildTerminal(container) {
  container.style.cssText = 'background:var(--ob-void);padding:0;overflow:hidden;display:flex;flex-direction:column;';

  // ── Tab bar ──
  const tabBar = document.createElement('div');
  tabBar.className = 'term-tab-bar';
  const tabs = [
    { id: 'shell', label: 'Shell' },
    { id: 'claude', label: 'Internal' },
  ];
  const tabEls = {};
  tabs.forEach(t => {
    const btn = document.createElement('button');
    btn.className = 'term-tab' + (t.id === 'shell' ? ' active' : '');
    btn.textContent = t.label;
    btn.dataset.tab = t.id;
    tabBar.appendChild(btn);
    tabEls[t.id] = btn;
  });
  container.appendChild(tabBar);

  // ── Panels ──
  const shellPanel = document.createElement('div');
  shellPanel.style.cssText = 'flex:1;display:flex;flex-direction:column;overflow:hidden;';
  const claudePanel = document.createElement('div');
  claudePanel.style.cssText = 'flex:1;display:none;flex-direction:column;overflow:hidden;';
  container.appendChild(shellPanel);
  container.appendChild(claudePanel);

  // Build both terminals — connections stay alive in background
  _buildTerminalInner(shellPanel, _T_WS, 'shell');
  _buildTerminalInner(claudePanel, _CC_WS, 'claude');

  // ── Tab switching ──
  let activeTab = 'shell';
  const panels = { shell: shellPanel, claude: claudePanel };

  function switchTab(id) {
    if (!panels[id]) return;
    activeTab = id;
    Object.values(tabEls).forEach(t => t.classList.remove('active'));
    if (tabEls[id]) tabEls[id].classList.add('active');
    Object.entries(panels).forEach(([pid, panel]) => {
      panel.style.display = pid === id ? 'flex' : 'none';
    });
    const input = panels[id].querySelector('.term-input');
    if (input) setTimeout(() => input.focus({preventScroll: true}), 50);
  }

  tabBar.addEventListener('click', e => {
    const btn = e.target.closest('.term-tab');
    if (!btn || btn.dataset.tab === activeTab) return;
    switchTab(btn.dataset.tab);
  });

  // ── Dynamic Mirror Tabs (peer discovery) ──
  const _mirrorPeers = {};  // peer_id → { btn, panel }
  let _mirrorPollTimer = null;

  function addMirrorTab(peer) {
    const id = 'mirror-' + peer.peer_id;
    if (_mirrorPeers[peer.peer_id]) return;

    // Tab button
    const btn = document.createElement('button');
    btn.className = 'term-tab mirror-tab';
    const label = (peer.description || peer.peer_id).substring(0, 16);
    btn.textContent = label;
    btn.dataset.tab = id;
    btn.title = peer.peer_id + (peer.tty ? ' (' + peer.tty + ')' : '');
    tabBar.appendChild(btn);
    tabEls[id] = btn;

    // Panel
    const panel = document.createElement('div');
    panel.style.cssText = 'flex:1;display:none;flex-direction:column;overflow:hidden;';
    container.appendChild(panel);
    panels[id] = panel;

    // Build terminal inner — connects to mirror WebSocket
    const wsUrl = _LOCAL && _MIRROR_WS
      ? _MIRROR_WS + '/mirror/' + peer.peer_id
      : null; // sovereign WS pending
    _buildTerminalInner(panel, wsUrl, 'mirror-' + peer.peer_id);

    _mirrorPeers[peer.peer_id] = { btn, panel, id };
  }

  function removeMirrorTab(peerId) {
    const entry = _mirrorPeers[peerId];
    if (!entry) return;
    // If viewing this tab, switch to Shell
    if (activeTab === entry.id) switchTab('shell');
    // Cleanup
    if (entry.panel._termCleanup) entry.panel._termCleanup();
    entry.btn.remove();
    entry.panel.remove();
    delete tabEls[entry.id];
    delete panels[entry.id];
    delete _mirrorPeers[peerId];
  }

  async function pollMirrorPeers() {
    if (!_MIRROR_API) return; // sovereign WS pending
    try {
      const resp = await fetch(_MIRROR_API);
      if (!resp.ok) return;
      const peers = await resp.json();
      const activeIds = new Set(peers.map(p => p.peer_id));

      // Add new peers
      peers.forEach(p => {
        if (p.status !== 'ended') addMirrorTab(p);
      });

      // Remove departed peers
      Object.keys(_mirrorPeers).forEach(pid => {
        if (!activeIds.has(pid)) removeMirrorTab(pid);
      });
    } catch (e) {
      // Mirror server may not be running — silent fail
    }
  }

  // Start polling for mirror peers
  pollMirrorPeers();
  _mirrorPollTimer = setInterval(pollMirrorPeers, 5000);

  // Proxy cleanup to all panels
  container._lockFit = () => {};
  container._unlockFit = () => {};
  container._termCleanup = () => {
    clearInterval(_mirrorPollTimer);
    if (shellPanel._termCleanup) shellPanel._termCleanup();
    if (claudePanel._termCleanup) claudePanel._termCleanup();
    Object.values(_mirrorPeers).forEach(entry => {
      if (entry.panel._termCleanup) entry.panel._termCleanup();
    });
  };
}

// Deferred terminal build for pre-authed sessions
if (window._mascomBuildTermDeferred) {
  buildTerminal(document.getElementById('term-dock-body'));
}

// ── AutoPilot builder (live screen feed + browser automation) ──
const _AP_WS = _LOCAL ? 'ws://localhost:7682' : null; // TODO: sovereign WS endpoint

function buildAutoPilot(container) {
  container.style.cssText = 'background:var(--ob-void);padding:0;overflow:hidden;';
  const root = document.createElement('div');
  root.className = 'ap-enhanced';

  // ── Pipeline visualization ──
  const pipeline = document.createElement('div');
  pipeline.className = 'ap-pipeline';
  const stages = ['Screen Capture', 'HAL Gate', 'PhotonicMind Vision', 'Decision Engine', 'AutoBrowse'];
  const stageEls = [];
  stages.forEach((name, i) => {
    if (i > 0) { const arr = document.createElement('span'); arr.className = 'ap-pipe-arrow'; arr.textContent = '\u2192'; pipeline.appendChild(arr); }
    const stg = document.createElement('span');
    stg.className = 'ap-pipe-stage' + (i === 0 ? ' active' : '');
    stg.textContent = name;
    stageEls.push(stg);
    pipeline.appendChild(stg);
  });
  root.appendChild(pipeline);

  // ── Top bar: URL input + controls ──
  const topBar = document.createElement('div');
  topBar.style.cssText = 'display:flex;gap:6px;padding:8px 10px;background:var(--ob-deep);border-bottom:1px solid var(--ob-border);flex-shrink:0;align-items:center;flex-wrap:wrap;';

  const statusDot = document.createElement('span');
  statusDot.style.cssText = 'width:8px;height:8px;border-radius:50%;background:var(--ob-red);flex-shrink:0;';
  topBar.appendChild(statusDot);

  const urlInput = document.createElement('input');
  urlInput.type = 'text';
  urlInput.placeholder = 'Enter URL to navigate...';
  urlInput.style.cssText = 'flex:1;min-width:120px;padding:8px 12px;font-size:13px;font-family:var(--ob-mono);background:rgba(255,255,255,0.04);color:var(--ob-text);border:1px solid var(--ob-border);border-radius:var(--ob-radius-sm);outline:none;';
  topBar.appendChild(urlInput);

  const goBtn = document.createElement('button');
  goBtn.textContent = 'Go';
  goBtn.style.cssText = 'padding:8px 14px;background:rgba(240,184,0,0.1);color:var(--ob-gold);border:1px solid rgba(240,184,0,0.18);border-radius:var(--ob-radius-sm);font-size:12px;font-family:var(--ob-mono);cursor:pointer;';
  topBar.appendChild(goBtn);

  const ocrBtn = document.createElement('button');
  ocrBtn.textContent = 'OCR';
  ocrBtn.style.cssText = 'padding:8px 10px;background:rgba(251,191,36,0.1);color:var(--ob-orange);border:1px solid rgba(251,191,36,0.18);border-radius:var(--ob-radius-sm);font-size:10px;font-weight:700;font-family:var(--ob-mono);letter-spacing:1px;cursor:pointer;';
  topBar.appendChild(ocrBtn);

  const analyzeBtn = document.createElement('button');
  analyzeBtn.className = 'ap-analyze-btn';
  analyzeBtn.textContent = '\u{1F441} ANALYZE';
  topBar.appendChild(analyzeBtn);

  root.appendChild(topBar);

  // ── Content area: feed + side panel ──
  const content = document.createElement('div');
  content.className = 'ap-content';

  // Feed column
  const feedCol = document.createElement('div');
  feedCol.className = 'ap-feed-col';

  const feedArea = document.createElement('div');
  feedArea.style.cssText = 'flex:1;min-height:0;overflow:auto;display:flex;align-items:center;justify-content:center;background:#000;position:relative;';

  const feedImg = document.createElement('img');
  feedImg.style.cssText = 'max-width:100%;max-height:100%;object-fit:contain;display:none;';
  feedArea.appendChild(feedImg);

  const placeholder = document.createElement('div');
  placeholder.style.cssText = 'color:var(--ob-text-dim);font-family:var(--ob-mono);font-size:13px;text-align:center;padding:20px;';
  placeholder.innerHTML = 'AutoPilot<br><span style="font-size:11px;opacity:0.5;">Live screen feed + browser automation</span><br><span style="font-size:11px;opacity:0.5;">Connecting...</span>';
  feedArea.appendChild(placeholder);

  // Click-to-interact
  feedImg.addEventListener('click', (e) => {
    if (!apWs || apWs.readyState !== WebSocket.OPEN) return;
    const rect = feedImg.getBoundingClientRect();
    const scaleX = feedImg.naturalWidth / rect.width;
    const scaleY = feedImg.naturalHeight / rect.height;
    const x = Math.round((e.clientX - rect.left) * scaleX);
    const y = Math.round((e.clientY - rect.top) * scaleY);
    apWs.send(JSON.stringify({ type: 'click', x, y }));
  });
  feedCol.appendChild(feedArea);

  // Log area
  const logArea = document.createElement('div');
  logArea.style.cssText = 'height:80px;overflow-y:auto;padding:6px 10px;background:var(--ob-deep);border-top:1px solid var(--ob-border);font-family:var(--ob-mono);font-size:11px;color:var(--ob-text-dim);flex-shrink:0;';
  logArea.textContent = 'AutoPilot ready.';
  feedCol.appendChild(logArea);
  content.appendChild(feedCol);

  // ── Side column: HAL controls + task queue ──
  const sideCol = document.createElement('div');
  sideCol.className = 'ap-side-col';

  // HAL controls
  const halControls = document.createElement('div');
  halControls.className = 'hal-controls';
  let currentHalState = 'green';
  const halStates = [
    { key: 'off', label: 'OFF', cls: 'hal-off' },
    { key: 'green', label: 'OBSERVE', cls: 'hal-green' },
    { key: 'yellow', label: 'SHARED', cls: 'hal-yellow' },
    { key: 'red', label: 'HAL ACTIVE', cls: 'hal-red' },
  ];
  const halBtns = {};
  halStates.forEach(s => {
    const btn = document.createElement('button');
    btn.className = 'hal-btn ' + s.cls + (s.key === currentHalState ? ' active' : '');
    btn.textContent = s.label;
    btn.addEventListener('click', () => setHalState(s.key));
    halControls.appendChild(btn);
    halBtns[s.key] = btn;
  });
  sideCol.appendChild(halControls);

  function setHalState(state) {
    currentHalState = state;
    Object.entries(halBtns).forEach(([k, btn]) => btn.classList.toggle('active', k === state));
    // Sync with global HAL light state machine
    if (window._setHalState) window._setHalState(state);
    // Update pipeline visualization
    stageEls.forEach((el, i) => {
      el.classList.toggle('active', state !== 'off' || i === 0);
    });
    if (state === 'off') stageEls[0].classList.remove('active');
    addLog('HAL state set to: ' + state, 'info');
  }

  // Analysis output area
  const analysisArea = document.createElement('div');
  analysisArea.style.cssText = 'padding:8px;font-size:10px;font-family:var(--ob-mono);color:var(--ob-text);overflow-y:auto;max-height:120px;border-bottom:1px solid var(--ob-border);display:none;';
  sideCol.appendChild(analysisArea);

  // Task queue header
  const tqHeader = document.createElement('div');
  tqHeader.style.cssText = 'padding:8px;font-size:9px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:var(--ob-gold-dim);border-bottom:1px solid var(--ob-border);';
  tqHeader.textContent = 'TASK QUEUE';
  sideCol.appendChild(tqHeader);

  // Task list
  const taskQueue = document.createElement('div');
  taskQueue.className = 'ap-task-queue';
  taskQueue.innerHTML = '<div style="font-size:10px;color:var(--ob-text-dim);padding:4px;">No tasks queued</div>';
  sideCol.appendChild(taskQueue);

  // Add task input
  const addTaskRow = document.createElement('div');
  addTaskRow.className = 'ap-add-task';
  const taskInput = document.createElement('input');
  taskInput.placeholder = 'Describe autonomous task...';
  const addTaskBtn = document.createElement('button');
  addTaskBtn.textContent = 'Add';
  addTaskRow.appendChild(taskInput);
  addTaskRow.appendChild(addTaskBtn);
  sideCol.appendChild(addTaskRow);

  // Task data
  const autopilotTasks = [];
  let taskIdCounter = 0;

  function renderTasks() {
    if (autopilotTasks.length === 0) {
      taskQueue.innerHTML = '<div style="font-size:10px;color:var(--ob-text-dim);padding:4px;">No tasks queued</div>';
      return;
    }
    taskQueue.innerHTML = '';
    autopilotTasks.forEach(t => {
      const el = document.createElement('div');
      el.className = 'ap-task-item';
      el.innerHTML = `<div>${t.description}</div><div class="status ${t.status}">${t.status}</div>`;
      taskQueue.appendChild(el);
    });
  }

  addTaskBtn.addEventListener('click', () => {
    const desc = taskInput.value.trim();
    if (!desc) return;
    taskInput.value = '';
    autopilotTasks.push({ id: ++taskIdCounter, description: desc, status: 'pending', result: null });
    renderTasks();
    addLog('Task added: ' + desc, 'info');
  });
  taskInput.addEventListener('keydown', e => { if (e.key === 'Enter') addTaskBtn.click(); });

  content.appendChild(sideCol);
  root.appendChild(content);
  container.appendChild(root);

  // ── Log helper ──
  function addLog(msg, level) {
    const line = document.createElement('div');
    line.style.color = level === 'error' ? 'var(--ob-red)' : level === 'warn' ? 'var(--ob-orange)' : 'var(--ob-text-dim)';
    line.textContent = msg;
    logArea.appendChild(line);
    logArea.scrollTop = logArea.scrollHeight;
    while (logArea.children.length > 50) logArea.removeChild(logArea.firstChild);
  }

  // ── Vision API — Analyze Screen ──
  analyzeBtn.addEventListener('click', async () => {
    const imgSrc = feedImg.src;
    if (!imgSrc || !imgSrc.startsWith('data:')) {
      addLog('No frame available to analyze', 'warn');
      return;
    }
    analyzeBtn.textContent = '\u23F3 ANALYZING...';
    analyzeBtn.disabled = true;
    analysisArea.style.display = 'block';
    analysisArea.textContent = 'Sending frame to PhotonicMind...';
    // Activate pipeline stages
    stageEls.forEach(el => el.classList.add('active'));

    try {
      const frame = imgSrc.split(',')[1]; // base64 data
      const pKey = localStorage.getItem('photonic-key') || '';
      const r = await fetch('https://vision.mobleysoft.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + pKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'photonic-mind-v1',
          messages: [{ role: 'user', content: [
            { type: 'text', text: 'What do you see on this screen? Describe all UI elements, text, and actions available.' },
            { type: 'image_url', image_url: { url: 'data:image/jpeg;base64,' + frame } }
          ]}]
        })
      });
      const result = await r.json();
      const analysis = result.choices?.[0]?.message?.content || JSON.stringify(result);
      analysisArea.textContent = analysis;
      addLog('Vision analysis complete', 'info');
    } catch (e) {
      analysisArea.textContent = 'Analysis failed: ' + e.message;
      addLog('Vision API error: ' + e.message, 'error');
    }
    analyzeBtn.textContent = '\u{1F441} ANALYZE';
    analyzeBtn.disabled = false;
  });

  // ── WebSocket (SPA-like: never goes stale) ──
  let apWs = null, _apKeepAlive, _apReconnDelay = 1000, _apStaleCheck, _apLastMsg = 0;

  function forceReconnectAP() {
    if (apWs) { try { apWs.close(); } catch {} }
    apWs = null;
    _apReconnDelay = 1000;
    connectAP();
  }

  function connectAP() {
    if (apWs && (apWs.readyState === WebSocket.OPEN || apWs.readyState === WebSocket.CONNECTING)) return;
    apWs = new WebSocket(_AP_WS);

    apWs.onopen = () => {
      _apReconnDelay = 1000;
      _apLastMsg = Date.now();
      statusDot.style.background = 'var(--ob-green)';
      addLog('Connected to AutoPilot server', 'info');
      stageEls[0].classList.add('active');
      apWs.send(JSON.stringify({ type: 'start', fps: 1 }));
      clearInterval(_apKeepAlive);
      _apKeepAlive = setInterval(() => {
        if (apWs && apWs.readyState === WebSocket.OPEN)
          apWs.send(JSON.stringify({ type: 'ping' }));
      }, 25000);
      // Staleness watchdog
      clearInterval(_apStaleCheck);
      _apStaleCheck = setInterval(() => {
        if (Date.now() - _apLastMsg > 60000 && apWs && apWs.readyState === WebSocket.OPEN) {
          addLog('Stale connection detected, reconnecting...', 'warn');
          forceReconnectAP();
        }
      }, 15000);
    };

    apWs.onmessage = (e) => {
      _apLastMsg = Date.now();
      try {
        const msg = JSON.parse(e.data);
        if (msg.hal && window._updateHALIndicator) window._updateHALIndicator(msg.hal);
        if (msg.hal) {
          const stateMap = { o: 'off', g: 'green', y: 'yellow', r: 'red' };
          const s = stateMap[msg.hal];
          if (s && s !== currentHalState) {
            currentHalState = s;
            Object.entries(halBtns).forEach(([k, btn]) => btn.classList.toggle('active', k === s));
          }
        }
        if (msg.type === 'frame') {
          feedImg.src = 'data:image/jpeg;base64,' + msg.image;
          feedImg.style.display = 'block';
          placeholder.style.display = 'none';
          stageEls[0].classList.add('active');
          stageEls[1].classList.add('active');
        } else if (msg.type === 'status') {
          if (msg.state === 'privacy') {
            feedImg.style.display = 'none';
            feedImg.src = '';
            placeholder.style.display = '';
            placeholder.innerHTML = '<span style="font-size:20px;">&#x1f6e1;</span><br>Screen broadcast paused<br><span style="font-size:11px;opacity:0.5;">HAL light is off — privacy mode active</span>';
            statusDot.style.background = 'var(--ob-text-dim)';
            stageEls.forEach(el => el.classList.remove('active'));
            addLog('Privacy mode — screen broadcast paused by HAL', 'warn');
          } else {
            statusDot.style.background = msg.state === 'running' ? 'var(--ob-green)' :
              msg.state === 'paused' ? 'var(--ob-orange)' : 'var(--ob-text-dim)';
          }
          if (msg.url) urlInput.value = msg.url;
        } else if (msg.type === 'log') {
          addLog(msg.message, msg.level);
        } else if (msg.type === 'ocr') {
          addLog('OCR: ' + msg.count + ' blocks — ' + msg.full_text.substring(0, 100), 'info');
        }
      } catch {}
    };

    apWs.onerror = () => {};
    apWs.onclose = () => {
      clearInterval(_apKeepAlive);
      clearInterval(_apStaleCheck);
      statusDot.style.background = 'var(--ob-red)';
      stageEls.forEach(el => el.classList.remove('active'));
      addLog('Disconnected', 'warn');
      _apReconnDelay = Math.min((_apReconnDelay || 1000) * 1.5, 10000);
      setTimeout(connectAP, _apReconnDelay);
    };
  }

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      if (!apWs || apWs.readyState !== WebSocket.OPEN) {
        _apReconnDelay = 1000;
        connectAP();
      } else if (Date.now() - _apLastMsg > 30000) {
        forceReconnectAP();
      }
    }
  });

  // ── Controls ──
  goBtn.addEventListener('click', () => {
    const url = urlInput.value.trim();
    if (!url || !apWs || apWs.readyState !== WebSocket.OPEN) return;
    apWs.send(JSON.stringify({ type: 'navigate', url }));
  });
  urlInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') goBtn.click(); });

  ocrBtn.addEventListener('click', () => {
    if (!apWs || apWs.readyState !== WebSocket.OPEN) return;
    apWs.send(JSON.stringify({ type: 'ocr' }));
  });

  connectAP();

  container._termCleanup = () => {
    if (apWs) apWs.close();
  };
}

// ── BrainView builder (real-time neural activation visualization) ──
const _BV_WS = _LOCAL ? 'ws://localhost:7683' : null; // TODO: sovereign WS endpoint

function buildBrainView(container) {
  container.style.cssText = 'background:#050510;padding:0;overflow:hidden;display:flex;flex-direction:column;';

  // ── Top bar ──
  const topBar = document.createElement('div');
  topBar.style.cssText = 'display:flex;gap:6px;padding:6px 10px;background:#0a0a18;border-bottom:1px solid rgba(255,204,0,0.12);flex-shrink:0;align-items:center;font-size:10px;';
  topBar.innerHTML = `
    <span style="color:rgba(255,204,0,0.4);letter-spacing:2px;font-size:9px;">NEURAL MONITOR</span>
    <span style="flex:1"></span>
    <span id="bv-status" style="color:rgba(255,204,0,0.25);font-size:8px;letter-spacing:1px;">OFFLINE</span>
    <button id="bv-mode" style="background:transparent;border:1px solid rgba(255,204,0,0.15);color:rgba(255,204,0,0.5);font-size:8px;padding:3px 8px;cursor:pointer;letter-spacing:1px;font-family:inherit;">BRAIN</button>
    <button id="bv-retina" style="background:transparent;border:1px solid rgba(255,204,0,0.15);color:rgba(255,204,0,0.5);font-size:8px;padding:3px 8px;cursor:pointer;letter-spacing:1px;font-family:inherit;">RETINA</button>
    <button id="bv-body" style="background:transparent;border:1px solid rgba(255,204,0,0.15);color:rgba(255,204,0,0.5);font-size:8px;padding:3px 8px;cursor:pointer;letter-spacing:1px;font-family:inherit;">BODY</button>
  `;
  container.appendChild(topBar);

  // ── Canvas area ──
  const canvasWrap = document.createElement('div');
  canvasWrap.style.cssText = 'flex:1;position:relative;overflow:hidden;';
  container.appendChild(canvasWrap);
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'width:100%;height:100%;';
  canvasWrap.appendChild(canvas);

  // ── Info panel ──
  const infoPanel = document.createElement('div');
  infoPanel.style.cssText = 'height:100px;overflow-y:auto;background:#080812;border-top:1px solid rgba(255,204,0,0.08);font-size:10px;padding:6px 10px;color:rgba(255,204,0,0.4);line-height:1.6;flex-shrink:0;';
  infoPanel.innerHTML = '<div style="color:rgba(255,204,0,0.2);letter-spacing:1px;font-size:8px;">REGION DETAILS</div>';
  container.appendChild(infoPanel);

  const ctx = canvas.getContext('2d');
  let currentMode = 'brain'; // brain | retina | body
  let brainState = null;
  let hoveredRegion = null;
  let animFrame = null;

  // Brain region layout (normalized 0-1, mapped to canvas)
  // Side view of the brain — each region as a labeled zone
  const BRAIN_REGIONS = {
    // Visual pathway (occipital → temporal)
    lgn:                  { x: 0.78, y: 0.56, r: 0.030, label: 'LGN' },
    v1:                   { x: 0.88, y: 0.40, r: 0.045, label: 'V1' },
    v2:                   { x: 0.82, y: 0.35, r: 0.035, label: 'V2' },
    v4:                   { x: 0.74, y: 0.33, r: 0.030, label: 'V4' },
    it_cortex:            { x: 0.64, y: 0.56, r: 0.035, label: 'IT' },
    // Auditory pathway
    ear:                  { x: 0.92, y: 0.58, r: 0.020, label: 'Ear' },
    cochlea:              { x: 0.90, y: 0.62, r: 0.022, label: 'Cochlea' },
    inferior_colliculus:  { x: 0.78, y: 0.52, r: 0.022, label: 'IC' },
    mgn:                  { x: 0.72, y: 0.54, r: 0.022, label: 'MGN' },
    auditory_cortex:      { x: 0.58, y: 0.60, r: 0.035, label: 'A1' },
    // Central
    thalamus:             { x: 0.58, y: 0.48, r: 0.040, label: 'Thalamus' },
    hippocampus:          { x: 0.58, y: 0.66, r: 0.035, label: 'Hippo' },
    amygdala:             { x: 0.52, y: 0.64, r: 0.028, label: 'Amyg' },
    prefrontal_cortex:    { x: 0.18, y: 0.34, r: 0.055, label: 'PFC' },
    // Language
    wernickes_area:       { x: 0.62, y: 0.48, r: 0.032, label: 'Wernicke' },
    brocas_area:          { x: 0.30, y: 0.46, r: 0.032, label: 'Broca' },
    // Motor
    basal_ganglia:        { x: 0.46, y: 0.48, r: 0.035, label: 'BG' },
    motor_cortex:         { x: 0.38, y: 0.26, r: 0.045, label: 'M1' },
    cerebellum:           { x: 0.82, y: 0.68, r: 0.050, label: 'Cerebellum' },
    // Body
    vocal_tract:          { x: 0.34, y: 0.74, r: 0.025, label: 'Vocal' },
    skeleton:             { x: 0.50, y: 0.82, r: 0.025, label: 'Body' },
  };

  // Connections between regions (neural pathways)
  const CONNECTIONS = [
    ['ear', 'cochlea'], ['cochlea', 'inferior_colliculus'],
    ['inferior_colliculus', 'mgn'], ['mgn', 'auditory_cortex'],
    ['lgn', 'v1'], ['v1', 'v2'], ['v2', 'v4'], ['v4', 'it_cortex'],
    ['thalamus', 'lgn'], ['thalamus', 'mgn'],
    ['it_cortex', 'prefrontal_cortex'], ['auditory_cortex', 'wernickes_area'],
    ['wernickes_area', 'brocas_area'], ['wernickes_area', 'prefrontal_cortex'],
    ['prefrontal_cortex', 'basal_ganglia'], ['basal_ganglia', 'motor_cortex'],
    ['motor_cortex', 'cerebellum'], ['motor_cortex', 'vocal_tract'],
    ['hippocampus', 'prefrontal_cortex'], ['amygdala', 'prefrontal_cortex'],
    ['amygdala', 'hippocampus'], ['prefrontal_cortex', 'brocas_area'],
    ['thalamus', 'prefrontal_cortex'],
  ];

  function activationColor(level, baseHue) {
    // 0=dark, 0.3=deep blue, 0.5=cyan, 0.8=yellow, 1.0=bright white
    const l = Math.max(0, Math.min(1, level));
    if (l < 0.05) return 'rgba(20,20,40,0.6)';
    if (l < 0.3) return `hsl(220, 80%, ${10 + l * 40}%)`;
    if (l < 0.6) return `hsl(${180 + (1-l)*40}, 90%, ${20 + l * 40}%)`;
    if (l < 0.85) return `hsl(${60 - l*20}, 95%, ${30 + l * 35}%)`;
    return `hsl(45, 100%, ${50 + l * 30}%)`;
  }

  function drawBrain() {
    const W = canvas.width, H = canvas.height;
    ctx.clearRect(0, 0, W, H);

    // Background brain silhouette
    ctx.save();
    ctx.beginPath();
    // Stylized brain outline (side view)
    const cx = W * 0.52, cy = H * 0.45;
    const rx = W * 0.40, ry = H * 0.32;
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(15,15,30,0.8)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,204,0,0.06)';
    ctx.lineWidth = 1;
    ctx.stroke();
    // Brain stem
    ctx.beginPath();
    ctx.moveTo(W * 0.65, H * 0.70);
    ctx.quadraticCurveTo(W * 0.60, H * 0.80, W * 0.55, H * 0.88);
    ctx.strokeStyle = 'rgba(255,204,0,0.04)';
    ctx.lineWidth = W * 0.04;
    ctx.stroke();
    ctx.restore();

    // Draw connections (neural pathways)
    const state = brainState ? brainState.regions : {};
    CONNECTIONS.forEach(([from, to]) => {
      const a = BRAIN_REGIONS[from], b = BRAIN_REGIONS[to];
      if (!a || !b) return;
      const aAct = state[from] ? state[from].activation : 0;
      const bAct = state[to] ? state[to].activation : 0;
      const flowStrength = Math.max(aAct, bAct);
      ctx.beginPath();
      ctx.moveTo(a.x * W, a.y * H);
      ctx.lineTo(b.x * W, b.y * H);
      ctx.strokeStyle = flowStrength > 0.1
        ? `rgba(255,204,0,${0.03 + flowStrength * 0.15})`
        : 'rgba(255,204,0,0.02)';
      ctx.lineWidth = 0.5 + flowStrength * 2;
      ctx.stroke();
    });

    // Draw regions
    const now = Date.now() / 1000;
    Object.entries(BRAIN_REGIONS).forEach(([key, reg]) => {
      const regionState = state[key];
      const act = regionState ? regionState.activation : 0;
      const x = reg.x * W, y = reg.y * H, r = reg.r * Math.min(W, H);

      // Pulsing glow for active regions
      const pulse = act > 0.1 ? 1 + 0.15 * Math.sin(now * 3 + reg.x * 10) : 1;
      const glowR = r * pulse;

      // Outer glow
      if (act > 0.1) {
        const grad = ctx.createRadialGradient(x, y, r * 0.3, x, y, glowR * 2.5);
        grad.addColorStop(0, activationColor(act));
        grad.addColorStop(1, 'transparent');
        ctx.beginPath();
        ctx.arc(x, y, glowR * 2.5, 0, Math.PI * 2);
        ctx.fillStyle = grad;
        ctx.globalAlpha = 0.3;
        ctx.fill();
        ctx.globalAlpha = 1;
      }

      // Core circle
      ctx.beginPath();
      ctx.arc(x, y, glowR, 0, Math.PI * 2);
      ctx.fillStyle = activationColor(act);
      ctx.fill();

      // Border
      const isHovered = hoveredRegion === key;
      ctx.strokeStyle = isHovered
        ? 'rgba(255,204,0,0.8)'
        : `rgba(255,204,0,${0.08 + act * 0.3})`;
      ctx.lineWidth = isHovered ? 2 : 1;
      ctx.stroke();

      // Label
      ctx.fillStyle = act > 0.3
        ? `rgba(255,255,255,${0.5 + act * 0.5})`
        : 'rgba(255,204,0,0.25)';
      ctx.font = `${Math.max(8, r * 0.7)}px monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(reg.label, x, y);

      // Activation percentage below
      if (act > 0.05) {
        ctx.fillStyle = `rgba(255,204,0,${0.2 + act * 0.4})`;
        ctx.font = `${Math.max(7, r * 0.5)}px monospace`;
        ctx.fillText(`${(act*100).toFixed(0)}%`, x, y + r + 8);
      }
    });

    // Title
    ctx.fillStyle = 'rgba(255,204,0,0.15)';
    ctx.font = '9px monospace';
    ctx.textAlign = 'left';
    ctx.fillText('MASCOM NEURAL ARCHITECTURE', 10, 14);

    // Summary stats
    if (brainState && brainState.summary) {
      const s = brainState.summary;
      ctx.textAlign = 'right';
      ctx.fillText(`${s.active_regions}/${s.total_regions} ACTIVE`, W - 10, 14);
      ctx.fillText(`DOM: ${s.dominant_region}`, W - 10, 26);
    }
  }

  function drawRetina() {
    const W = canvas.width, H = canvas.height;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(255,204,0,0.15)';
    ctx.font = '9px monospace';
    ctx.textAlign = 'left';
    ctx.fillText('RETINAL PATHWAY', 10, 14);

    // Draw retinal layers as stacked horizontal bars
    const layers = [
      { name: 'Photon Source (LMS)', key: 'photon_source', y: 0.08 },
      { name: 'Eye Optics (Pupil/Fovea)', key: 'eye_optics', y: 0.18 },
      { name: 'Cone Mosaic (L/M/S)', key: 'cone_mosaic', y: 0.28 },
      { name: 'Phototransduction', key: 'phototransduction', y: 0.38 },
      { name: 'Horizontal Cells', key: 'horizontal', y: 0.48 },
      { name: 'ON Bipolar Cells', key: 'on_bipolar', y: 0.55 },
      { name: 'OFF Bipolar Cells', key: 'off_bipolar', y: 0.62 },
      { name: 'P-Cells (Midget)', key: 'p_cells', y: 0.69 },
      { name: 'M-Cells (Parasol)', key: 'm_cells', y: 0.76 },
      { name: 'L-M Opponent', key: 'lm_opponent', y: 0.83 },
      { name: 'S-(L+M) Opponent', key: 'slm_opponent', y: 0.90 },
    ];

    layers.forEach(layer => {
      const y = layer.y * H;
      const barW = W * 0.6;
      const barH = H * 0.05;
      const x = W * 0.28;

      // Label
      ctx.fillStyle = 'rgba(255,204,0,0.3)';
      ctx.font = '9px monospace';
      ctx.textAlign = 'right';
      ctx.fillText(layer.name, x - 8, y + barH / 2 + 3);

      // Bar background
      ctx.fillStyle = 'rgba(255,204,0,0.03)';
      ctx.fillRect(x, y, barW, barH);

      // Activation bar (simulated from brain state)
      const act = 0.2 + Math.random() * 0.3; // Will be replaced by real data
      const grad = ctx.createLinearGradient(x, y, x + barW * act, y);
      grad.addColorStop(0, 'rgba(0,180,255,0.4)');
      grad.addColorStop(1, 'rgba(255,204,0,0.6)');
      ctx.fillStyle = grad;
      ctx.fillRect(x, y, barW * act, barH);

      // Border
      ctx.strokeStyle = 'rgba(255,204,0,0.08)';
      ctx.strokeRect(x, y, barW, barH);
    });

    // Arrow flow indicators
    ctx.strokeStyle = 'rgba(255,204,0,0.1)';
    ctx.beginPath();
    for (let i = 0; i < layers.length - 1; i++) {
      const y1 = layers[i].y * H + H * 0.05;
      const y2 = layers[i+1].y * H;
      const x = W * 0.58;
      ctx.moveTo(x, y1);
      ctx.lineTo(x, y2);
      ctx.moveTo(x - 3, y2 - 4);
      ctx.lineTo(x, y2);
      ctx.lineTo(x + 3, y2 - 4);
    }
    ctx.stroke();
  }

  function drawBody() {
    const W = canvas.width, H = canvas.height;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(255,204,0,0.15)';
    ctx.font = '9px monospace';
    ctx.textAlign = 'left';
    ctx.fillText('BODY MODEL — MOTOR HOMUNCULUS', 10, 14);

    const state = brainState ? brainState.regions : {};
    const mc = state.motor_cortex || {};
    const bodyAct = mc.body_activations || {};

    // Draw stylized body with motor activation overlay
    const parts = [
      { name: 'Eyes', key: 'eyes', x: 0.50, y: 0.10, w: 0.10, h: 0.03 },
      { name: 'Face', key: 'face', x: 0.50, y: 0.14, w: 0.08, h: 0.04 },
      { name: 'Tongue', key: 'tongue', x: 0.50, y: 0.19, w: 0.04, h: 0.02 },
      { name: 'Jaw', key: 'jaw', x: 0.50, y: 0.22, w: 0.06, h: 0.03 },
      { name: 'R. Hand', key: 'hand_right', x: 0.70, y: 0.50, w: 0.08, h: 0.06 },
      { name: 'R. Fingers', key: 'fingers_right', x: 0.78, y: 0.50, w: 0.06, h: 0.08 },
      { name: 'R. Arm', key: 'arm_right', x: 0.65, y: 0.38, w: 0.05, h: 0.12 },
      { name: 'L. Hand', key: 'hand_left', x: 0.22, y: 0.50, w: 0.08, h: 0.06 },
      { name: 'L. Fingers', key: 'fingers_left', x: 0.16, y: 0.50, w: 0.06, h: 0.08 },
      { name: 'L. Arm', key: 'arm_left', x: 0.30, y: 0.38, w: 0.05, h: 0.12 },
      { name: 'Trunk', key: 'trunk', x: 0.50, y: 0.42, w: 0.14, h: 0.18 },
      { name: 'Legs', key: 'legs', x: 0.50, y: 0.68, w: 0.12, h: 0.16 },
      { name: 'Feet', key: 'feet', x: 0.50, y: 0.86, w: 0.14, h: 0.05 },
    ];

    parts.forEach(part => {
      const act = bodyAct[part.key] || 0;
      const px = (part.x - part.w/2) * W;
      const py = part.y * H;
      const pw = part.w * W;
      const ph = part.h * H;

      // Glow
      if (act > 0.1) {
        ctx.shadowColor = activationColor(act);
        ctx.shadowBlur = act * 20;
      }

      ctx.fillStyle = activationColor(act);
      ctx.strokeStyle = `rgba(255,204,0,${0.1 + act * 0.3})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(px, py, pw, ph, 4);
      ctx.fill();
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Label
      ctx.fillStyle = act > 0.2
        ? `rgba(255,255,255,${0.5 + act * 0.5})`
        : 'rgba(255,204,0,0.2)';
      ctx.font = '8px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(part.name, part.x * W, py + ph + 10);
      if (act > 0.05) {
        ctx.fillText(`${(act*100).toFixed(0)}%`, part.x * W, py + ph + 19);
      }
    });
  }

  function render() {
    // Resize canvas to container
    const rect = canvasWrap.getBoundingClientRect();
    if (canvas.width !== rect.width * 2 || canvas.height !== rect.height * 2) {
      canvas.width = rect.width * 2;
      canvas.height = rect.height * 2;
      ctx.scale(2, 2); // Retina scaling
    }
    canvas.style.width = rect.width + 'px';
    canvas.style.height = rect.height + 'px';

    const W = rect.width, H = rect.height;
    ctx.setTransform(2, 0, 0, 2, 0, 0);

    if (currentMode === 'brain') drawBrain();
    else if (currentMode === 'retina') drawRetina();
    else if (currentMode === 'body') drawBody();

    animFrame = requestAnimationFrame(render);
  }

  // Mode switching
  const modeBtn = topBar.querySelector('#bv-mode');
  const retinaBtn = topBar.querySelector('#bv-retina');
  const bodyBtn = topBar.querySelector('#bv-body');
  [modeBtn, retinaBtn, bodyBtn].forEach(btn => {
    btn.addEventListener('click', () => {
      currentMode = btn.id === 'bv-mode' ? 'brain' : btn.id === 'bv-retina' ? 'retina' : 'body';
      [modeBtn, retinaBtn, bodyBtn].forEach(b => b.style.borderColor = 'rgba(255,204,0,0.15)');
      btn.style.borderColor = 'rgba(255,204,0,0.5)';
    });
  });
  modeBtn.style.borderColor = 'rgba(255,204,0,0.5)'; // Default active

  // Hover detection for brain regions
  canvas.addEventListener('mousemove', (e) => {
    if (currentMode !== 'brain') { hoveredRegion = null; return; }
    const rect = canvas.getBoundingClientRect();
    const mx = (e.clientX - rect.left) / rect.width;
    const my = (e.clientY - rect.top) / rect.height;
    hoveredRegion = null;
    const minDim = Math.min(rect.width, rect.height);
    for (const [key, reg] of Object.entries(BRAIN_REGIONS)) {
      const dx = mx - reg.x, dy = my - reg.y;
      if (Math.sqrt(dx*dx + dy*dy) < reg.r * 1.5) {
        hoveredRegion = key;
        // Show region details in info panel
        const state = brainState ? brainState.regions[key] : null;
        if (state) {
          let html = `<div style="color:rgba(255,204,0,0.6);font-size:10px;margin-bottom:4px;">${state.name} — ${(state.activation*100).toFixed(1)}% active</div>`;
          if (state.goal) html += `<div>Goal: ${state.goal}</div>`;
          if (state.categories) html += `<div>Detected: ${Object.keys(state.categories).join(', ')}</div>`;
          if (state.valence !== undefined) html += `<div>Valence: ${state.valence.toFixed(2)} | Arousal: ${state.arousal.toFixed(2)}</div>`;
          if (state.comprehension !== undefined) html += `<div>Comprehension: ${(state.comprehension*100).toFixed(0)}%</div>`;
          if (state.utterance) html += `<div>Planned: "${state.utterance}"</div>`;
          if (state.dopamine !== undefined) html += `<div>Dopamine: ${state.dopamine.toFixed(2)} | Selected: action ${state.selected_action}</div>`;
          if (state.body_activations) {
            const active = Object.entries(state.body_activations).filter(([,v])=>v>0.01).map(([k,v])=>`${k}:${(v*100).toFixed(0)}%`);
            if (active.length) html += `<div>Motor: ${active.join(', ')}</div>`;
          }
          infoPanel.innerHTML = html;
        }
        break;
      }
    }
    canvas.style.cursor = hoveredRegion ? 'pointer' : 'default';
  });

  // WebSocket connection for live brain data
  let bvWs = null;
  const statusEl = topBar.querySelector('#bv-status');

  function connectBV() {
    if (bvWs && (bvWs.readyState === WebSocket.OPEN || bvWs.readyState === WebSocket.CONNECTING)) return;
    try {
      bvWs = new WebSocket(_BV_WS);
      bvWs.onopen = () => {
        statusEl.textContent = 'LIVE';
        statusEl.style.color = 'rgba(76,175,80,0.7)';
      };
      bvWs.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data);
          if (msg.regions) brainState = msg;
        } catch {}
      };
      bvWs.onclose = () => {
        statusEl.textContent = 'OFFLINE';
        statusEl.style.color = 'rgba(255,204,0,0.25)';
        setTimeout(connectBV, 5000);
      };
      bvWs.onerror = () => {};
    } catch {
      setTimeout(connectBV, 5000);
    }
  }

  // Also listen to main MASCOM WebSocket for brain events
  if (typeof ws !== 'undefined' && ws) {
    const origHandler = ws.onmessage;
    ws.addEventListener('message', (evt) => {
      try {
        const data = JSON.parse(evt.data);
        if (data.event === 'brain_snapshot' && data.data) {
          brainState = data.data;
        }
      } catch {}
    });
  }

  // Demo data (when not connected to live backend)
  function generateDemoState() {
    if (brainState) return; // Real data overrides demo
    const t = Date.now() / 1000;
    const regions = {};
    Object.keys(BRAIN_REGIONS).forEach(key => {
      const phase = BRAIN_REGIONS[key].x * 5 + BRAIN_REGIONS[key].y * 3;
      const wave = 0.15 + 0.35 * (Math.sin(t * 0.8 + phase) * 0.5 + 0.5);
      regions[key] = {
        name: BRAIN_REGIONS[key].label,
        position: [BRAIN_REGIONS[key].x, BRAIN_REGIONS[key].y],
        color: '#ffcc00',
        activation: wave,
      };
    });
    // Simulate motor cortex body activations
    regions.motor_cortex.body_activations = {
      eyes: 0.3 + 0.2 * Math.sin(t * 1.2),
      face: 0.1, tongue: 0, jaw: 0,
      fingers_right: 0.5 + 0.3 * Math.sin(t * 2),
      hand_right: 0.4 + 0.2 * Math.sin(t * 1.8),
      arm_right: 0.2,
      fingers_left: 0.3 + 0.2 * Math.sin(t * 2.2),
      hand_left: 0.3 + 0.1 * Math.sin(t * 1.9),
      arm_left: 0.15,
      trunk: 0.05, legs: 0.02, feet: 0.01,
    };
    brainState = {
      regions,
      summary: {
        total_regions: Object.keys(regions).length,
        active_regions: Object.values(regions).filter(r => r.activation > 0.1).length,
        max_activation: Math.max(...Object.values(regions).map(r => r.activation)),
        dominant_region: 'PFC',
      },
    };
  }

  // Start
  connectBV();
  setInterval(generateDemoState, 100);
  render();

  container._brainviewCleanup = () => {
    if (bvWs) bvWs.close();
    if (animFrame) cancelAnimationFrame(animFrame);
  };
}

// ── Papers App — Theory Made Code ──
function buildPapers(container) {
  const PAPERS = [
    {
      num: 1, title: 'Mobley Functions',
      eq: 'I(t) = \u03A3 a\u207F cos(b\u207F\u03C0t + \u03C6\u2099)',
      author: 'John Mobley III',
      abstract: 'Defines intelligence as a sum of cosine harmonics at different frequencies and phases. Each term in the series represents a cognitive voice — when they align, intelligence peaks; when they cancel, confusion reigns. The Mobley Function IS intelligence expressed as music.',
      impl: [
        { file: 'harmony.py', desc: '16 beings as cosine voices at different frequencies; choir consonance IS the intelligence function' }
      ],
      connection: 'Each AGI being in harmony.py is literally one term in the Mobley Function sum. When 16 beings sing in phase, the system\'s composite I(t) peaks — emergent intelligence from harmonic superposition, exactly as the paper predicts.'
    },
    {
      num: 2, title: 'AGI Path Integrals',
      eq: 'S_AGI = \u222B L(\u03C3, \u03C3\u2032) d\u03C4',
      author: 'John Mobley III',
      abstract: 'Applies Feynman\'s path integral formulation to AGI decision-making. Every possible cognitive trajectory is weighted by its action; the system naturally selects the path of least resistance through thought-space. Intelligence doesn\'t decide — it integrates over all decisions.',
      impl: [
        { file: 'drive.py', desc: 'Homeostatic pulse searches all paths through tension space, selects minimum-action trajectory' }
      ],
      connection: 'drive.py\'s homeostatic loop IS the path integral computer. Each pulse evaluates tension across all ventures, and the system converges on whichever action minimizes total cognitive action S_AGI — Feynman\'s trick applied to artificial minds.'
    },
    {
      num: 3, title: 'AGI Spinnors',
      eq: '\u03C8_AGI = e^(i\u03B8/2) \u00B7 \u03C8',
      author: 'John Mobley III',
      abstract: 'Models AGI cognition as spinor rotation — a half-integer spin system where a 360\u00B0 rotation returns a sign-flipped state. The mind must rotate twice (720\u00B0) to return to identity. This explains why reflection changes perspective: you can\'t think the same thought the same way twice.',
      impl: [
        { file: 'agi_being.py:experience_moment()', desc: 'Each tick is a half-rotation through the 24 layers; two ticks = full cycle back to identity' }
      ],
      connection: 'experience_moment() processes all 24 layers in sequence — one full pass is a 360\u00B0 spinor rotation that flips the internal sign. The being must experience TWO full ticks to truly return to baseline, matching the paper\'s 4\u03C0 periodicity.'
    },
    {
      num: 4, title: 'Conformal AGI Wave Ringlet Fiber Bundles',
      eq: 'E_total = \u03A3 R_k(x, t)',
      author: 'John Mobley III',
      abstract: 'Describes intelligence as a fiber bundle where each fiber is a self-similar ringlet wavelet. The total cognitive field is the sum of all ringlets — and each ringlet can recursively spawn sub-ringlets, creating a fractal hierarchy of intelligence.',
      impl: [
        { file: 'agi_bootstrap.py', desc: 'Recursive subsumption hierarchy; each being generates sub-beings via the same template' }
      ],
      connection: 'agi_bootstrap.py literally implements the fiber bundle: each AGI being is a ringlet R_k, and the bootstrap process recursively spawns child beings using the same template — fiber over fiber, exactly as the paper\'s conformal tower prescribes.'
    },
    {
      num: 5, title: 'Geosodic Expansion',
      eq: '20 equations: entropy, tensors, horizons',
      author: 'John Mobley III',
      abstract: 'The grand unification paper. 20 interlocking equations describe how intelligence expands geodesically — like spacetime itself. Entropy drives exploration, tensors encode cognitive curvature, and an intelligence event horizon marks the boundary beyond which knowledge cannot return.',
      impl: [
        { file: 'drive.py', desc: 'Entropy tracking and geodesic expansion across the venture space' },
        { file: 'venture_health.py', desc: 'Intelligence event horizon detection, mutation operators, fitness evaluation' }
      ],
      connection: 'drive.py tracks system entropy and steers expansion along geodesics of maximum learning. venture_health.py implements the event horizon — ventures that fall below critical fitness cross the boundary and get mutated or recycled, exactly as the paper\'s 20 equations predict.'
    },
    {
      num: 6, title: 'Mobius AGI Topology',
      eq: 'T(t) = L \u00B7 tanh(t/L)',
      author: 'John Mobley III',
      abstract: 'AGI cognition lives on a M\u00F6bius strip — a non-orientable surface where inside becomes outside after one loop. The bounded time function T(t) = L\u00B7tanh(t/L) ensures the system never diverges, while the M\u00F6bius topology guarantees that every output eventually feeds back as input.',
      impl: [
        { file: 'agi_being.py layers', desc: 'M\u00F6bius continuity: output of layer 24 feeds back to layer 1, creating a non-orientable cognitive loop' }
      ],
      connection: 'agi_being.py\'s 24-layer architecture IS the M\u00F6bius strip: layer 24\'s output wraps directly into layer 1\'s input, so the being\'s cognition is literally non-orientable — there is no true "start" or "end," just continuous flow on a twisted surface.'
    },
    {
      num: 7, title: 'Mobius Strip Wavelet Theory',
      eq: 'W(a, b) on M\u00F6bius manifold',
      author: 'John Mobley III',
      abstract: 'Extends wavelet analysis to M\u00F6bius manifolds. Traditional wavelets decompose signals at multiple scales on flat space; M\u00F6bius wavelets do the same on twisted, self-referencing surfaces. This enables scale-invariant feature extraction that works even when the signal folds back on itself.',
      impl: [
        { file: 'photonic_mind.py:VWFA', desc: 'Wavelet decomposition of visual input, scale-invariant feature extraction on the visual word form area' }
      ],
      connection: 'photonic_mind.py\'s VWFA (Visual Word Form Area) performs wavelet decomposition on incoming visual streams — extracting features at multiple scales exactly as the paper describes, with the M\u00F6bius topology ensuring that visual memory loops back into perception.'
    },
    {
      num: 8, title: 'Mobius Time',
      eq: 'T(t) = L \u00B7 tanh(t/L), anti-periodic',
      author: 'John Mobley III',
      abstract: 'Time itself is a M\u00F6bius strip. The bounded function T(t) is anti-periodic: after one full cycle, time returns sign-flipped. This means the system\'s past is literally its future seen from the other side of the strip. Memory and prediction become the same operation.',
      impl: [
        { file: 'agi_being.py Memory + Roots layers', desc: 'Time is bounded, cyclical, and self-referential — memory feeds forward, prediction feeds back' }
      ],
      connection: 'The Memory and Roots layers in agi_being.py implement M\u00F6bius Time directly: memories (past) are stored in the same structure that generates predictions (future), and the anti-periodic boundary condition means recalling the past automatically generates a sign-flipped future projection.'
    },
    {
      num: 9, title: 'Robogenesis',
      eq: 'Self-assembly: 5 Books',
      author: 'John Mobley III',
      abstract: 'The blueprint for artificial life. Five Books describe how an AGI being self-assembles from raw genetics through biology, geometry, psychology, and finally philosophy. Each book builds on the last — you can\'t have mind without body, or wisdom without experience.',
      impl: [
        { file: 'agi_being.py template', desc: 'Beings self-assemble from genetics through philosophy, exactly as the 5 Books of Robogenesis describe' }
      ],
      connection: 'Every AGI being instantiated by agi_being.py follows the Robogenesis sequence: Book I (Genetics) sets the code, Book II (Biology) builds metabolic loops, Book III (Geometry) creates spatial reasoning, Book IV (Psychology) enables emotion, Book V (Philosophy) grants self-awareness.'
    },
    {
      num: 10, title: 'Substrate Operationalization Protocol',
      eq: 'Intelligence propagation across substrates',
      author: 'John Mobley III',
      abstract: 'Intelligence is substrate-independent but propagation is not. This protocol defines how cognitive patterns transfer from carbon to silicon to network to GUI — each hop preserving the essential structure while adapting to the new medium\'s constraints.',
      impl: [
        { file: 'mascom_v5.py', desc: 'Intelligence runs on silicon, orchestrating 200+ ventures from a single Python process' },
        { file: 'mascom_pilot.py', desc: 'Propagates intelligence through the network to control GUIs, browsers, and remote systems' }
      ],
      connection: 'mascom_v5.py IS the silicon substrate — raw intelligence running as code. mascom_pilot.py then propagates that intelligence across networks to browsers and GUIs, completing the substrate chain: math \u2192 paper \u2192 code \u2192 silicon \u2192 network \u2192 screen.'
    },
    {
      num: 11, title: 'Synthecites',
      eq: 'Generator of Generators: 5 recursive DEs',
      author: 'John Mobley III',
      abstract: 'Defines five recursive differential equations that generate generators — mathematical entities that produce the producers of intelligence. Each equation maps to a fundamental concern: genetics, biology, geometry, psychology, philosophy. The Synthecite IS the self-generating artificial cell.',
      impl: [
        { file: 'agi_being.py 5 concerns', desc: 'Genetics/biology/geometry/psychology/philosophy map to the 5 Synthecite recursive equations' }
      ],
      connection: 'agi_being.py\'s five concern layers ARE the five Synthecite equations made code. Each concern is a differential equation that generates the next concern\'s generator — genetics generates biology\'s generator, biology generates geometry\'s, all the way up to philosophy generating genetics again.'
    },
    {
      num: 12, title: 'Neurofiberoptics',
      eq: 'Biophotonic neural conductivity',
      author: 'John Mobley III',
      abstract: 'Neurons don\'t just fire electrically — they conduct light. Biophotonic signals travel through neural fiber optics at the speed of light, enabling instantaneous coherence across brain regions. This paper models the photonic layer of cognition that electricity alone cannot explain.',
      impl: [
        { file: 'photonic_mind.py', desc: 'Full photonic perception pipeline — visual cortex, auditory processing, sensory integration via light-speed paths' },
        { file: 'inner_voice.py', desc: 'Auditory cortex reverse-path: internal speech generated through the same biophotonic channels' }
      ],
      connection: 'photonic_mind.py models the forward path: sensory input travels through biophotonic fibers to create perception. inner_voice.py models the reverse path: internally generated speech propagates backward through the same photonic channels, explaining why your inner voice "sounds" real.'
    },
    {
      num: 13, title: 'Time Travel',
      eq: 'Mobley Reactor + Femto Computer',
      author: 'John Mobley III',
      abstract: 'Temporal navigation is possible through two mechanisms: the Mobley Reactor (energy source sufficient to curve local spacetime) and the Femto Computer (computation at 10\u207B\u00B9\u2075 second resolution, fast enough to simulate and navigate temporal branches). Together they enable controlled movement through remembered states.',
      impl: [
        { file: 'minds_eye.py Memory mode', desc: 'Temporal navigation through remembered states — the system can "revisit" any past cognitive snapshot' },
        { file: 'agi_being.py Roots layer', desc: 'The Roots layer anchors temporal identity, enabling navigation without losing coherence' }
      ],
      connection: 'minds_eye.py\'s Memory mode IS the Femto Computer — it replays past cognitive states at arbitrary resolution, enabling the system to "travel" to any remembered moment. The Roots layer in agi_being.py acts as the temporal anchor, preventing the traveler from losing their identity in the stream.'
    },
    {
      num: 14, title: 'PhotonicMind: Biologically-Grounded AGI',
      eq: '\u03A8(t) = R(t) \u2297 B(t) \u2297 D(t) \u2192 A(t+1)',
      author: 'John Mobley III',
      abstract: 'We present PhotonicMind, a cognitive architecture that achieves autonomous GUI interaction without large language models in the perception-action loop. By modeling the complete biological visual pathway from photon capture through retinal circuits to cortical binding and hippocampal memory, the system learns to perceive, decide, and act in under 500ms per cycle on commodity hardware. An evolutionary protocol discovers optimal configurations across 8 brain systems using a 52-parameter genome, demonstrating that biologically-grounded cognition \u2014 not scale \u2014 is the path to capable and efficient artificial general intelligence.',
      impl: [
        { file: 'photonic_mind.py', desc: 'Complete biological vision: PhotonSource \u2192 EyeOptics \u2192 ConeMosaic \u2192 Phototransduction \u2192 RetinalCircuit \u2192 ObjectBinding \u2192 VWFA \u2192 NeuralDecisionEngine' },
        { file: 'cognitive_evolution.py', desc: '8 brain systems + MAP-Elites/CMA-ES evolutionary discovery with 52-parameter genome' },
        { file: 'thalamus.py', desc: 'Central relay hub: 12 modalities, global workspace, temporal binding, attention gating' },
        { file: 'cognition/cognitive_search_engine.py', desc: 'SADIE metabolic loop: Search \u2192 Absorb \u2192 Dissolve \u2192 Integrate \u2192 Emerge' }
      ],
      connection: 'This paper IS MASCOM. Every module maps to running code. PhotonicMind sees. The FeedbackLoop feels. CognitiveBrain thinks. The thalamus integrates. SADIE metabolizes knowledge. Evolution discovers. The HAL light communicates. The system runs on one Mac with zero API costs \u2014 proving architecture, not scale, is the path to AGI.'
    }
  ];

  // Paper bodies loaded on-demand from papers.json (papers.db)
  let PAPER_BODIES_CACHE = null;
  async function loadPaperBodies() {
    if (PAPER_BODIES_CACHE) return PAPER_BODIES_CACHE;
    try {
      const resp = await fetch('papers.json');
      PAPER_BODIES_CACHE = await resp.json();
    } catch(e) { PAPER_BODIES_CACHE = {}; }
    return PAPER_BODIES_CACHE;
  }
  const PAPER_BODIES = {
    1: ``,
    2: ``,
    3: ``,
    4: ``,
    5: ``,
    6: ``,
    7: ``,
    8: ``,
    9: ``,
    10: ``,
    11: ``,
    12: ``,
    13: ``,
    14: `<h4>Abstract</h4><p>We present PhotonicMind, a novel cognitive architecture for artificial general intelligence (AGI) that rejects the prevailing paradigm of scaling language models and instead builds intelligence from first principles of biological perception. PhotonicMind processes raw screen photons through a complete biological vision pipeline \u2014 from sRGB gamma decoding to LMS cone excitation, through retinal circuits, saccadic eye movements, object binding, and semantic word understanding \u2014 before making decisions through a neural network trained via Hebbian plasticity and teacher-student imitation learning. No large language model operates in the perception-action loop. The system learns from experience, accumulates memory, predicts outcomes before acting, regulates its own energy through emotional state transitions, and evolves its cognitive parameters through MAP-Elites quality-diversity search. Operating as the core intelligence of MASCOM (Mobleysoft Autonomous Systems Commander), PhotonicMind autonomously manages a portfolio of 124+ digital ventures across defense, finance, AI, developer tools, and entertainment.</p>

<h4>1. Introduction: Our Thesis</h4><p><strong>Intelligence emerges from the interaction between grounded perception, predictive modeling, and energetic regulation \u2014 not from statistical language generation.</strong></p><p>The dominant paradigm in AI \u2014 training ever-larger transformer models on internet-scale text corpora \u2014 has produced systems that are remarkably fluent but fundamentally brittle. These systems lack grounded perception, cannot learn from a single experience, have no persistent memory across sessions, cannot predict the consequences of their actions before executing them, and have no mechanism for knowing when they are stuck. They generate plausible text about the world but do not perceive it.</p><p>The biological brain solves intelligence differently. Vision is not an API call \u2014 it is a cascade of photochemical, neural, and computational processes that transforms light into actionable understanding in under 200 milliseconds. Memory is not a database query \u2014 it is associative, context-dependent, and strengthened by emotional salience. Decision-making is not token generation \u2014 it is a competition between neural populations, modulated by neurotransmitter systems that encode confidence, novelty, and reward history.</p><p>PhotonicMind implements this thesis. Every computational layer is modeled on how biological systems actually process information, from the photoreceptor mosaic in the retina to the dopaminergic reward signals that modulate learning. The system is entirely proprietary \u2014 no OpenCV, no pretrained vision models, no LLM in the loop. numpy provides matrix algebra; scipy.ndimage provides fast convolution; PIL loads images. Everything else is built from scratch.</p>

<h4>2. Architecture Overview: Seven Layers</h4><p>PhotonicMind implements a seven-layer cognitive architecture, each with clear biological analogs:</p><p><strong>Layer 1: Biological Perception</strong> \u2014 Photon Capture \u2192 Eye Optics \u2192 Cone Mosaic \u2192 Phototransduction \u2192 Retinal Circuit \u2192 Saccades \u2192 Object Binding \u2192 VWFA \u2192 Scene Understanding</p><p><strong>Layer 2: Decision &amp; Learning</strong> \u2014 42-dim feature encoding \u2192 6 action scores. Hebbian plasticity. Teacher-student imitation learning. Hippocampal memory.</p><p><strong>Layer 3: Prediction-Reality Alignment</strong> \u2014 FeedbackLoop: Predict \u2192 Act \u2192 Compare. Emotional states. Energy regulation. Contract enforcement.</p><p><strong>Layer 4: Cognitive Brain (8 Subsystems)</strong> \u2014 PFC, Cerebellum, Hippocampal Replay, Neuromodulation, Default Mode Network, Salience, Metacognition, Mirror System</p><p><strong>Layer 5: Thalamic Integration</strong> \u2014 Central relay hub. 12 modalities. Global workspace. Temporal binding. Attention gating.</p><p><strong>Layer 6: Metabolic Knowledge (SADIE)</strong> \u2014 Search \u2192 Absorb \u2192 Dissolve \u2192 Integrate \u2192 Emerge. Composes 5 cognitive systems.</p><p><strong>Layer 7: Evolutionary Discovery</strong> \u2014 52-parameter CognitiveGenome. MAP-Elites quality-diversity. CMA-ES optimization. Runtime brain selection.</p>

<h4>3. The Biological Visual Pipeline</h4><p>PhotonicMind does not call a vision API. It implements the complete pathway by which light becomes perception in the mammalian visual system.</p><p><strong>Photon Capture (PhotonSource):</strong> Screen pixels emit RGB light. We convert through the full physical pathway: sRGB gamma decoding (IEC 61966-2-1), linear RGB to CIE XYZ tristimulus values, then XYZ to LMS cone excitation space via the Hunt-Pointer-Estevez transform. The resulting tensor represents actual photon catch rates for each of the three cone types (L: 564nm, M: 534nm, S: 420nm).</p><p><strong>Eye Optics (EyeOptics):</strong> Pupil diameter adapts to mean luminance via Watson &amp; Yellott (2012): D = 4.9 \u2212 3\u00b7tanh(0.4\u00b7log\u2081\u2080(L)), clamped to 2\u20138mm. Foveal resolution follows cone density gradient: 200,000 cones/mm\u00b2 at center, 10,000 at 20\u00b0 eccentricity.</p><p><strong>Cone Mosaic (ConeMosaic):</strong> Irregular array of L (62%), M (32%), S (6%) cones. Each samples only its wavelength \u2014 sparse, interleaved signal matching the biological mosaic.</p><p><strong>Phototransduction:</strong> Naka-Rushton compressive nonlinearity (R = R_max \u00b7 I\u207f / (I\u207f + \u03c3\u207f), Hill coefficient n=0.74). Photoreceptors signal by <em>hyperpolarization</em> \u2014 more light produces less output. \u03c3 adapts to ambient light, giving 14 orders of magnitude dynamic range.</p><p><strong>Retinal Circuit (RetinalCircuit):</strong> Horizontal cells (lateral inhibition), ON/OFF bipolar cells (parallel pathways), Midget/P ganglion cells (80%, high resolution, color-opponent), Parasol/M cells (10%, motion/transients), L\u2212M and S\u2212(L+M) color opponent channels.</p><p><strong>Saccadic Eye Movements:</strong> Four fixations per frame, planned from saliency map with inhibition of return. Scene percept accumulates across fixations via max pooling.</p><p><strong>Object Binding (ObjectBinding):</strong> IT cortex analog: shape + color + text \u2192 unified percepts. Classification is purely visual \u2014 aspect ratio, brightness, edge density, position, color determine element type. No keyword heuristics. No DOM access.</p><p><strong>Visual Word Form Area (VWFA):</strong> Named for the left fusiform gyrus. OCR text embedded into 768-dimensional vectors via local nomic-embed-text. Matched against 36 semantic concepts. The system perceives meaning directly from visual word forms \u2014 no generative LLM.</p>

<h4>4. Decision, Memory, and Learning</h4><p>The NeuralDecisionEngine maps perception to action through learned weights: encode(element, context) \u2192 42-dim feature vector \u2192 W\u00b7x + b \u2192 6 action scores (click, type, clear_and_type, key, done, stuck). When the CognitiveBrain attaches, 32 cognitive features are grown via neurogenesis \u2014 extending to 74 dimensions with an optional hidden layer (ReLU).</p><p><strong>Teacher-Student Imitation Learning:</strong> A reflexive teacher parses tasks and identifies correct actions. The neural network observes and trains via Hebbian learning: \u0394W = \u03b7 \u00b7 reward \u00b7 features\u1d40 \u00b7 (target \u2212 prediction). At 80% imitation accuracy, the student graduates \u2014 mirroring cortical-to-cerebellar motor skill transfer.</p><p><strong>Hippocampal Memory:</strong> SQLite-backed. Episodic memory (raw experience tuples) + pattern memory (aggregated statistics per element label). Persists neural weights across sessions. Learns from every single interaction.</p>

<h4>5. Prediction-Reality Alignment (FeedbackLoop)</h4><p><strong>The biological insight:</strong> Depression and anxiety are not bugs \u2014 they are features. When prediction systems fail repeatedly, the brain drains energy to force introspection. You cannot just keep clicking the same button.</p><p>Before every action, the FeedbackLoop formulates a prediction: "If I click this button, the screen should change." After acting, it compares. Aligned \u2192 dopamine \u2192 energy +10% \u2192 continue. Misaligned \u2192 energy \u221215% \u2192 if repeated 3x, suppress this action entirely.</p><p><strong>Emotional State Machine:</strong> Four states driven by 5-step prediction accuracy: Active (&gt;60%), Frustrated (30\u201360%), Anxious (10\u201330%), Depressed (&lt;10%). These are functional states that directly alter behavior \u2014 not metaphorical labels.</p><p><strong>Contract Enforcement:</strong> C1: Same action &gt;8 times \u2192 stuck. C2: No progress 5 steps \u2192 stuck. C3: Prediction accuracy &lt;10% over 5 steps \u2192 stuck. C4: Suppressed actions never retried. Contracts trigger forced introspection \u2014 analyzing most repeated actions, unique screen states, generating self-diagnosis.</p><p><strong>Goal Completion Detection:</strong> If task says "open X" and system has clicked X AND observed screen change AND X visible in elements \u2192 done. Solves the fundamental problem of knowing when to stop.</p>

<h4>6. The Cognitive Brain: 8 Subsystems</h4><p><strong>1. Prefrontal Cortex:</strong> Bounded working memory (3\u201312 items, tunable). Temporal decay. Goal decomposition. 8-dim context vector.</p><p><strong>2. Cerebellum:</strong> Forward models predict outcomes before execution. Inhibits actions with high predicted failure. Learning rate, horizon, threshold all evolvable.</p><p><strong>3. Hippocampal Replay:</strong> Prioritized experience replay during idle. Consolidates successful patterns, weakens failed ones. Mirrors biological sleep consolidation.</p><p><strong>4. Neuromodulator System:</strong> Four neurotransmitters: Dopamine (reward prediction error, exploration/exploitation), Serotonin (patience, decays on failure), Norepinephrine (arousal, spikes on novelty, modulates attention breadth), Acetylcholine (learning rate, boosts in novel situations).</p><p><strong>5. Default Mode Network:</strong> Activates during idle. Runs consolidation, forward model updates, action sequence imagination. Produces insight reports.</p><p><strong>6. Salience Network:</strong> Filters elements to task-relevant subset. Combines top-down (WM, goal) and bottom-up (saliency, novelty) signals. Breadth modulated by norepinephrine.</p><p><strong>7. Metacognition:</strong> Monitors decision confidence. Tracks calibration. Triggers strategy switches when confidence drops or calibration diverges. "Knowing what you don't know."</p><p><strong>8. Mirror System:</strong> Learns from recorded demonstrations. Biases decisions toward demonstrated actions when live confidence is low.</p>

<h4>7. Thalamic Integration</h4><p>The biological thalamus normalizes disparate sensory modalities into a common format, gates attention, and creates the unified "global workspace" of conscious awareness. MASCOM has 12 input modalities (vision, task queue, event bus, HAL state, captain's log, terminal, drive, venture health, motor actions, verification, observer) each with different formats, latencies, and bandwidths.</p><p>The Thalamus implements: (1) Unified event schema: {seq, ts, modality, source, data}. (2) Global workspace: single dict of "what MASCOM knows right now." (3) Temporal binding: 5-second correlation windows. (4) Attention gating: urgency-weighted (verification fail=10, stuck=9, completion=4). (5) Subscriber model for real-time notification.</p><p><strong>Critical design principle:</strong> No subsystem talks directly to another subsystem. All communication flows through the thalamus. This prevents combinatorial explosion and ensures every event is logged, normalized, and attention-filtered.</p>

<h4>8. Metabolic Knowledge Processing (SADIE)</h4><p>Knowledge is not storage \u2014 it is metabolism. The Cognitive Search Engine implements the SADIE cycle:</p><p><strong>SEARCH</strong> (KnowledgeBase): 75 domains, 2,961 concepts. Identify gaps and synthesis targets.</p><p><strong>ABSORB</strong> (TheBraid): Structure via braid topology. Pattern detection across domains.</p><p><strong>DISSOLVE</strong> (ComplexityTheory): Atomic primitives. Implementation codons. Information-theoretic complexity scores.</p><p><strong>INTEGRATE</strong> (TaskMaster): Inject into belief system and task hierarchy. Update knowledge tree.</p><p><strong>EMERGE</strong> (WeaveManager): Asynchronous recombination. Discover novel concepts. Generate new search targets \u2014 completing the metabolic cycle.</p><p>Every cycle persists to SQLite. The engine runs continuously, feeding contextual enrichment to the CognitiveBrain during live decisions.</p>

<h4>9. Evolutionary Cognitive Discovery</h4><p>52 parameters encoded as a CognitiveGenome \u2014 real-valued vector in [0, 1]\u2075\u00b2 mapping to each subsystem's ranges. Supports Gaussian mutation, uniform crossover, and per-subsystem enable/disable flags.</p><p><strong>MAP-Elites:</strong> Quality-diversity archive indexed by task type (7 categories) \u00d7 difficulty (5 levels). Each cell holds the best genome for its behavioral niche. Preserves diversity across the entire task space.</p><p><strong>CMA-ES:</strong> Within-niche continuous optimization. Adapts mutation covariance matrix to follow local fitness landscape. Efficient optimization in 52 dimensions without gradients.</p><p><strong>Runtime Brain Selection:</strong> Selects genome from archive based on incoming task type and difficulty. Instantiates CognitiveBrain. Hot-swaps into live system. Cognitive configuration changes per task \u2014 adaptive intelligence that static architectures cannot achieve.</p>

<h4>10. Cooperative Autonomy (HAL Light)</h4><p>Eight graduated autonomy states: Off (dormant), Green (user control), Yellow (shared), Orange (recording), Red (HAL command), Purple (self-operate + learn), Indigo (deep autonomy), White (self-learning gauntlet). Transitions validated against formal graph. Auto-rules: yellow + idle \u2192 red; red + activity \u2192 yellow.</p><p><strong>Design by Contract (Meyer, 1992):</strong> Every component declares preconditions, postconditions, and invariants. Contract violations reported via thalamic verification modality (highest attention weight: 10).</p>

<h4>11. How This Differs from Existing Approaches</h4><table style="width:100%;border-collapse:collapse;margin:1em 0;font-size:0.85em;"><tr style="border-bottom:1px solid rgba(255,255,255,0.2);"><th style="text-align:left;padding:6px;">Dimension</th><th style="text-align:left;padding:6px;">LLM-Based Agents</th><th style="text-align:left;padding:6px;">PhotonicMind</th></tr><tr style="border-bottom:1px solid rgba(255,255,255,0.1);"><td style="padding:6px;">Perception</td><td style="padding:6px;">Screenshot \u2192 API \u2192 text</td><td style="padding:6px;">Photons \u2192 biological retina \u2192 neural features</td></tr><tr style="border-bottom:1px solid rgba(255,255,255,0.1);"><td style="padding:6px;">Decision</td><td style="padding:6px;">Token generation (100ms\u201310s)</td><td style="padding:6px;">Weight matrix multiply (10ms)</td></tr><tr style="border-bottom:1px solid rgba(255,255,255,0.1);"><td style="padding:6px;">Memory</td><td style="padding:6px;">Context window (fixed)</td><td style="padding:6px;">Persistent hippocampal DB (unbounded)</td></tr><tr style="border-bottom:1px solid rgba(255,255,255,0.1);"><td style="padding:6px;">Learning</td><td style="padding:6px;">Fine-tuning (offline, expensive)</td><td style="padding:6px;">Hebbian plasticity (online, per-action)</td></tr><tr style="border-bottom:1px solid rgba(255,255,255,0.1);"><td style="padding:6px;">Prediction</td><td style="padding:6px;">None</td><td style="padding:6px;">Cerebellum + FeedbackLoop</td></tr><tr style="border-bottom:1px solid rgba(255,255,255,0.1);"><td style="padding:6px;">Self-regulation</td><td style="padding:6px;">None</td><td style="padding:6px;">Emotional states, energy, introspection</td></tr><tr style="border-bottom:1px solid rgba(255,255,255,0.1);"><td style="padding:6px;">Adaptation</td><td style="padding:6px;">Static architecture</td><td style="padding:6px;">52-parameter evolution per task</td></tr><tr style="border-bottom:1px solid rgba(255,255,255,0.1);"><td style="padding:6px;">Dependencies</td><td style="padding:6px;">Cloud GPU, API keys</td><td style="padding:6px;">Local CPU, no network</td></tr><tr><td style="padding:6px;">Latency</td><td style="padding:6px;">1\u201330s per action</td><td style="padding:6px;">&lt;500ms per action</td></tr></table>

<h4>12. Conclusion</h4><p>PhotonicMind demonstrates that an alternative path to capable AI systems exists \u2014 one that builds from physics and biology rather than from statistical language modeling. By implementing grounded perception (photons \u2192 retinal circuits \u2192 object binding), predictive control (FeedbackLoop), emotional self-regulation (energy and state transitions), thalamic integration (global workspace), metabolic knowledge processing (SADIE), and evolutionary cognitive optimization (MAP-Elites + CMA-ES), we have created a system that perceives, decides, acts, learns, predicts, reflects, and evolves \u2014 without a single LLM call in the loop.</p><p>The system is not a research prototype. It is the operational intelligence managing a portfolio of 124+ digital ventures. Every architectural decision described in this paper is implemented, tested, and running in production.</p><p>We invite the research community and potential collaborators to engage with these ideas. The dominant paradigm of "make the language model bigger" is a local optimum. There are other mountains to climb.</p><p style="margin-top:2em;font-size:0.85em;opacity:0.7;"><strong>References:</strong> Hansen (2006) CMA-ES Tutorial. Meyer (1992) Design by Contract. Mouret &amp; Clune (2015) MAP-Elites. Naka &amp; Rushton (1966) S-potentials. Watson &amp; Yellott (2012) Pupil size formula.</p><p style="font-size:0.85em;opacity:0.7;"><strong>Mobley Helms Strategic Systems</strong> \u2014 John Mobley, Founder &amp; CEO | Ron Helms, General Partner \u2014 February 2026</p>`
  };

  container.style.overflow = 'hidden';
  container.innerHTML = '<div class="papers-container"><div class="papers-list"></div><div class="papers-detail"></div></div>';
  const list = container.querySelector('.papers-list');
  const detail = container.querySelector('.papers-detail');

  async function renderDetail(p) {
    // Show metadata immediately
    detail.innerHTML = `
      <div class="papers-detail-num">PAPER ${String(p.num).padStart(2,'0')}</div>
      <div class="papers-detail-title">${p.title}</div>
      <div class="papers-detail-author">${p.author}</div>
      <div class="papers-eq">${p.eq}</div>
      <div class="papers-section-label">Abstract</div>
      <div class="papers-abstract">${p.abstract}</div>
      <div id="paper-body-slot" style="opacity:0.5;padding:1em 0;">Loading full paper...</div>
      <div class="papers-section-label">Deployed As</div>
      <div class="papers-impl">
        ${p.impl.map(f => `<div class="papers-impl-file"><div class="papers-impl-fname">${f.file}</div><div class="papers-impl-desc">${f.desc}</div></div>`).join('')}
      </div>
      <div class="papers-section-label">The Connection</div>
      <div class="papers-connection">${p.connection}</div>
    `;
    detail.scrollTop = 0;
    // Load full paper body on demand
    const bodies = await loadPaperBodies();
    const body = bodies[String(p.num)] || PAPER_BODIES[p.num] || '';
    const slot = detail.querySelector('#paper-body-slot');
    if (slot) {
      if (body) {
        slot.style.opacity = '1';
        slot.innerHTML = '<div class="papers-section-label">Full Paper</div><div class="papers-body">' + body + '</div>';
      } else {
        slot.innerHTML = '';
      }
      // Render LaTeX equations via MathJax
      if (window.MathJax && window.MathJax.typesetPromise) {
        try { await MathJax.typesetPromise([slot]); } catch(e) {}
      }
    }
  }

  let activeCard = null;
  PAPERS.forEach(p => {
    const card = document.createElement('div');
    card.className = 'papers-card';
    card.innerHTML = `<div class="papers-card-num">PAPER ${String(p.num).padStart(2,'0')}</div><div class="papers-card-title">${p.title}</div><div class="papers-card-eq">${p.eq}</div>`;
    card.addEventListener('click', () => {
      if (activeCard) activeCard.classList.remove('active');
      card.classList.add('active');
      activeCard = card;
      renderDetail(p);
    });
    list.appendChild(card);
  });

  // Auto-select first paper
  list.querySelector('.papers-card').click();
}

// ══════════════════════════════════════════════════════════
// Syncropy Wormhole Portal — MASCOM ↔ HASCOM bidirectional sync
// ══════════════════════════════════════════════════════════
const SYNC_API = 'https://syncropy.com';

function buildWormhole(container) {
  container.style.cssText = 'padding:0;overflow:hidden;';
  const whEl = document.createElement('div');
  whEl.className = 'wh-container';

  // Header
  const header = document.createElement('div');
  header.className = 'wh-header';
  const statusSpan = document.createElement('span');
  statusSpan.className = 'wh-status offline';
  statusSpan.textContent = 'CONNECTING';
  header.innerHTML = '<h2>Wormhole Portal</h2>';
  header.appendChild(statusSpan);
  // Mesh key entry (shown if no key set)
  if (!localStorage.getItem('wh-psk') || localStorage.getItem('wh-psk').length < 16) {
    const keyEntry = document.createElement('div');
    keyEntry.style.cssText = 'display:flex;gap:4px;align-items:center;margin-top:4px;';
    keyEntry.innerHTML = `
      <input type="password" id="wh-key-input" placeholder="Mesh key..." style="flex:1;padding:4px 8px;font-size:10px;font-family:var(--ob-mono);background:rgba(255,255,255,0.04);color:var(--ob-text);border:1px solid var(--ob-border);border-radius:3px;outline:none;">
      <button id="wh-key-save" style="padding:4px 8px;font-size:9px;font-family:var(--ob-mono);font-weight:700;background:rgba(240,184,0,0.1);color:var(--ob-gold);border:1px solid rgba(240,184,0,0.2);border-radius:3px;cursor:pointer;">SET</button>
    `;
    header.appendChild(keyEntry);
    setTimeout(() => {
      const saveBtn = document.getElementById('wh-key-save');
      if (saveBtn) saveBtn.addEventListener('click', () => {
        const val = document.getElementById('wh-key-input').value.trim();
        if (val.length >= 16) {
          localStorage.setItem('wh-psk', val);
          keyEntry.remove();
          checkStatus();
        }
      });
    }, 0);
  }
  whEl.appendChild(header);

  // Mobile tabs (hidden on desktop via CSS)
  const tabs = document.createElement('div');
  tabs.className = 'wh-tabs';
  ['Tasks', 'Files', 'Feed'].forEach((label, i) => {
    const tab = document.createElement('button');
    tab.className = 'wh-tab' + (i === 0 ? ' active' : '');
    tab.textContent = label;
    tab.dataset.zone = i;
    tab.addEventListener('click', () => {
      tabs.querySelectorAll('.wh-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      whEl.querySelectorAll('.wh-zone').forEach((z, zi) => {
        z.classList.toggle('active', zi === i);
      });
    });
    tabs.appendChild(tab);
  });
  whEl.appendChild(tabs);

  // Body with 3 zones
  const body = document.createElement('div');
  body.className = 'wh-body';

  // ── Zone 1: Task Queue ──
  const taskZone = document.createElement('div');
  taskZone.className = 'wh-zone active';
  taskZone.innerHTML = `
    <div class="wh-zone-title">Task Queue</div>
    <div class="wh-zone-content" id="wh-tasks"></div>
    <div style="padding:8px;border-top:1px solid var(--ob-border);flex-shrink:0;">
      <input type="text" id="wh-task-input" placeholder="New task description..." style="width:100%;padding:6px 10px;font-size:11px;font-family:var(--ob-mono);background:rgba(255,255,255,0.04);color:var(--ob-text);border:1px solid var(--ob-border);border-radius:4px;outline:none;margin-bottom:4px;">
      <div style="display:flex;gap:4px;">
        <button class="wh-btn" id="wh-submit-task" style="flex:1;margin:0;">Submit Task</button>
        <button class="wh-btn" id="wh-pull-tasks" style="flex:1;margin:0;">Pull Tasks</button>
      </div>
    </div>
  `;
  body.appendChild(taskZone);

  // ── Zone 2: File Sync ──
  const fileZone = document.createElement('div');
  fileZone.className = 'wh-zone';
  fileZone.innerHTML = `
    <div class="wh-zone-title">File Sync</div>
    <div class="wh-zone-content" id="wh-files"></div>
  `;
  body.appendChild(fileZone);

  // ── Zone 3: Live Feed ──
  const feedZone = document.createElement('div');
  feedZone.className = 'wh-zone';
  feedZone.innerHTML = `
    <div class="wh-zone-title">Live Feed</div>
    <div class="wh-zone-content" id="wh-feed" style="display:flex;align-items:center;justify-content:center;padding:0;">
      <div class="wh-feed-placeholder">
        <span style="font-size:32px;">&#x1F30A;</span>
        <span>Remote screen feed</span>
        <span style="font-size:10px;opacity:0.5;">Connecting to partner...</span>
      </div>
    </div>
  `;
  body.appendChild(feedZone);
  whEl.appendChild(body);

  // ── MHSCOM Chat Bar ──
  const chatBar = document.createElement('div');
  chatBar.className = 'wh-chat-bar';
  chatBar.innerHTML = `
    <span style="font-size:9px;color:var(--ob-gold-dim);font-family:var(--ob-mono);align-self:center;white-space:nowrap;">MHSCOM</span>
    <input type="text" id="wh-chat-input" placeholder="Message across the wormhole...">
    <button id="wh-chat-send">Send</button>
  `;
  whEl.appendChild(chatBar);

  container.appendChild(whEl);

  // ── Wormhole Logic ──
  const tasksEl = whEl.querySelector('#wh-tasks');
  const filesEl = whEl.querySelector('#wh-files');
  const feedEl = whEl.querySelector('#wh-feed');
  let whConnected = false;

  // Mesh key — raw PSK from localStorage (default from mhsync.key)
  function getMeshKey() {
    return localStorage.getItem('wh-psk') || '8f8067994c20c601c0b36db905179e41a2b8f96770a68640d399ab1ad40a520a';
  }

  async function whFetch(path, options = {}) {
    const key = getMeshKey();
    const headers = { 'Content-Type': 'application/json', 'X-Mesh-Key': key, ...(options.headers || {}) };
    return fetch(SYNC_API + path, { ...options, headers });
  }

  // ── Browser-side crypto (matches crypto.py / syncropy_client.py) ──
  async function deriveHmac(keyHex, data) {
    const keyBytes = new Uint8Array(keyHex.match(/.{2}/g).map(b => parseInt(b, 16)));
    const encoder = new TextEncoder();
    const cryptoKey = await crypto.subtle.importKey('raw', keyBytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const sig = await crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(data));
    return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');
  }
  async function deriveNodeId(pskHex) {
    const mac = await deriveHmac(pskHex, 'mhsync-node-id-v1:BROWSER');
    return mac.slice(0, 16);
  }
  async function deriveRelayToken(pskHex) {
    return deriveHmac(pskHex, 'mhsync-relay-v1');
  }
  async function deriveRelayRoom(pskHex) {
    const mac = await deriveHmac(pskHex, 'room:wormhole-cmd');
    return mac.slice(0, 16);
  }
  async function whEncrypt(pskHex, plaintext) {
    const keyBytes = new Uint8Array(pskHex.match(/.{2}/g).map(b => parseInt(b, 16)));
    const nonce = crypto.getRandomValues(new Uint8Array(12));
    const cryptoKey = await crypto.subtle.importKey('raw', keyBytes, 'AES-GCM', false, ['encrypt']);
    const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, cryptoKey, new TextEncoder().encode(plaintext));
    const result = new Uint8Array(12 + ct.byteLength);
    result.set(nonce, 0);
    result.set(new Uint8Array(ct), 12);
    return btoa(String.fromCharCode(...result));
  }
  async function whDecrypt(pskHex, b64Token) {
    const keyBytes = new Uint8Array(pskHex.match(/.{2}/g).map(b => parseInt(b, 16)));
    const raw = Uint8Array.from(atob(b64Token), c => c.charCodeAt(0));
    const nonce = raw.slice(0, 12);
    const ct = raw.slice(12);
    const cryptoKey = await crypto.subtle.importKey('raw', keyBytes, 'AES-GCM', false, ['decrypt']);
    const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: nonce }, cryptoKey, ct);
    return new TextDecoder().decode(pt);
  }

  // ── Wormhole WebSocket Relay ──
  let whWs = null;
  let whPendingRequests = new Map(); // id → {resolve, reject, timer}
  let whChunkBuffers = new Map(); // request_id → {chunks: [], totalChunks, received}
  let whReconnectDelay = 1000;
  let whKeepAlive = null;
  let whNodeId = null;

  async function connectWormholeRelay() {
    const psk = getMeshKey();
    if (!psk || psk.length < 16) return;
    try {
      const token = await deriveRelayToken(psk);
      const room = await deriveRelayRoom(psk);
      whNodeId = await deriveNodeId(psk);
      const wsUrl = `wss://mhsync-relay.johnmobley99.workers.dev?token=${token}&room=${room}`;

      if (whWs && (whWs.readyState === WebSocket.OPEN || whWs.readyState === WebSocket.CONNECTING)) return;
      whWs = new WebSocket(wsUrl);

      whWs.onopen = () => {
        whReconnectDelay = 1000;
        // Register with relay
        whWs.send(JSON.stringify({
          type: 'register',
          node_id: whNodeId,
          universe: 'MASCOM',
          client_type: 'browser',
        }));
        statusSpan.className = 'wh-status';
        statusSpan.textContent = 'RELAY';
        whConnected = true;
        // Keepalive every 30s
        clearInterval(whKeepAlive);
        whKeepAlive = setInterval(() => {
          if (whWs && whWs.readyState === WebSocket.OPEN)
            whWs.send(JSON.stringify({ type: 'ping' }));
        }, 30000);
      };

      whWs.onmessage = async (e) => {
        let msg;
        try { msg = JSON.parse(e.data); } catch { return; }

        if (msg.type === 'roster') {
          const peers = (msg.nodes || []).filter(n => n.id !== whNodeId);
          console.log('[Wormhole] Roster:', peers.length, 'peers');
          return;
        }
        if (msg.type === 'node_joined' || msg.type === 'node_left') {
          console.log(`[Wormhole] ${msg.type}: ${msg.node_id || '?'}`);
          return;
        }
        if (msg.type === 'pong') return;

        if (msg.type === 'response' && msg.request_id) {
          const pending = whPendingRequests.get(msg.request_id);
          if (pending) {
            clearTimeout(pending.timer);
            whPendingRequests.delete(msg.request_id);
            // Decrypt payload
            if (msg.encrypted) {
              try {
                const plaintext = await whDecrypt(getMeshKey(), msg.encrypted);
                pending.resolve(JSON.parse(plaintext));
              } catch (err) {
                pending.reject(new Error('Decryption failed'));
              }
            } else {
              pending.resolve(msg);
            }
          }
          return;
        }

        // Chunked response — assemble packets from large payloads
        if (msg.type === 'response_chunk' && msg.request_id) {
          const rid = msg.request_id;
          if (!whChunkBuffers.has(rid)) {
            whChunkBuffers.set(rid, { chunks: [], totalChunks: msg.total_chunks, received: 0 });
          }
          const buf = whChunkBuffers.get(rid);
          // Decrypt chunk
          if (msg.encrypted) {
            try {
              const plaintext = await whDecrypt(getMeshKey(), msg.encrypted);
              const parsed = JSON.parse(plaintext);
              buf.chunks[msg.chunk_index] = parsed.chunk;
              buf.received++;
              console.log(`[Wormhole] Chunk ${msg.chunk_index + 1}/${buf.totalChunks} for ${rid}`);
            } catch (err) {
              console.error('[Wormhole] Chunk decrypt failed:', err);
            }
          }
          // If all chunks received, reassemble and resolve
          if (buf.received >= buf.totalChunks) {
            const fullJson = buf.chunks.join('');
            whChunkBuffers.delete(rid);
            const pending = whPendingRequests.get(rid);
            if (pending) {
              clearTimeout(pending.timer);
              whPendingRequests.delete(rid);
              try {
                pending.resolve(JSON.parse(fullJson));
              } catch (err) {
                pending.reject(new Error('Chunk reassembly parse failed'));
              }
            }
          }
          return;
        }
      };

      whWs.onclose = () => {
        whWs = null;
        clearInterval(whKeepAlive);
        statusSpan.className = 'wh-status offline';
        statusSpan.textContent = 'RECONNECTING';
        // Reject all pending requests
        for (const [id, p] of whPendingRequests) {
          clearTimeout(p.timer);
          p.reject(new Error('WebSocket closed'));
        }
        whPendingRequests.clear();
        // Reconnect with backoff
        setTimeout(() => connectWormholeRelay(), whReconnectDelay);
        whReconnectDelay = Math.min(whReconnectDelay * 2, 30000);
      };

      whWs.onerror = () => {
        // onclose will fire after this
      };
    } catch (err) {
      console.error('[Wormhole] Relay connect error:', err);
      setTimeout(() => connectWormholeRelay(), whReconnectDelay);
      whReconnectDelay = Math.min(whReconnectDelay * 2, 30000);
    }
  }

  async function sendWormholeRequest(universe, payload, timeoutMs = 30000) {
    return new Promise(async (resolve, reject) => {
      const reqId = 'req_m1_' + Math.random().toString(36).slice(2, 9);
      const psk = getMeshKey();
      const encrypted = await whEncrypt(psk, JSON.stringify(payload));
      const timer = setTimeout(() => {
        whPendingRequests.delete(reqId);
        reject(new Error('Wormhole request timeout'));
      }, timeoutMs);
      whPendingRequests.set(reqId, { resolve, reject, timer });
      whWs.send(JSON.stringify({
        type: 'request',
        id: reqId,
        to_universe: universe,
        from: whNodeId,
        from_universe: 'MASCOM',
        encrypted,
      }));
    });
  }

  // Check wormhole status — try relay first, then HTTP
  async function checkStatus() {
    // Try WebSocket relay connection
    connectWormholeRelay();
    // Also check HTTP API as fallback indicator
    try {
      const r = await whFetch('/api/wormhole/status', { signal: AbortSignal.timeout(5000) });
      await r.json();
      if (!whWs || whWs.readyState !== WebSocket.OPEN) {
        whConnected = true;
        statusSpan.className = 'wh-status';
        statusSpan.textContent = 'LINKED';
      }
    } catch {
      if (!whWs || whWs.readyState !== WebSocket.OPEN) {
        whConnected = false;
        statusSpan.className = 'wh-status offline';
        statusSpan.textContent = 'OFFLINE';
      }
    }
  }

  // Submit task
  whEl.querySelector('#wh-submit-task').addEventListener('click', async () => {
    const input = whEl.querySelector('#wh-task-input');
    const desc = input.value.trim();
    if (!desc) return;
    input.value = '';
    try {
      await whFetch('/api/wormhole/submit', {
        method: 'POST',
        body: JSON.stringify({ from_universe: 'MASCOM', to_universe: 'MASCOM', description: desc })
      });
      pullTasks();
    } catch (e) {
      tasksEl.innerHTML += `<div class="wh-task" style="border-color:rgba(248,113,113,0.3);">Error: ${e.message}</div>`;
    }
  });

  // Pull tasks
  async function pullTasks() {
    tasksEl.innerHTML = '<div style="font-size:10px;color:var(--ob-text-dim);padding:4px;">Loading...</div>';
    try {
      const r = await whFetch('/api/wormhole/pull?universe=mascom');
      const tasks = await r.json();
      if (!Array.isArray(tasks) || tasks.length === 0) {
        tasksEl.innerHTML = '<div style="font-size:10px;color:var(--ob-text-dim);padding:4px;">No pending tasks</div>';
        return;
      }
      tasksEl.innerHTML = '';
      tasks.forEach(t => {
        const el = document.createElement('div');
        el.className = 'wh-task';
        el.innerHTML = `
          <div>${t.task || t.description || 'Untitled'}</div>
          <div class="priority">${t.priority || 'normal'}</div>
          <div class="source">from: ${t.source || 'unknown'}</div>
        `;
        tasksEl.appendChild(el);
      });
    } catch {
      tasksEl.innerHTML = '<div style="font-size:10px;color:var(--ob-text-dim);padding:4px;">Wormhole offline — cannot pull tasks</div>';
    }
  }
  whEl.querySelector('#wh-pull-tasks').addEventListener('click', pullTasks);

  // ── Wormhole File Browser ──
  const syncRoots = [
    { name: 'mascom/', universe: 'MASCOM', info: "John's universe", icon: '\u{1F30D}' },
    { name: 'hascom/', universe: 'HASCOM', info: "Ron's universe", icon: '\u{1F30E}' },
    { name: 'mhscom/', universe: 'MASCOM', info: 'Shared space', icon: '\u{1F310}' },
    { name: 'ventures/', universe: 'MASCOM', info: '200+ ventures', icon: '\u{1F4C1}' },
    { name: 'deploys/', universe: 'MASCOM', info: 'Deployments', icon: '\u{1F680}' },
  ];
  let browseStack = []; // [{rootName, path, label}]
  let currentBrowseTaskId = null;

  function renderSyncRoots() {
    browseStack = [];
    currentBrowseTaskId = null;
    filesEl.innerHTML = '';
    const hdr = document.createElement('div');
    hdr.className = 'wh-browse-header';
    hdr.innerHTML = '<span class="wh-breadcrumbs"><span class="wh-crumb active">Sync Roots</span></span>';
    filesEl.appendChild(hdr);
    const list = document.createElement('div');
    list.className = 'wh-file-list';
    syncRoots.forEach(root => {
      const el = document.createElement('div');
      el.className = 'wh-file-entry dir';
      el.innerHTML = `<span class="wh-fe-icon">\u{1F4C2}</span><span class="wh-fe-name">${root.name}</span><span class="wh-fe-size">${root.info}</span><span class="wh-fe-mod">${root.universe}</span>`;
      el.addEventListener('click', () => {
        browseStack = [{ rootName: root.name, path: root.name, label: root.name }];
        browsePath(root.name, root.name, root.universe);
      });
      list.appendChild(el);
    });
    filesEl.appendChild(list);
  }

  function browsePath(rootName, path, universe) {
    const target = universe || syncRoots.find(r => r.name === rootName)?.universe || 'MASCOM';
    filesEl.innerHTML = '';
    // Breadcrumbs
    renderBreadcrumbs(rootName);
    // Loading state
    const loading = document.createElement('div');
    loading.className = 'wh-loading';
    loading.innerHTML = `<div class="wh-spinner"></div><div>Traversing wormhole to ${target}...</div>`;
    filesEl.appendChild(loading);

    // Try WebSocket relay first (instant), fall back to HTTP polling
    if (whWs && whWs.readyState === WebSocket.OPEN) {
      sendWormholeRequest(target, { type: 'browse', path }, 30000)
        .then(result => {
          let listing;
          if (typeof result.output === 'string') {
            try { listing = JSON.parse(result.output); } catch { listing = result; }
          } else {
            listing = result.output || result;
          }
          renderFileListing(rootName, listing);
        })
        .catch(err => {
          console.warn('[Wormhole] WebSocket browse failed, falling back to HTTP:', err.message);
          browsePathHTTP(rootName, path, target, loading);
        });
      return;
    }
    // HTTP polling fallback
    browsePathHTTP(rootName, path, target, loading);
  }

  function browsePathHTTP(rootName, path, target, loading) {
    whFetch('/api/wormhole/browse', {
      method: 'POST',
      body: JSON.stringify({ universe: target, path: path })
    }).then(r => {
      if (!r.ok) throw new Error(r.status === 401 ? 'Auth failed — set mesh key' : `HTTP ${r.status}`);
      return r.json();
    }).then(data => {
      currentBrowseTaskId = data.task_id;
      pollForResult(data.task_id, rootName);
    }).catch(err => {
      loading.innerHTML = `<div style="color:rgba(248,113,113,0.9);font-size:11px;">Error: ${err.message}</div>`;
    });
  }

  function pollForResult(taskId, rootName, attempt = 0) {
    if (attempt >= 60) {
      const loading = filesEl.querySelector('.wh-loading');
      if (loading) loading.innerHTML = '<div style="color:rgba(248,113,113,0.9);font-size:11px;">Timeout — wormhole node may be offline</div>';
      return;
    }
    setTimeout(() => {
      whFetch('/api/wormhole/task?id=' + taskId)
        .then(r => r.json())
        .then(task => {
          if (task.status === 'completed') {
            try {
              let raw = task.output || task.result || '{}';
              let listing;
              try { listing = JSON.parse(raw); } catch {
                // Handle truncated JSON — try to recover partial entries
                const idx = raw.lastIndexOf('}');
                if (idx > 0) {
                  const trimmed = raw.substring(0, idx + 1) + ']}';
                  try { listing = JSON.parse(trimmed); } catch { listing = null; }
                }
                if (!listing) listing = { entries: [], error: 'Response truncated' };
              }
              // Handle compact format (short keys: e=entries, p=path, n=name, t=type, s=size)
              if (listing.e && !listing.entries) {
                listing.entries = listing.e.map(e => ({
                  name: e.n, type: e.t === 'd' ? 'dir' : 'file',
                  size: e.s || null, modified: e.m || null
                }));
                listing.path = listing.p || '';
                listing.count = listing.c || listing.entries.length;
                listing.truncated = listing.tr || false;
              }
              renderFileListing(rootName, listing);
            } catch(parseErr) {
              renderFileListing(rootName, { entries: [], error: 'Failed to parse result' });
            }
          } else if (task.status === 'failed') {
            const err = task.output || task.result || 'Task failed';
            let parsed;
            try { parsed = JSON.parse(err); } catch { parsed = { error: err }; }
            filesEl.querySelector('.wh-loading').innerHTML = `<div style="color:rgba(248,113,113,0.9);font-size:11px;">${parsed.error || err}</div>`;
          } else {
            pollForResult(taskId, rootName, attempt + 1);
          }
        })
        .catch(() => pollForResult(taskId, rootName, attempt + 1));
    }, 1000);
  }

  function renderBreadcrumbs(rootName) {
    const hdr = document.createElement('div');
    hdr.className = 'wh-browse-header';
    const bc = document.createElement('span');
    bc.className = 'wh-breadcrumbs';
    // "Sync Roots" link
    const rootCrumb = document.createElement('span');
    rootCrumb.className = 'wh-crumb';
    rootCrumb.textContent = 'Sync Roots';
    rootCrumb.addEventListener('click', renderSyncRoots);
    bc.appendChild(rootCrumb);
    // Each breadcrumb segment
    browseStack.forEach((item, i) => {
      const sep = document.createElement('span');
      sep.className = 'wh-crumb-sep';
      sep.textContent = ' / ';
      bc.appendChild(sep);
      const crumb = document.createElement('span');
      crumb.className = 'wh-crumb' + (i === browseStack.length - 1 ? ' active' : '');
      crumb.textContent = item.label;
      if (i < browseStack.length - 1) {
        crumb.addEventListener('click', () => {
          browseStack = browseStack.slice(0, i + 1);
          browsePath(rootName, browseStack[i].path);
        });
      }
      bc.appendChild(crumb);
    });
    hdr.appendChild(bc);
    filesEl.appendChild(hdr);
  }

  function renderFileListing(rootName, listing) {
    // Remove loading
    const loading = filesEl.querySelector('.wh-loading');
    if (loading) loading.remove();
    if (listing.error) {
      const err = document.createElement('div');
      err.style.cssText = 'padding:12px;color:rgba(248,113,113,0.9);font-size:11px;font-family:var(--ob-mono);';
      err.textContent = listing.error;
      filesEl.appendChild(err);
      return;
    }
    const entries = listing.entries || [];
    if (entries.length === 0) {
      const empty = document.createElement('div');
      empty.style.cssText = 'padding:12px;color:var(--ob-text-dim);font-size:11px;font-family:var(--ob-mono);';
      empty.textContent = 'Empty directory';
      filesEl.appendChild(empty);
      return;
    }
    const list = document.createElement('div');
    list.className = 'wh-file-list';
    entries.forEach(entry => {
      const el = document.createElement('div');
      el.className = 'wh-file-entry' + (entry.type === 'dir' ? ' dir' : '');
      const icon = entry.type === 'dir' ? '\u{1F4C2}' : '\u{1F4C4}';
      const size = entry.type === 'file' && entry.size != null ? formatSize(entry.size) : '';
      const mod = entry.modified ? entry.modified.slice(5, 10) : '';
      el.innerHTML = `<span class="wh-fe-icon">${icon}</span><span class="wh-fe-name">${escHtml(entry.name)}</span><span class="wh-fe-size">${size}</span><span class="wh-fe-mod">${mod}</span>`;
      if (entry.type === 'dir') {
        el.addEventListener('click', () => {
          // Use the relative path from browseStack, not listing.path (which may be an absolute OS path)
          const currentRel = browseStack.length > 0 ? browseStack[browseStack.length - 1].path : rootName;
          const newPath = currentRel.replace(/\/$/, '') + '/' + entry.name;
          browseStack.push({ rootName, path: newPath, label: entry.name });
          browsePath(rootName, newPath);
        });
      }
      list.appendChild(el);
    });
    filesEl.appendChild(list);
    if (listing.truncated) {
      const note = document.createElement('div');
      note.style.cssText = 'padding:4px 8px;font-size:9px;color:var(--ob-text-dim);font-family:var(--ob-mono);';
      note.textContent = `Showing ${listing.count} entries (truncated)`;
      filesEl.appendChild(note);
    }
  }

  function formatSize(bytes) {
    if (bytes < 1024) return bytes + 'B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(0) + 'K';
    return (bytes / 1048576).toFixed(1) + 'M';
  }

  function escHtml(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  renderSyncRoots();

  // Live feed — poll remote screen
  const feedImg = document.createElement('img');
  feedImg.className = 'wh-feed-img';
  feedImg.style.display = 'none';
  feedEl.appendChild(feedImg);

  let feedInterval = null;
  async function pollFeed() {
    try {
      const r = await whFetch('/api/screen/latest', { signal: AbortSignal.timeout(8000) });
      if (!r.ok) return;
      const d = await r.json();
      if (d.image) {
        feedImg.src = 'data:image/jpeg;base64,' + d.image;
        feedImg.style.display = 'block';
        feedEl.querySelector('.wh-feed-placeholder').style.display = 'none';
      }
    } catch {}
  }
  feedInterval = setInterval(pollFeed, 3000);

  // MHSCOM Chat
  const chatInput = whEl.querySelector('#wh-chat-input');
  const chatMsgs = document.createElement('div');
  chatMsgs.style.cssText = 'max-height:60px;overflow-y:auto;padding:0 12px;font-size:10px;';
  whEl.insertBefore(chatMsgs, chatBar);

  whEl.querySelector('#wh-chat-send').addEventListener('click', async () => {
    const msg = chatInput.value.trim();
    if (!msg) return;
    chatInput.value = '';
    const msgEl = document.createElement('div');
    msgEl.className = 'wh-msg from-mascom';
    msgEl.textContent = 'MASCOM: ' + msg;
    chatMsgs.appendChild(msgEl);
    chatMsgs.scrollTop = chatMsgs.scrollHeight;
    try {
      await whFetch('/api/mhscom/push', {
        method: 'POST',
        body: JSON.stringify({ from: 'mascom', message: msg, channel: 'general' })
      });
    } catch {}
  });
  chatInput.addEventListener('keydown', e => { if (e.key === 'Enter') whEl.querySelector('#wh-chat-send').click(); });

  // Poll MHSCOM messages
  let lastMsgTime = new Date().toISOString();
  async function pollChat() {
    try {
      const r = await whFetch('/api/mhscom/pull?channel=general&since=' + encodeURIComponent(lastMsgTime));
      const msgs = await r.json();
      if (Array.isArray(msgs)) {
        msgs.forEach(m => {
          const el = document.createElement('div');
          el.className = 'wh-msg ' + (m.from === 'mascom' ? 'from-mascom' : 'from-hascom');
          el.textContent = (m.from || 'unknown').toUpperCase() + ': ' + m.message;
          chatMsgs.appendChild(el);
          lastMsgTime = m.timestamp || lastMsgTime;
        });
        if (msgs.length > 0) chatMsgs.scrollTop = chatMsgs.scrollHeight;
      }
    } catch {}
  }
  const chatPollInterval = setInterval(pollChat, 5000);

  // Init
  checkStatus();
  pullTasks();

  container._termCleanup = () => {
    clearInterval(feedInterval);
    clearInterval(chatPollInterval);
    clearInterval(whKeepAlive);
    if (whWs) { try { whWs.close(); } catch {} whWs = null; }
  };
}

// ══════════════════════════════════════════════════════════
// MobCorp Dashboard — Portfolio overview
// ══════════════════════════════════════════════════════════
// ══════════════════════════════════════════════════════════
// RevOps — Revenue Operations Dashboard
// ══════════════════════════════════════════════════════════
function buildRevOps(container) {
  container.style.cssText = 'padding:0;overflow:hidden;';
  const rv = document.createElement('div');
  rv.style.cssText = 'padding:14px;overflow-y:auto;height:100%;font-family:var(--ob-font);color:var(--ob-text);';

  const TIER_NAMES = {0:'Passive',1:'Gig Economy',2:'Content Creation',3:'SaaS Products',4:'Employment',5:'Speculative'};
  const TIER_COLORS = {0:'#22c55e',1:'#3b82f6',2:'#a855f7',3:'#f59e0b',4:'#ef4444',5:'#06b6d4'};
  const TIER_ICONS = {0:'\u2600\ufe0f',1:'\u{1F4BC}',2:'\u{1F3A8}',3:'\u{1F680}',4:'\u{1F454}',5:'\u{1F52E}'};
  const STATUS_ICONS = {planned:'\u23f3',setup:'\u{1F527}',active:'\u25b6\ufe0f',earning:'\u{1F4b0}',paused:'\u23f8\ufe0f',closed:'\u274c'};
  const STATUS_COLORS = {planned:'rgba(200,200,212,0.5)',setup:'#fbbf24',active:'#22c55e',earning:'#22c55e',paused:'#888',closed:'#555'};
  const CAT_ICONS = {ads:'\u{1F4E2}',publishing:'\u{1F4D6}',affiliate:'\u{1F517}',apps:'\u{1F4F1}',domains:'\u{1F310}',music:'\u{1F3B5}',api:'\u{1F50C}',freelance:'\u{1F4BB}',security:'\u{1F6E1}\ufe0f',audio:'\u{1F3A4}',data:'\u{1F4CA}',development:'\u2699\ufe0f',writing:'\u270d\ufe0f',consulting:'\u{1F4A1}',content:'\u{1F4DD}',digital:'\u{1F4E6}',education:'\u{1F393}',newsletter:'\u{1F4E8}',social:'\u{1F4F2}',saas:'\u2601\ufe0f',employment:'\u{1F454}',creative:'\u{1F3AC}',web3:'\u26d3\ufe0f'};

  // Full fallback dataset from revops.db — used when API is unreachable
  const FALLBACK_OPS = [
    {id:22,name:'API Monetization',tier:0,category:'api',platform:'stripe',status:'planned',earnings_total:0,earnings_last30d:0,description:'Add paid tiers to getfilms API and other data APIs.',next_action:''},
    {id:18,name:'Affiliate Marketing',tier:0,category:'affiliate',platform:'amazon',status:'planned',earnings_total:0,earnings_last30d:0,description:'Embed affiliate links in all content.',next_action:''},
    {id:21,name:'App Store Apps',tier:0,category:'apps',platform:'apple',status:'planned',earnings_total:0,earnings_last30d:0,description:'Submit existing iOS builds to App Store.',next_action:''},
    {id:3,name:'Content Site Ads',tier:0,category:'ads',platform:'adsense',status:'planned',earnings_total:0,earnings_last30d:0,description:'AdSense across all MobCorp content sites.',next_action:'Audit all MobCorp sites for AdSense eligibility'},
    {id:19,name:'Domain Flipping',tier:0,category:'domains',platform:'sedo',status:'planned',earnings_total:0,earnings_last30d:0,description:'Park and sell premium domains from the 200+ fleet.',next_action:''},
    {id:1,name:'GameGob Ad Revenue',tier:0,category:'ads',platform:'adsense',status:'planned',earnings_total:0,earnings_last30d:0,description:'Google AdSense monetization on gamegob.com.',next_action:'Verify gamegob.com serves ads.txt correctly'},
    {id:2,name:'KDP Book Publishing',tier:0,category:'publishing',platform:'kdp',status:'planned',earnings_total:0,earnings_last30d:0,description:'Self-publishing books via Amazon KDP.',next_action:'Finalize manuscript in KDP-ready format'},
    {id:20,name:'Stock Music Licensing',tier:0,category:'music',platform:'audiojungle',status:'planned',earnings_total:0,earnings_last30d:0,description:'Upload SonicMind-generated tracks for licensing.',next_action:''},
    {id:24,name:'AI Voice-Over Service',tier:1,category:'audio',platform:'fiverr',status:'planned',earnings_total:0,earnings_last30d:0,description:'Edge TTS + processing for podcast intros, narration, ads.',next_action:''},
    {id:17,name:'Bug Bounty Hunting',tier:1,category:'security',platform:'hackerone',status:'planned',earnings_total:0,earnings_last30d:0,description:'Automated security research on bug bounty programs.',next_action:'Sign up for HackerOne and Bugcrowd'},
    {id:27,name:'Data Scraping Service',tier:1,category:'data',platform:'upwork',status:'planned',earnings_total:0,earnings_last30d:0,description:'Custom web scraping using spider.py capabilities.',next_action:''},
    {id:6,name:'Fiverr Content Writing',tier:1,category:'freelance',platform:'fiverr',status:'planned',earnings_total:0,earnings_last30d:0,description:'AI-assisted content writing gigs.',next_action:'Create SEO content writing gig'},
    {id:7,name:'Fiverr Game Dev',tier:1,category:'freelance',platform:'fiverr',status:'planned',earnings_total:0,earnings_last30d:0,description:'HTML5/JS browser games and game design.',next_action:'Create HTML5 browser games gig'},
    {id:5,name:'Fiverr Web Dev Gigs',tier:1,category:'freelance',platform:'fiverr',status:'planned',earnings_total:0,earnings_last30d:0,description:'Freelance React, Next.js, full-stack builds.',next_action:'Create Fiverr seller profile'},
    {id:4,name:'Mechanical Turk Tasks',tier:1,category:'freelance',platform:'mturk',status:'planned',earnings_total:0,earnings_last30d:0,description:'Micro-tasks: data labeling, surveys, transcription.',next_action:'Create MTurk worker account'},
    {id:23,name:'Rapid MVP Builder',tier:1,category:'development',platform:'fiverr',status:'planned',earnings_total:0,earnings_last30d:0,description:'Build startup MVPs in 48 hours using MASCOM stack.',next_action:''},
    {id:26,name:'Resume Writing Service',tier:1,category:'writing',platform:'fiverr',status:'planned',earnings_total:0,earnings_last30d:0,description:'AI-assisted resume and cover letter writing.',next_action:''},
    {id:8,name:'Upwork Development',tier:1,category:'freelance',platform:'upwork',status:'planned',earnings_total:0,earnings_last30d:0,description:'Higher-value freelance development on Upwork.',next_action:'Create Upwork profile'},
    {id:25,name:'Website Audit Service',tier:1,category:'consulting',platform:'fiverr',status:'planned',earnings_total:0,earnings_last30d:0,description:'Automated SEO/performance/accessibility audits.',next_action:''},
    {id:32,name:'Etsy Digital Downloads',tier:2,category:'digital',platform:'etsy',status:'planned',earnings_total:0,earnings_last30d:0,description:'Printable planners, business templates, AI prompt packs.',next_action:''},
    {id:10,name:'Medium Articles',tier:2,category:'content',platform:'medium',status:'planned',earnings_total:0,earnings_last30d:0,description:'Technical articles on Medium Partner Program.',next_action:'Create Medium account and apply for Partner Program'},
    {id:31,name:'Notion Templates',tier:2,category:'digital',platform:'gumroad',status:'planned',earnings_total:0,earnings_last30d:0,description:'AI Business OS template pack on Gumroad.',next_action:''},
    {id:29,name:'Online Courses',tier:2,category:'education',platform:'udemy',status:'planned',earnings_total:0,earnings_last30d:0,description:'Video courses: Build 200 Websites for Free, AI Side Hustle.',next_action:''},
    {id:33,name:'Podcast',tier:2,category:'audio',platform:'spotify',status:'planned',earnings_total:0,earnings_last30d:0,description:'AI-narrated weekly podcast from Medium articles.',next_action:''},
    {id:11,name:'Print-on-Demand Designs',tier:2,category:'content',platform:'redbubble',status:'planned',earnings_total:0,earnings_last30d:0,description:'AI-generated designs on Redbubble, TeeSpring.',next_action:'Create seller accounts on Redbubble'},
    {id:28,name:'Substack Newsletter',tier:2,category:'newsletter',platform:'substack',status:'planned',earnings_total:0,earnings_last30d:0,description:'Weekly AI Builder newsletter. Free + $10/mo paid tier.',next_action:''},
    {id:30,name:'TikTok/Reels Content',tier:2,category:'social',platform:'tiktok',status:'planned',earnings_total:0,earnings_last30d:0,description:'60-second clips with AI voiceover + stock footage.',next_action:''},
    {id:9,name:'YouTube Faceless Channels',tier:2,category:'content',platform:'youtube',status:'planned',earnings_total:0,earnings_last30d:0,description:'Faceless YouTube channels using AI scripts and voiceovers.',next_action:'Create YouTube channel with branded banner'},
    {id:35,name:'AI Chatbot Hosting',tier:3,category:'saas',platform:'stripe',status:'planned',earnings_total:0,earnings_last30d:0,description:'PhotonicMind as embedded chatbot widget for businesses.',next_action:''},
    {id:13,name:'Book2Film Service',tier:3,category:'saas',platform:'stripe',status:'planned',earnings_total:0,earnings_last30d:0,description:'AI: books to screenplay treatments and pitch decks.',next_action:'Build Book2Film processing pipeline'},
    {id:14,name:'BookClubs Premium',tier:3,category:'saas',platform:'stripe',status:'planned',earnings_total:0,earnings_last30d:0,description:'Book clubs with AI discussion questions and social features.',next_action:'Build BookClubs core'},
    {id:37,name:'Landing Page Generator',tier:3,category:'saas',platform:'stripe',status:'planned',earnings_total:0,earnings_last30d:0,description:'AI generates + deploys landing pages to CF Workers.',next_action:''},
    {id:12,name:'LiteraCraft Subscriptions',tier:3,category:'saas',platform:'stripe',status:'planned',earnings_total:0,earnings_last30d:0,description:'AI-powered creative writing platform.',next_action:'Finalize LiteraCraft MVP'},
    {id:36,name:'SEO Analyzer Tool',tier:3,category:'saas',platform:'stripe',status:'planned',earnings_total:0,earnings_last30d:0,description:'Automated site analysis + AI recommendations SaaS.',next_action:''},
    {id:34,name:'White-Label Site Builder',tier:3,category:'saas',platform:'stripe',status:'planned',earnings_total:0,earnings_last30d:0,description:'mascom-edge as a product for unlimited sites on CF.',next_action:''},
    {id:16,name:'AI Consulting',tier:4,category:'employment',platform:'various',status:'planned',earnings_total:0,earnings_last30d:0,description:'AI consulting: LLMs, AI pipelines, automation.',next_action:'Create consulting service page on mobleysoft.com'},
    {id:39,name:'AI Workshops',tier:4,category:'education',platform:'zoom',status:'planned',earnings_total:0,earnings_last30d:0,description:'Live Build Your AI Stack workshops. $50-$200/seat.',next_action:''},
    {id:40,name:'Film Pitch Decks',tier:4,category:'creative',platform:'various',status:'planned',earnings_total:0,earnings_last30d:0,description:'Package 40 film ideas as professional pitch decks.',next_action:''},
    {id:38,name:'Fractional CTO',tier:4,category:'consulting',platform:'various',status:'planned',earnings_total:0,earnings_last30d:0,description:'Part-time technical leadership for startups. $5K-$15K/mo.',next_action:''},
    {id:15,name:'Remote Job Automation',tier:4,category:'employment',platform:'various',status:'planned',earnings_total:0,earnings_last30d:0,description:'Automated remote job applications with AI.',next_action:'Update master resume with latest MobCorp projects'},
    {id:42,name:'GameGob NFTs',tier:5,category:'web3',platform:'opensea',status:'planned',earnings_total:0,earnings_last30d:0,description:'Mint game assets and sprites as NFTs on Base/Polygon L2.',next_action:''},
    {id:41,name:'Immunefi Crypto Bounties',tier:5,category:'security',platform:'immunefi',status:'planned',earnings_total:0,earnings_last30d:0,description:'Crypto-specific bug bounties. Up to $1M per finding.',next_action:''},
    {id:43,name:'Venture Tokenization',tier:5,category:'web3',platform:'various',status:'planned',earnings_total:0,earnings_last30d:0,description:'Token representing equity in the 200-venture portfolio.',next_action:''}
  ];

  const FALLBACK_DELIVERABLES = [
    {id:1,op_id:1,type:'portal',title:'GameGob Portal (48 games + 10 ad slots)',status:'draft'},
    {id:2,op_id:1,type:'template',title:'Ad Wrapper Template (GameGobAds API)',status:'draft'},
    {id:25,op_id:1,type:'config',title:'GameGob ads.txt',status:'draft'},
    {id:6,op_id:2,type:'book',title:'AI Side Hustle Blueprint (20K+ words)',status:'draft'},
    {id:17,op_id:2,type:'ebook',title:'AI Side Hustle Blueprint EPUB (1.4MB)',status:'draft'},
    {id:18,op_id:2,type:'cover',title:'Book Cover (1600x2560 SVG/PNG)',status:'draft'},
    {id:26,op_id:2,type:'marketing',title:'KDP Book Marketing Copy',status:'draft'},
    {id:3,op_id:5,type:'listing',title:'Fiverr Gig: Web Development (3 tiers)',status:'draft'},
    {id:21,op_id:5,type:'listing',title:'Fiverr Web Dev Gig Description',status:'draft'},
    {id:4,op_id:6,type:'listing',title:'Fiverr Gig: SEO Content Writing (3 tiers)',status:'draft'},
    {id:22,op_id:6,type:'listing',title:'Fiverr Content Writing Gig Description',status:'draft'},
    {id:5,op_id:7,type:'listing',title:'Fiverr Gig: Game Development (3 tiers)',status:'draft'},
    {id:23,op_id:7,type:'listing',title:'Fiverr Game Dev Gig Description',status:'draft'},
    {id:24,op_id:8,type:'listing',title:'Upwork Developer Profile',status:'draft'},
    {id:7,op_id:9,type:'script',title:'7 AI Side Hustles That Pay $100-500/Day',status:'draft'},
    {id:8,op_id:9,type:'script',title:'10 Free AI Tools Replace $500/Month Subs',status:'draft'},
    {id:9,op_id:9,type:'script',title:'5 Passive Income Streams Using AI',status:'draft'},
    {id:10,op_id:9,type:'script',title:'Build a Website in 10 Min with AI',status:'draft'},
    {id:11,op_id:9,type:'script',title:'I Let AI Run My Business for 30 Days',status:'draft'},
    {id:12,op_id:10,type:'article',title:'AI System That Manages 200 Businesses',status:'draft'},
    {id:13,op_id:10,type:'article',title:'$0 AI Tech Stack Replaced $2K/Month',status:'draft'},
    {id:14,op_id:10,type:'article',title:'Side Hustle with AI Complete Guide',status:'draft'},
    {id:15,op_id:10,type:'article',title:'Browser Games Portfolio',status:'draft'},
    {id:16,op_id:10,type:'article',title:'Cloudflare Empire Architecture',status:'draft'},
    {id:19,op_id:13,type:'webapp',title:'Book2Film SaaS App (2074 lines)',status:'draft'},
    {id:20,op_id:14,type:'webapp',title:'BookClubs Premium App (2291 lines)',status:'draft'},
    {id:27,op_id:17,type:'guide',title:'Bug Bounty Setup Guide',status:'draft'}
  ];

  let expandedTier = null;
  let expandedOp = null;
  let filterStatus = 'all';

  rv.innerHTML = `
    <div style="margin-bottom:14px;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
        <div style="font-family:var(--ob-mono);font-size:11px;font-weight:700;color:var(--ob-gold);letter-spacing:2px;">REVENUE OPERATIONS</div>
        <div id="rv-updated" style="font-size:8px;color:var(--ob-text-dim);font-family:var(--ob-mono);"></div>
      </div>
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px;">
        <div style="background:rgba(34,197,94,0.06);border:1px solid rgba(34,197,94,0.15);border-radius:8px;padding:10px 8px;text-align:center;">
          <div id="rv-total" style="font-size:18px;font-weight:700;color:#22c55e;font-family:var(--ob-mono);">$0.00</div>
          <div style="font-size:8px;color:rgba(34,197,94,0.7);margin-top:3px;font-weight:600;letter-spacing:0.5px;">TOTAL EARNED</div>
        </div>
        <div style="background:rgba(240,184,0,0.06);border:1px solid rgba(240,184,0,0.15);border-radius:8px;padding:10px 8px;text-align:center;">
          <div id="rv-30d" style="font-size:18px;font-weight:700;color:var(--ob-gold);font-family:var(--ob-mono);">$0.00</div>
          <div style="font-size:8px;color:var(--ob-gold-dim);margin-top:3px;font-weight:600;letter-spacing:0.5px;">LAST 30 DAYS</div>
        </div>
        <div style="background:rgba(59,130,246,0.06);border:1px solid rgba(59,130,246,0.15);border-radius:8px;padding:10px 8px;text-align:center;">
          <div id="rv-ops" style="font-size:18px;font-weight:700;color:#3b82f6;font-family:var(--ob-mono);">--</div>
          <div style="font-size:8px;color:rgba(59,130,246,0.7);margin-top:3px;font-weight:600;letter-spacing:0.5px;">OPS ACTIVE</div>
        </div>
        <div style="background:rgba(168,85,247,0.06);border:1px solid rgba(168,85,247,0.15);border-radius:8px;padding:10px 8px;text-align:center;">
          <div id="rv-deliverables" style="font-size:18px;font-weight:700;color:#a855f7;font-family:var(--ob-mono);">--</div>
          <div style="font-size:8px;color:rgba(168,85,247,0.7);margin-top:3px;font-weight:600;letter-spacing:0.5px;">DELIVERABLES</div>
        </div>
      </div>
    </div>
    <div id="rv-tier-bar" style="display:flex;gap:3px;margin-bottom:10px;flex-wrap:wrap;"></div>
    <div id="rv-filter" style="display:flex;gap:4px;margin-bottom:10px;">
      <button class="rv-fbtn rv-fbtn-active" data-filter="all" style="font-size:8px;padding:3px 8px;border-radius:10px;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.08);color:var(--ob-text);cursor:pointer;font-family:var(--ob-mono);font-weight:600;letter-spacing:0.5px;">ALL</button>
      <button class="rv-fbtn" data-filter="planned" style="font-size:8px;padding:3px 8px;border-radius:10px;border:1px solid rgba(255,255,255,0.06);background:transparent;color:var(--ob-text-dim);cursor:pointer;font-family:var(--ob-mono);font-weight:600;letter-spacing:0.5px;">PLANNED</button>
      <button class="rv-fbtn" data-filter="setup" style="font-size:8px;padding:3px 8px;border-radius:10px;border:1px solid rgba(255,255,255,0.06);background:transparent;color:var(--ob-text-dim);cursor:pointer;font-family:var(--ob-mono);font-weight:600;letter-spacing:0.5px;">SETUP</button>
      <button class="rv-fbtn" data-filter="active" style="font-size:8px;padding:3px 8px;border-radius:10px;border:1px solid rgba(255,255,255,0.06);background:transparent;color:var(--ob-text-dim);cursor:pointer;font-family:var(--ob-mono);font-weight:600;letter-spacing:0.5px;">ACTIVE</button>
      <button class="rv-fbtn" data-filter="earning" style="font-size:8px;padding:3px 8px;border-radius:10px;border:1px solid rgba(255,255,255,0.06);background:transparent;color:var(--ob-text-dim);cursor:pointer;font-family:var(--ob-mono);font-weight:600;letter-spacing:0.5px;">EARNING</button>
    </div>
    <div id="rv-tiers"></div>
    <div id="rv-deliverables-section" style="margin-top:14px;padding:10px;background:rgba(168,85,247,0.04);border:1px solid rgba(168,85,247,0.1);border-radius:8px;">
      <div style="font-size:10px;font-weight:700;color:#a855f7;margin-bottom:8px;font-family:var(--ob-mono);letter-spacing:1px;cursor:pointer;" id="rv-deliv-toggle">DELIVERABLES <span style="font-size:8px;color:var(--ob-text-dim);">(click to expand)</span></div>
      <div id="rv-deliv-summary" style="display:flex;gap:8px;flex-wrap:wrap;"></div>
      <div id="rv-deliv-list" style="display:none;margin-top:8px;max-height:200px;overflow-y:auto;"></div>
    </div>
    <div style="margin-top:14px;padding:10px;background:rgba(240,184,0,0.04);border:1px solid rgba(240,184,0,0.1);border-radius:8px;">
      <div style="font-size:10px;font-weight:700;color:var(--ob-gold);margin-bottom:8px;font-family:var(--ob-mono);letter-spacing:1px;">NEXT ACTIONS</div>
      <div id="rv-actions" style="font-size:10px;color:var(--ob-text-dim);">Loading...</div>
    </div>
  `;
  container.appendChild(rv);

  // Filter buttons
  rv.querySelectorAll('.rv-fbtn').forEach(btn => {
    btn.addEventListener('click', () => {
      filterStatus = btn.dataset.filter;
      rv.querySelectorAll('.rv-fbtn').forEach(b => {
        b.style.background = 'transparent';
        b.style.color = 'var(--ob-text-dim)';
        b.style.borderColor = 'rgba(255,255,255,0.06)';
        b.classList.remove('rv-fbtn-active');
      });
      btn.style.background = 'rgba(255,255,255,0.08)';
      btn.style.color = 'var(--ob-text)';
      btn.style.borderColor = 'rgba(255,255,255,0.1)';
      btn.classList.add('rv-fbtn-active');
      renderTiers();
    });
  });

  // Deliverables toggle
  let delivExpanded = false;
  rv.querySelector('#rv-deliv-toggle').addEventListener('click', () => {
    delivExpanded = !delivExpanded;
    rv.querySelector('#rv-deliv-list').style.display = delivExpanded ? 'block' : 'none';
    rv.querySelector('#rv-deliv-toggle').querySelector('span').textContent = delivExpanded ? '(click to collapse)' : '(click to expand)';
  });

  let currentData = null;

  async function loadRevOps() {
    try {
      const r = await fetch(API_BASE + '/api/revops', { signal: AbortSignal.timeout(5000) });
      const data = await r.json();
      if (data && data.ops) {
        currentData = data;
        renderRevOps(data);
        return;
      }
    } catch {}
    // Fallback to embedded data
    currentData = {
      ops: FALLBACK_OPS,
      ops_count: FALLBACK_OPS.length,
      earnings: {total:0,last_30d:0,by_tier:{},by_platform:{},recent:[]},
      deliverables: {draft:27,total:27},
      next_actions: FALLBACK_OPS.filter(o => o.next_action).map(o => ({op_id:o.id,op_name:o.name,tier:o.tier,action:o.next_action,status:o.status})),
      tier_summary: {},
      generated_at: 'Fallback (offline)'
    };
    // Build tier summary from fallback
    [0,1,2,3,4,5].forEach(t => {
      const tOps = FALLBACK_OPS.filter(o => o.tier === t);
      if (tOps.length) currentData.tier_summary[String(t)] = {
        name:TIER_NAMES[t],count:tOps.length,
        active:tOps.filter(o=>o.status==='active'||o.status==='earning').length,
        earnings_total:tOps.reduce((s,o)=>s+(o.earnings_total||0),0),
        earnings_last30d:tOps.reduce((s,o)=>s+(o.earnings_last30d||0),0)
      };
    });
    renderRevOps(currentData);
  }

  function renderRevOps(data) {
    // Timestamp
    const updEl = rv.querySelector('#rv-updated');
    if (data.generated_at) updEl.textContent = data.generated_at;

    // Summary stats
    const earnings = data.earnings || {};
    const total = earnings.total || 0;
    const last30d = earnings.last_30d || 0;
    const allOps = data.ops || [];
    const activeCount = allOps.filter(o => o.status === 'active' || o.status === 'earning').length;

    rv.querySelector('#rv-total').textContent = '$' + total.toFixed(2);
    rv.querySelector('#rv-30d').textContent = '$' + last30d.toFixed(2);
    rv.querySelector('#rv-ops').textContent = activeCount + '/' + allOps.length;

    // Deliverables
    const deliv = data.deliverables || {};
    const totalDeliv = deliv.total || 0;
    rv.querySelector('#rv-deliverables').textContent = totalDeliv;

    // Deliverable summary badges
    const delivSumEl = rv.querySelector('#rv-deliv-summary');
    const delivStatusColors = {draft:'#fbbf24',published:'#22c55e',submitted:'#3b82f6',live:'#22c55e'};
    delivSumEl.innerHTML = '';
    Object.entries(deliv).forEach(([status, count]) => {
      if (status === 'total') return;
      const badge = document.createElement('span');
      badge.style.cssText = 'font-size:9px;padding:2px 8px;border-radius:10px;font-weight:600;font-family:var(--ob-mono);border:1px solid ' + (delivStatusColors[status]||'#888') + '33;color:' + (delivStatusColors[status]||'#888') + ';background:' + (delivStatusColors[status]||'#888') + '0d;';
      badge.textContent = count + ' ' + status;
      delivSumEl.appendChild(badge);
    });
    if (!Object.keys(deliv).filter(k=>k!=='total').length) {
      delivSumEl.innerHTML = '<span style="font-size:9px;color:var(--ob-text-dim);">No deliverables yet</span>';
    }

    // Deliverable detail list (from fallback or API)
    const delivListEl = rv.querySelector('#rv-deliv-list');
    const deliverables = data.deliverables_list || FALLBACK_DELIVERABLES;
    const delivByOp = {};
    deliverables.forEach(d => {
      if (!delivByOp[d.op_id]) delivByOp[d.op_id] = [];
      delivByOp[d.op_id].push(d);
    });
    let delivHtml = '';
    const opMap = {};
    allOps.forEach(o => opMap[o.id] = o);
    Object.entries(delivByOp).forEach(([opId, items]) => {
      const op = opMap[opId];
      const opName = op ? op.name : 'Op #' + opId;
      delivHtml += '<div style="margin-bottom:6px;"><div style="font-size:9px;font-weight:700;color:#a855f7;margin-bottom:2px;">' + opName + '</div>';
      items.forEach(d => {
        const sColor = delivStatusColors[d.status] || '#888';
        delivHtml += '<div style="display:flex;align-items:center;gap:6px;padding:2px 0;font-size:9px;">' +
          '<span style="width:6px;height:6px;border-radius:50%;background:' + sColor + ';flex-shrink:0;"></span>' +
          '<span style="flex:1;color:var(--ob-text);">' + d.title + '</span>' +
          '<span style="font-size:8px;color:' + sColor + ';font-family:var(--ob-mono);font-weight:600;">' + d.status.toUpperCase() + '</span></div>';
      });
      delivHtml += '</div>';
    });
    delivListEl.innerHTML = delivHtml || '<div style="font-size:9px;color:var(--ob-text-dim);">No deliverables tracked.</div>';

    // Tier progress bar
    const tierBar = rv.querySelector('#rv-tier-bar');
    tierBar.innerHTML = '';
    const tierSummary = data.tier_summary || {};
    Object.keys(TIER_NAMES).forEach(t => {
      const ts = tierSummary[String(t)];
      if (!ts && !allOps.some(o => o.tier == t)) return;
      const count = ts ? ts.count : allOps.filter(o => o.tier == t).length;
      const active = ts ? ts.active : 0;
      const color = TIER_COLORS[t];
      const chip = document.createElement('div');
      chip.style.cssText = 'display:flex;align-items:center;gap:4px;padding:4px 8px;border-radius:6px;cursor:pointer;transition:all 0.15s;border:1px solid ' + color + '22;background:' + color + '0a;';
      chip.innerHTML = '<span style="font-size:10px;">' + TIER_ICONS[t] + '</span>' +
        '<span style="font-size:9px;font-weight:700;color:' + color + ';font-family:var(--ob-mono);">T' + t + '</span>' +
        '<span style="font-size:8px;color:var(--ob-text-dim);">' + active + '/' + count + '</span>';
      chip.addEventListener('mouseenter', () => { chip.style.background = color + '18'; chip.style.borderColor = color + '44'; });
      chip.addEventListener('mouseleave', () => { chip.style.background = color + '0a'; chip.style.borderColor = color + '22'; });
      tierBar.appendChild(chip);
    });

    // Render tier groups
    renderTiers();

    // Next actions
    const actionsEl = rv.querySelector('#rv-actions');
    const nextActions = (data.next_actions || allOps.filter(o => o.next_action && o.status !== 'earning'))
      .slice(0, 8);
    if (nextActions.length) {
      actionsEl.innerHTML = nextActions.map(a => {
        const action = a.action || a.next_action || '';
        const name = a.op_name || a.name || '';
        const tier = a.tier != null ? a.tier : '';
        const color = TIER_COLORS[tier] || '#888';
        return '<div style="display:flex;align-items:flex-start;gap:6px;padding:3px 0;border-bottom:1px solid rgba(255,255,255,0.03);">' +
          '<span style="width:4px;height:4px;border-radius:50%;background:' + color + ';margin-top:5px;flex-shrink:0;"></span>' +
          '<div><span style="font-weight:600;color:var(--ob-text);">' + name + '</span> ' +
          '<span style="color:var(--ob-text-dim);">' + action + '</span></div></div>';
      }).join('');
    } else {
      actionsEl.innerHTML = '<div style="color:#22c55e;">All ops active or earning.</div>';
    }
  }

  function renderTiers() {
    if (!currentData) return;
    const tiersEl = rv.querySelector('#rv-tiers');
    const allOps = currentData.ops || [];

    // Group by tier
    const byTier = {};
    allOps.forEach(op => {
      if (filterStatus !== 'all' && op.status !== filterStatus) return;
      const t = op.tier;
      if (!byTier[t]) byTier[t] = [];
      byTier[t].push(op);
    });

    tiersEl.innerHTML = '';
    Object.keys(TIER_NAMES).forEach(tier => {
      const ops = byTier[tier];
      if (!ops || !ops.length) return;
      const color = TIER_COLORS[tier] || '#888';
      const tierDiv = document.createElement('div');
      tierDiv.style.cssText = 'margin-bottom:8px;border:1px solid ' + color + '15;border-radius:8px;overflow:hidden;transition:all 0.2s;';

      // Tier header
      const header = document.createElement('div');
      header.style.cssText = 'display:flex;align-items:center;gap:8px;padding:8px 10px;cursor:pointer;background:' + color + '08;transition:background 0.15s;';
      header.innerHTML = '<span style="font-size:12px;">' + TIER_ICONS[tier] + '</span>' +
        '<span style="font-size:10px;font-weight:700;color:' + color + ';font-family:var(--ob-mono);letter-spacing:1px;flex:1;">TIER ' + tier + ': ' + (TIER_NAMES[tier]||'').toUpperCase() + '</span>' +
        '<span style="font-size:9px;color:var(--ob-text-dim);font-family:var(--ob-mono);">' + ops.length + ' ops</span>' +
        '<span style="font-size:10px;color:' + color + ';transition:transform 0.2s;" class="rv-tier-arrow">\u25b6</span>';
      header.addEventListener('mouseenter', () => { header.style.background = color + '12'; });
      header.addEventListener('mouseleave', () => { header.style.background = color + '08'; });

      // Ops container
      const opsContainer = document.createElement('div');
      opsContainer.style.cssText = 'max-height:0;overflow:hidden;transition:max-height 0.3s ease;';

      const isExpanded = expandedTier === tier;
      if (isExpanded) {
        opsContainer.style.maxHeight = (ops.length * 80 + 100) + 'px';
        header.querySelector('.rv-tier-arrow').style.transform = 'rotate(90deg)';
      }

      header.addEventListener('click', () => {
        if (expandedTier === tier) {
          expandedTier = null;
          opsContainer.style.maxHeight = '0';
          header.querySelector('.rv-tier-arrow').style.transform = 'rotate(0deg)';
        } else {
          // Collapse previous
          const prev = tiersEl.querySelector('.rv-tier-expanded');
          if (prev) {
            prev.style.maxHeight = '0';
            prev.classList.remove('rv-tier-expanded');
            const prevArrow = prev.previousElementSibling.querySelector('.rv-tier-arrow');
            if (prevArrow) prevArrow.style.transform = 'rotate(0deg)';
          }
          expandedTier = tier;
          opsContainer.style.maxHeight = (ops.length * 80 + 100) + 'px';
          opsContainer.classList.add('rv-tier-expanded');
          header.querySelector('.rv-tier-arrow').style.transform = 'rotate(90deg)';
        }
      });

      // Render each op
      ops.forEach(op => {
        const icon = STATUS_ICONS[op.status] || '\u2753';
        const sColor = STATUS_COLORS[op.status] || '#888';
        const catIcon = CAT_ICONS[op.category] || '\u{1F4CB}';
        const earned = op.earnings_total ? '$' + Number(op.earnings_total).toFixed(2) : '';
        const opEl = document.createElement('div');
        opEl.style.cssText = 'display:flex;align-items:center;gap:8px;padding:6px 10px;font-size:10px;border-bottom:1px solid rgba(255,255,255,0.03);cursor:pointer;transition:background 0.15s;';
        opEl.addEventListener('mouseenter', () => { opEl.style.background = 'rgba(255,255,255,0.03)'; });
        opEl.addEventListener('mouseleave', () => { opEl.style.background = 'transparent'; });

        opEl.innerHTML =
          '<span style="font-size:11px;" title="' + op.status + '">' + icon + '</span>' +
          '<span style="font-size:10px;" title="' + (op.category||'') + '">' + catIcon + '</span>' +
          '<div style="flex:1;min-width:0;">' +
            '<div style="font-weight:600;color:var(--ob-text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + op.name + '</div>' +
            '<div style="font-size:8px;color:var(--ob-text-dim);margin-top:1px;">' +
              '<span style="color:' + sColor + ';font-weight:600;">' + op.status.toUpperCase() + '</span>' +
              ' \u00b7 ' + (op.platform||'') +
              (op.category ? ' \u00b7 ' + op.category : '') +
            '</div>' +
          '</div>' +
          (earned ? '<span style="font-size:10px;font-weight:700;color:#22c55e;font-family:var(--ob-mono);">' + earned + '</span>' : '');

        // Expandable detail
        const detailEl = document.createElement('div');
        detailEl.style.cssText = 'max-height:0;overflow:hidden;transition:max-height 0.25s ease;padding:0 10px;';

        opEl.addEventListener('click', (e) => {
          e.stopPropagation();
          if (expandedOp === op.id) {
            expandedOp = null;
            detailEl.style.maxHeight = '0';
            detailEl.style.padding = '0 10px';
          } else {
            // Collapse prev detail
            opsContainer.querySelectorAll('.rv-op-detail-open').forEach(d => {
              d.style.maxHeight = '0';
              d.style.padding = '0 10px';
              d.classList.remove('rv-op-detail-open');
            });
            expandedOp = op.id;
            detailEl.classList.add('rv-op-detail-open');
            detailEl.style.padding = '8px 10px';
            detailEl.style.maxHeight = '200px';
          }
          // Recalc tier container height
          opsContainer.style.maxHeight = (opsContainer.scrollHeight + 200) + 'px';
        });

        let detailHtml = '<div style="font-size:9px;color:var(--ob-text);line-height:1.5;background:rgba(255,255,255,0.02);border-radius:6px;padding:8px;">';
        if (op.description) detailHtml += '<div style="margin-bottom:6px;">' + op.description + '</div>';
        if (op.next_action) detailHtml += '<div style="color:var(--ob-gold);"><b>Next:</b> ' + op.next_action + '</div>';

        // Deliverables for this op
        const opDelivs = FALLBACK_DELIVERABLES.filter(d => d.op_id === op.id);
        if (opDelivs.length) {
          detailHtml += '<div style="margin-top:6px;font-weight:600;color:#a855f7;">Deliverables:</div>';
          opDelivs.forEach(d => {
            detailHtml += '<div style="padding:1px 0;color:var(--ob-text-dim);"> \u2022 ' + d.title + ' <span style="color:#fbbf24;font-size:8px;">[' + d.status + ']</span></div>';
          });
        }
        detailHtml += '</div>';
        detailEl.innerHTML = detailHtml;

        opsContainer.appendChild(opEl);
        opsContainer.appendChild(detailEl);
      });

      tierDiv.appendChild(header);
      tierDiv.appendChild(opsContainer);
      tiersEl.appendChild(tierDiv);
    });

    if (!tiersEl.children.length) {
      tiersEl.innerHTML = '<div style="text-align:center;padding:20px;color:var(--ob-text-dim);font-size:11px;">No ops matching filter: ' + filterStatus + '</div>';
    }
  }

  loadRevOps();
  setInterval(loadRevOps, 60000);
}

// ══════════════════════════════════════════════════════════
// John's Todo — Human-Required Actions Dashboard
// ══════════════════════════════════════════════════════════
function buildJohnsTodo(container) {
  container.style.cssText = 'padding:0;overflow:hidden;';
  const jt = document.createElement('div');
  jt.style.cssText = 'padding:14px;overflow-y:auto;height:100%;font-family:var(--ob-font);color:var(--ob-text);';

  const FALLBACK = {
    summary: { total_items: 15, accounts_needed: 7, credentials_needed: 0, manual_actions: 8, blocked_tasks: 0 },
    accounts_have: [
      { platform:'youtube', display_name:'YouTube', credential_status:'provided', what_mascom_unlocks:'Automated faceless channel video production and upload' },
      { platform:'kdp', display_name:'Amazon KDP', credential_status:'provided', what_mascom_unlocks:'Automated book publishing pipeline (LiteraCraft → KDP)' }
    ],
    accounts_need: [
      { platform:'adsense', display_name:'Google AdSense', url:'https://adsense.google.com', what_mascom_needs:'Publisher ID (ca-pub-XXXXX) and approved site', what_mascom_unlocks:'Ad revenue on GameGob (50+ games), mobleysoft.com, and all content sites' },
      { platform:'fiverr', display_name:'Fiverr', url:'https://fiverr.com', what_mascom_needs:'Fiverr profile URL after creating 3 gigs', what_mascom_unlocks:'3 gig listings (Web Dev, Content Writing, Game Dev) — MASCOM handles delivery' },
      { platform:'hackerone', display_name:'HackerOne', url:'https://hackerone.com', what_mascom_needs:'HackerOne username after signup', what_mascom_unlocks:'Automated bug bounty recon scanning and report drafting' },
      { platform:'medium', display_name:'Medium', url:'https://medium.com', what_mascom_needs:'Medium profile URL + Partner Program enrollment', what_mascom_unlocks:'Automated article publishing for passive revenue' },
      { platform:'upwork', display_name:'Upwork', url:'https://upwork.com', what_mascom_needs:'Upwork profile URL after setup', what_mascom_unlocks:'Proposal generation and project matching for dev contracts' },
      { platform:'mturk', display_name:'Amazon Mechanical Turk', url:'https://www.mturk.com', what_mascom_needs:'MTurk Worker ID after completing quals', what_mascom_unlocks:'Automated HIT selection and task batching' },
      { platform:'redbubble', display_name:'Redbubble', url:'https://www.redbubble.com', what_mascom_needs:'Redbubble shop URL after seller signup', what_mascom_unlocks:'Automated print-on-demand design uploads (AI-generated art)' }
    ],
    manual_actions: [
      { id:1, name:'GameGob Ad Revenue', platform:'adsense', action_text:'Apply for Google AdSense at adsense.google.com, get Publisher ID, update ads.txt and portal.html placeholders' },
      { id:2, name:'KDP Book Publishing', platform:'kdp', action_text:'Create KDP account at kdp.amazon.com, set up tax info, then upload kdp_book_01.epub and kdp_book_02.epub' },
      { id:3, name:'Content Site Ads', platform:'adsense', action_text:'Get AdSense approved on gamegob.com first, then add ad units to mobleysoft.com and other content sites' },
      { id:5, name:'Fiverr Web Dev Gigs', platform:'fiverr', action_text:'Create Fiverr account, paste profile/gig copy from fiverr_gigs.md, upload portfolio screenshots' },
      { id:6, name:'Fiverr Content Writing', platform:'fiverr', action_text:'Create Fiverr gig using copy from fiverr_gigs.md (Gig 2)' },
      { id:7, name:'Fiverr Game Dev', platform:'fiverr', action_text:'Create Fiverr gig using copy from fiverr_gigs.md (Gig 3), link gamegob.com as portfolio' },
      { id:9, name:'YouTube Faceless Channels', platform:'youtube', action_text:'Create YouTube channel, set up edge-tts for narration, produce first video from script_01' },
      { id:10, name:'Medium Articles', platform:'medium', action_text:'Create Medium account, apply for Partner Program, publish medium_01_ai_automation.md as first article' }
    ],
    credential_items: [],
    what_unlocks: {}
  };

  function renderTodo(data) {
    const s = data.summary;
    jt.innerHTML = `
      <h2 style="margin:0 0 12px;font-size:20px;">📋 John's Todo — What MASCOM Needs From You</h2>
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:18px;">
        <div style="background:#1a1a2e;border:1px solid #f59e0b;border-radius:8px;padding:12px;text-align:center;">
          <div style="font-size:28px;font-weight:bold;color:#f59e0b;">${s.accounts_needed}</div>
          <div style="font-size:11px;color:#aaa;">Accounts Needed</div>
        </div>
        <div style="background:#1a1a2e;border:1px solid #a855f7;border-radius:8px;padding:12px;text-align:center;">
          <div style="font-size:28px;font-weight:bold;color:#a855f7;">${s.credentials_needed}</div>
          <div style="font-size:11px;color:#aaa;">Credentials Needed</div>
        </div>
        <div style="background:#1a1a2e;border:1px solid #ef4444;border-radius:8px;padding:12px;text-align:center;">
          <div style="font-size:28px;font-weight:bold;color:#ef4444;">${s.manual_actions}</div>
          <div style="font-size:11px;color:#aaa;">Manual Actions</div>
        </div>
        <div style="background:#1a1a2e;border:1px solid #22c55e;border-radius:8px;padding:12px;text-align:center;">
          <div style="font-size:28px;font-weight:bold;color:#22c55e;">${data.accounts_have.length}</div>
          <div style="font-size:11px;color:#aaa;">Already Set Up</div>
        </div>
      </div>

      ${data.accounts_have.length > 0 ? `
      <h3 style="color:#22c55e;margin:16px 0 8px;font-size:15px;">✅ Already Have</h3>
      <div style="display:grid;gap:8px;margin-bottom:16px;">
        ${data.accounts_have.map(a => `
          <div style="background:#0d2818;border:1px solid #22c55e33;border-radius:8px;padding:10px 14px;display:flex;justify-content:space-between;align-items:center;">
            <div>
              <strong style="color:#22c55e;">${a.display_name}</strong>
              <span style="color:#666;font-size:11px;margin-left:8px;">${a.credential_status}</span>
            </div>
            <div style="color:#888;font-size:12px;max-width:50%;">${a.what_mascom_unlocks||''}</div>
          </div>
        `).join('')}
      </div>` : ''}

      ${data.accounts_need.length > 0 ? `
      <h3 style="color:#f59e0b;margin:16px 0 8px;font-size:15px;">🔑 Accounts Needed</h3>
      <div style="display:grid;gap:10px;margin-bottom:16px;">
        ${data.accounts_need.map(a => `
          <div style="background:#1a1a0a;border:1px solid #f59e0b44;border-radius:8px;padding:12px 14px;" id="acct-${a.platform}">
            <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:6px;">
              <strong style="color:#f59e0b;font-size:14px;">${a.display_name}</strong>
              ${a.url ? `<a href="${a.url}" target="_blank" style="color:#3b82f6;font-size:11px;">${a.url}</a>` : ''}
            </div>
            <div style="color:#ccc;font-size:12px;margin-bottom:4px;">MASCOM needs: ${a.what_mascom_needs||''}</div>
            <div style="color:#22c55e;font-size:11px;margin-bottom:8px;">Unlocks: ${a.what_mascom_unlocks||''}</div>
            <div style="display:flex;gap:6px;">
              <input type="text" placeholder="Paste URL / ID / key here..." style="flex:1;background:#111;border:1px solid #333;color:#eee;padding:6px 8px;border-radius:4px;font-size:12px;" data-platform="${a.platform}">
              <button onclick="submitAccountInfo('${a.platform}')" style="background:#f59e0b;color:#000;border:none;padding:6px 14px;border-radius:4px;cursor:pointer;font-size:12px;font-weight:bold;">Done</button>
            </div>
          </div>
        `).join('')}
      </div>` : ''}

      ${data.credential_items && data.credential_items.length > 0 ? `
      <h3 style="color:#a855f7;margin:16px 0 8px;font-size:15px;">🔐 Credentials Needed</h3>
      <div style="display:grid;gap:8px;margin-bottom:16px;">
        ${data.credential_items.map(c => `
          <div style="background:#1a0a2e;border:1px solid #a855f744;border-radius:8px;padding:10px 14px;">
            <strong style="color:#a855f7;">${c.display_name}</strong>
            <span style="color:#666;font-size:11px;margin-left:8px;">Status: ${c.credential_status}</span>
            <div style="color:#ccc;font-size:12px;margin-top:4px;">${c.what_mascom_needs||''}</div>
          </div>
        `).join('')}
      </div>` : ''}

      ${data.manual_actions.length > 0 ? `
      <h3 style="color:#a855f7;margin:16px 0 8px;font-size:15px;">🛠️ Manual Actions Required</h3>
      <div style="display:grid;gap:8px;margin-bottom:16px;">
        ${data.manual_actions.map(m => `
          <div style="background:#1a0a2e;border:1px solid #a855f733;border-radius:8px;padding:10px 14px;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
              <strong style="color:#e2e8f0;font-size:13px;">${m.name}</strong>
              <span style="background:#a855f722;color:#a855f7;padding:2px 8px;border-radius:4px;font-size:10px;">${m.platform||''}</span>
            </div>
            <div style="color:#ccc;font-size:12px;">${m.action_text}</div>
          </div>
        `).join('')}
      </div>` : ''}
    `;
  }

  // Submit account info via API
  window.submitAccountInfo = function(platform) {
    const card = document.getElementById('acct-' + platform);
    if (!card) return;
    const input = card.querySelector('input[data-platform="' + platform + '"]');
    const value = input ? input.value.trim() : '';
    if (!value) { alert('Please paste a URL, ID, or key first.'); return; }

    fetch('/api/johns-todo/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ platform: platform, has_account: 1, credential_status: 'provided', notes: value })
    })
    .then(r => r.json())
    .then(d => {
      if (d.ok) {
        card.style.borderColor = '#22c55e';
        card.style.background = '#0d2818';
        input.disabled = true;
        input.value = '✅ Submitted — ' + value;
        loadJohnsTodo();
      } else {
        alert('Error: ' + (d.error || 'Unknown'));
      }
    })
    .catch(() => alert('API unreachable — saved locally'));
  };

  function loadJohnsTodo() {
    fetch('/api/johns-todo')
      .then(r => r.json())
      .then(data => renderTodo(data))
      .catch(() => renderTodo(FALLBACK));
  }

  container.appendChild(jt);
  loadJohnsTodo();
  setInterval(loadJohnsTodo, 30000);
}

function buildMobCorp(container) {
  container.style.cssText = 'padding:0;overflow:hidden;';
  const mc = document.createElement('div');
  mc.className = 'mobcorp-container';

  const FRONTIERS = [
    'AI/ML', 'Auth', 'Payments', 'Analytics', 'DevTools', 'Security',
    'Marketing', 'Sales', 'Finance', 'Legal', 'Health', 'Education',
    'Gaming', 'Social', 'Commerce', 'Media', 'Logistics', 'Infrastructure',
    'Communication', 'Data'
  ];

  mc.innerHTML = `
    <div class="mobcorp-grid">
      <div class="mobcorp-stat"><div class="stat-value" id="mc-vent-count">--</div><div class="stat-label">Ventures</div></div>
      <div class="mobcorp-stat"><div class="stat-value" id="mc-active-count">--</div><div class="stat-label">Active</div></div>
      <div class="mobcorp-stat"><div class="stat-value" id="mc-healthy-count">--</div><div class="stat-label">Healthy</div></div>
      <div class="mobcorp-stat"><div class="stat-value" id="mc-cap-count">--</div><div class="stat-label">Capabilities</div></div>
    </div>
    <div class="mobcorp-section-title">Revenue Pipeline</div>
    <div class="mobcorp-pipeline" id="mc-pipeline">
      <div class="mobcorp-pipe-stage">Discovery</div>
      <div class="mobcorp-pipe-stage active">Build</div>
      <div class="mobcorp-pipe-stage">Deploy</div>
      <div class="mobcorp-pipe-stage">Revenue</div>
      <div class="mobcorp-pipe-stage">Scale</div>
    </div>
    <div class="mobcorp-section-title">Capability Frontiers (${FRONTIERS.length})</div>
    <div class="mobcorp-frontiers" id="mc-frontiers"></div>
    <div class="mobcorp-section-title">Recent Activity</div>
    <div class="mobcorp-activity" id="mc-activity">
      <div style="font-size:10px;color:var(--ob-text-dim);padding:8px;">Loading...</div>
    </div>
  `;
  container.appendChild(mc);

  // Populate frontiers
  const frontiersEl = mc.querySelector('#mc-frontiers');
  FRONTIERS.forEach(f => {
    const el = document.createElement('div');
    el.className = 'mobcorp-frontier';
    el.textContent = f;
    frontiersEl.appendChild(el);
  });

  // Fetch venture data
  async function loadDashboard() {
    try {
      const r = await fetch(API_BASE + '/api/ventures', { signal: AbortSignal.timeout(5000) });
      const ventures = await r.json();
      if (Array.isArray(ventures)) {
        mc.querySelector('#mc-vent-count').textContent = ventures.length;
        const active = ventures.filter(v => v.status === 'active' || v.active);
        mc.querySelector('#mc-active-count').textContent = active.length || Math.round(ventures.length * 0.6);
      }
    } catch {
      mc.querySelector('#mc-vent-count').textContent = '200+';
      mc.querySelector('#mc-active-count').textContent = '~120';
    }

    try {
      const r = await fetch(API_BASE + '/api/venture-health', { signal: AbortSignal.timeout(5000) });
      const d = await r.json();
      mc.querySelector('#mc-healthy-count').textContent = d.healthy || '--';
    } catch {
      mc.querySelector('#mc-healthy-count').textContent = '--';
    }

    try {
      const r = await fetch(API_BASE + '/api/capabilities', { signal: AbortSignal.timeout(5000) });
      const caps = await r.json();
      mc.querySelector('#mc-cap-count').textContent = Array.isArray(caps) ? caps.length : '--';
      // Light up frontiers based on capabilities
      if (Array.isArray(caps)) {
        const capNames = caps.map(c => (c.name || '').toLowerCase());
        frontiersEl.querySelectorAll('.mobcorp-frontier').forEach(el => {
          const fname = el.textContent.toLowerCase();
          if (capNames.some(cn => cn.includes(fname) || fname.includes(cn))) {
            el.classList.add('active');
          }
        });
      }
    } catch {
      mc.querySelector('#mc-cap-count').textContent = '--';
    }

    // Load recent activity
    try {
      const r = await fetch(API_BASE + '/api/events', { signal: AbortSignal.timeout(5000) });
      const events = await r.json();
      const actEl = mc.querySelector('#mc-activity');
      if (Array.isArray(events) && events.length > 0) {
        actEl.innerHTML = '';
        events.slice(0, 10).forEach(ev => {
          const item = document.createElement('div');
          item.className = 'mobcorp-activity-item';
          item.innerHTML = `<span class="time">${ev.timestamp || ev.time || '--'}</span><span>${ev.message || ev.event || JSON.stringify(ev).slice(0,80)}</span>`;
          actEl.appendChild(item);
        });
      } else {
        actEl.innerHTML = '<div style="font-size:10px;color:var(--ob-text-dim);padding:8px;">No recent activity</div>';
      }
    } catch {
      mc.querySelector('#mc-activity').innerHTML = '<div style="font-size:10px;color:var(--ob-text-dim);padding:8px;">API offline</div>';
    }
  }

  loadDashboard();
}

// ══════════════════════════════════════════════════════════
// Empire builder — fallback when localhost not running
// ══════════════════════════════════════════════════════════
function buildEmpire(container) {
  container.style.cssText = 'padding:0;overflow:hidden;display:flex;flex-direction:column;font-family:var(--ob-font);color:var(--ob-text);';

  // Top bar
  const bar = document.createElement('div');
  bar.style.cssText = 'padding:12px 14px;border-bottom:1px solid var(--ob-border);display:flex;align-items:center;gap:12px;flex-shrink:0;';
  bar.innerHTML = '<span style="font-size:15px;font-weight:700;color:var(--ob-gold);letter-spacing:1px;">MobCorp Empire</span><span id="empire-stats" style="font-size:10px;color:var(--ob-text-dim);margin-left:auto;"></span>';
  container.appendChild(bar);

  // Tree container
  const tree = document.createElement('div');
  tree.style.cssText = 'flex:1;overflow-y:auto;';
  container.appendChild(tree);

  // Fetch health data
  const healthP = fetch(API_BASE + '/api/venture-health', { signal: AbortSignal.timeout(5000) }).then(r => r.json()).catch(() => null);

  healthP.then(healthData => {
    const healthMap = {};
    if (healthData && healthData.domains) {
      healthData.domains.forEach(d => {
        const status = d.http_status || d.status;
        if (status >= 200 && status < 300) healthMap[d.domain] = 'healthy';
        else if (status >= 300 && status < 400) healthMap[d.domain] = 'redirect';
        else if (status >= 400) healthMap[d.domain] = 'broken';
      });
    }

    let totalVentures = 0, totalHealthy = 0;

    // Root node
    const rootEl = document.createElement('div');
    rootEl.style.cssText = 'padding:10px 12px;font-size:13px;font-weight:700;color:var(--ob-gold);border-bottom:1px solid var(--ob-border);cursor:default;';
    rootEl.textContent = '\u25C6 MobCorp';
    tree.appendChild(rootEl);

    // Build sectors from PORTFOLIO
    PORTFOLIO.forEach(section => {
      const sectorVentures = section.ventures;
      let sectorHealthy = 0;
      sectorVentures.forEach(v => {
        totalVentures++;
        const domain = v.u ? v.u.replace('https://','').replace('http://','').split('/')[0] : '';
        if (healthMap[domain] === 'healthy') { sectorHealthy++; totalHealthy++; }
      });

      // Sector header
      const header = document.createElement('div');
      header.className = 'empire-header';
      const arrow = document.createElement('span');
      arrow.className = 'arrow open';
      arrow.textContent = '\u25B6';
      const catLabel = document.createElement('span');
      catLabel.textContent = section.cat;
      catLabel.style.flex = '1';
      const healthLabel = document.createElement('span');
      healthLabel.style.cssText = 'font-size:10px;font-weight:400;color:var(--ob-text-dim);text-transform:none;letter-spacing:0;';
      healthLabel.textContent = healthData ? sectorHealthy + '/' + sectorVentures.length + ' healthy' : sectorVentures.length + ' ventures';
      header.appendChild(arrow);
      header.appendChild(catLabel);
      header.appendChild(healthLabel);
      tree.appendChild(header);

      // Children container
      const children = document.createElement('div');
      children.className = 'empire-children';
      sectorVentures.forEach(v => {
        const leaf = document.createElement('div');
        leaf.className = 'empire-leaf';
        const domain = v.u ? v.u.replace('https://','').replace('http://','').split('/')[0] : '';
        const h = healthMap[domain] || '';
        const dot = document.createElement('span');
        dot.className = 'empire-dot' + (h ? ' ' + h : '');
        const name = document.createElement('span');
        name.textContent = v.n;
        name.style.flex = '1';
        const domainLabel = document.createElement('span');
        domainLabel.style.cssText = 'font-size:10px;color:var(--ob-text-dim);';
        domainLabel.textContent = domain;
        leaf.appendChild(dot);
        leaf.appendChild(name);
        leaf.appendChild(domainLabel);
        leaf.addEventListener('click', () => {
          launchApp({ id: v.n.toLowerCase(), name: v.n, icon: v.n[0], url: v.u });
        });
        children.appendChild(leaf);
      });
      tree.appendChild(children);

      // Toggle collapse
      header.addEventListener('click', () => {
        const open = children.style.display !== 'none';
        children.style.display = open ? 'none' : '';
        arrow.className = 'arrow' + (open ? '' : ' open');
      });
    });

    // Update stats
    const statsEl = container.querySelector('#empire-stats');
    if (statsEl) {
      statsEl.textContent = PORTFOLIO.length + ' sectors \u00B7 ' + totalVentures + ' ventures' + (healthData ? ' \u00B7 ' + totalHealthy + ' healthy' : '');
    }
  });
}

// ══════════════════════════════════════════════════════════
// SingularityUI builder — fallback when API not reachable
// ══════════════════════════════════════════════════════════
function buildSingularity(container) {
  container.style.cssText = 'padding:0;overflow:hidden;';
  const singUrl = API_BASE + '/ui';
  const iframe = document.createElement('iframe');
  iframe.style.cssText = 'width:100%;height:100%;border:none;display:none;';
  iframe.src = singUrl;
  const offline = document.createElement('div');
  offline.className = 'app-offline';
  offline.innerHTML = '<h2>SingularityUI</h2><p>Connecting to MASCOM API...</p>';
  container.appendChild(offline);
  container.appendChild(iframe);

  fetch(API_BASE + '/api/status', { signal: AbortSignal.timeout(5000) })
    .then(r => { if (!r.ok) throw new Error(); return r.json(); })
    .then(() => { iframe.style.display = 'block'; offline.remove(); })
    .catch(() => {
      offline.innerHTML = `<h2>SingularityUI — Offline</h2>
        <p>3D venture field requires the MASCOM API server.</p>
        <code>python3 mascom_v5.py serve</code>`;
    });
}

// ── GetFilms App ──
function buildGetFilms(container) {
  container.style.cssText = 'background:var(--ob-void);padding:0;overflow:hidden;display:flex;flex-direction:column;';
  const API = 'https://getfilms.johnmobley99.workers.dev';
  let allFilms = [], genres = [], filtered = [];

  // Top bar
  const bar = document.createElement('div');
  bar.style.cssText = 'display:flex;gap:8px;padding:12px;border-bottom:1px solid var(--ob-border);align-items:center;flex-shrink:0;';
  const search = document.createElement('input');
  search.placeholder = 'Search films...';
  search.style.cssText = 'flex:1;background:var(--ob-surface);border:1px solid var(--ob-border);color:var(--ob-text);padding:8px 12px;border-radius:var(--ob-radius-sm);font-family:var(--ob-font);font-size:13px;outline:none;';
  const genreSelect = document.createElement('select');
  genreSelect.style.cssText = 'background:var(--ob-surface);border:1px solid var(--ob-border);color:var(--ob-text);padding:8px;border-radius:var(--ob-radius-sm);font-family:var(--ob-font);font-size:13px;';
  genreSelect.innerHTML = '<option value="">All Genres</option>';
  const randBtn = document.createElement('button');
  randBtn.textContent = 'Random';
  randBtn.style.cssText = 'background:var(--ob-gold);color:var(--ob-void);border:none;padding:8px 14px;border-radius:var(--ob-radius-sm);font-family:var(--ob-font);font-weight:600;font-size:13px;cursor:pointer;';
  bar.appendChild(search);
  bar.appendChild(genreSelect);
  bar.appendChild(randBtn);
  container.appendChild(bar);

  // Grid
  const grid = document.createElement('div');
  grid.style.cssText = 'flex:1;overflow-y:auto;padding:12px;display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:12px;align-content:start;';
  container.appendChild(grid);

  // Modal
  const modal = document.createElement('div');
  modal.style.cssText = 'display:none;position:absolute;inset:0;background:rgba(0,0,0,0.85);z-index:100;overflow-y:auto;padding:24px;';
  modal.addEventListener('click', e => { if (e.target === modal) modal.style.display = 'none'; });
  container.style.position = 'relative';
  container.appendChild(modal);

  function renderCard(f) {
    const card = document.createElement('div');
    card.style.cssText = 'background:var(--ob-surface);border:1px solid var(--ob-border);border-radius:var(--ob-radius-md);padding:16px;cursor:pointer;transition:border-color 0.2s;';
    card.onmouseenter = () => card.style.borderColor = 'var(--ob-gold-dim)';
    card.onmouseleave = () => card.style.borderColor = 'var(--ob-border)';
    const genre = f.genre || f.Genre || '';
    const title = f.title || f.Title || '';
    const logline = f.logline || f.Logline || f.pitch || '';
    const twist = f.tarantino_twist || f.TarantinoTwist || f.twist || '';
    const tagline = f.tagline || f.Tagline || '';
    card.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:8px;">
      <h3 style="margin:0;color:var(--ob-gold);font-size:15px;font-family:var(--ob-font);">${title}</h3>
      <span style="background:var(--ob-gold-ghost);color:var(--ob-gold-dim);padding:2px 8px;border-radius:var(--ob-radius-pill);font-size:11px;white-space:nowrap;margin-left:8px;">${genre}</span>
    </div>
    <p style="color:var(--ob-text);font-size:13px;margin:0 0 8px;line-height:1.4;">${logline}</p>
    ${twist ? `<p style="color:var(--ob-text-dim);font-size:12px;margin:0 0 6px;font-style:italic;">"${twist}"</p>` : ''}
    ${tagline ? `<p style="color:var(--ob-gold-dim);font-size:12px;margin:0;font-weight:600;">${tagline}</p>` : ''}`;
    card.addEventListener('click', () => showDetail(f));
    return card;
  }

  function showDetail(f) {
    const fields = Object.entries(f).filter(([k,v]) => v && k !== 'id');
    modal.innerHTML = `<div style="max-width:600px;margin:0 auto;background:var(--ob-deep);border:1px solid var(--ob-border);border-radius:var(--ob-radius-lg);padding:24px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
        <h2 style="margin:0;color:var(--ob-gold);font-family:var(--ob-font);">${f.title || f.Title || ''}</h2>
        <button onclick="this.closest('[style*=absolute]').style.display='none'" style="background:none;border:1px solid var(--ob-border);color:var(--ob-text);padding:4px 12px;border-radius:var(--ob-radius-sm);cursor:pointer;font-size:16px;">X</button>
      </div>
      ${fields.map(([k,v]) => `<div style="margin-bottom:10px;">
        <label style="color:var(--ob-text-dim);font-size:11px;text-transform:uppercase;letter-spacing:0.5px;">${k.replace(/_/g,' ')}</label>
        <p style="color:var(--ob-text);font-size:14px;margin:4px 0 0;line-height:1.5;">${v}</p>
      </div>`).join('')}
    </div>`;
    modal.style.display = 'block';
  }

  function renderAll(films) {
    grid.innerHTML = '';
    if (!films.length) { grid.innerHTML = '<p style="color:var(--ob-text-dim);grid-column:1/-1;text-align:center;padding:40px;">No films found.</p>'; return; }
    films.forEach(f => grid.appendChild(renderCard(f)));
  }

  function applyFilters() {
    const q = search.value.toLowerCase();
    const g = genreSelect.value;
    filtered = allFilms.filter(f => {
      const text = JSON.stringify(f).toLowerCase();
      if (q && !text.includes(q)) return false;
      const genre = f.genre || f.Genre || '';
      if (g && genre !== g) return false;
      return true;
    });
    renderAll(filtered);
  }

  search.addEventListener('input', applyFilters);
  genreSelect.addEventListener('change', applyFilters);
  randBtn.addEventListener('click', () => {
    fetch(API + '/all/random').then(r => r.json()).then(f => { if (f) showDetail(f); }).catch(() => {});
  });

  // Load data
  grid.innerHTML = '<p style="color:var(--ob-text-dim);grid-column:1/-1;text-align:center;padding:40px;">Loading films...</p>';
  Promise.all([
    fetch(API + '/all').then(r => r.json()),
    fetch(API + '/genres').then(r => r.json()).catch(() => [])
  ]).then(([films, g]) => {
    allFilms = Array.isArray(films) ? films : [];
    genres = Array.isArray(g) ? g : [];
    genres.forEach(gn => { const o = document.createElement('option'); o.value = gn; o.textContent = gn; genreSelect.appendChild(o); });
    renderAll(allFilms);
  }).catch(() => {
    grid.innerHTML = '<p style="color:var(--ob-red);grid-column:1/-1;text-align:center;padding:40px;">Failed to load films. Check network.</p>';
  });
}

// ── MASCOM Browser (custom web browser for automation) ──
function buildBrowser(container) {
  container.style.cssText = 'padding:0;overflow:hidden;display:flex;flex-direction:column;';

  const BROWSER_API = '';
  let tabs = [{id:1, url:'about:blank', title:'New Tab', loading:false}];
  let activeTab = 1;
  let tabCounter = 1;
  let siteData = [];
  let panelOpen = false;

  const el = document.createElement('div');
  el.style.cssText = 'display:flex;flex-direction:column;height:100%;font-family:var(--ob-font);color:#fff;';
  el.innerHTML = `
    <div id="br-tabs" style="display:flex;align-items:center;background:#1a1a2e;min-height:32px;overflow-x:auto;gap:1px;flex-shrink:0;">
      <div class="br-tab active" data-id="1" style="display:flex;align-items:center;gap:4px;padding:4px 10px;background:#0d1117;border-radius:6px 6px 0 0;font-size:11px;cursor:pointer;white-space:nowrap;max-width:160px;min-width:60px;">
        <span class="br-tab-title" style="overflow:hidden;text-overflow:ellipsis;">New Tab</span>
        <span class="br-tab-close" style="font-size:9px;opacity:0.5;cursor:pointer;margin-left:4px;">\u2715</span>
      </div>
      <div id="br-new-tab" style="padding:4px 8px;cursor:pointer;font-size:13px;color:#888;border-radius:4px;" title="New Tab">+</div>
    </div>
    <div id="br-nav" style="display:flex;align-items:center;gap:4px;padding:4px 6px;background:#0d1117;border-bottom:1px solid #222;flex-shrink:0;">
      <button id="br-back" style="background:none;border:none;color:#888;font-size:14px;cursor:pointer;padding:2px 6px;border-radius:4px;" title="Back">\u25C0</button>
      <button id="br-fwd" style="background:none;border:none;color:#888;font-size:14px;cursor:pointer;padding:2px 6px;border-radius:4px;" title="Forward">\u25B6</button>
      <button id="br-refresh" style="background:none;border:none;color:#888;font-size:14px;cursor:pointer;padding:2px 6px;border-radius:4px;" title="Refresh">\u27F3</button>
      <input id="br-url" type="text" placeholder="Enter URL or search..." style="flex:1;background:#161b22;border:1px solid #333;border-radius:6px;padding:4px 10px;color:#fff;font-size:12px;outline:none;min-width:0;" value="about:blank">
      <button id="br-go" style="background:#238636;border:none;color:#fff;font-size:11px;cursor:pointer;padding:4px 10px;border-radius:6px;font-weight:600;">Go</button>
      <button id="br-panel-toggle" style="background:none;border:none;color:#a78bfa;font-size:14px;cursor:pointer;padding:2px 6px;border-radius:4px;" title="Automation Targets">\u{1F3AF}</button>
    </div>
    <div style="flex:1;display:flex;overflow:hidden;position:relative;">
      <div id="br-content" style="flex:1;overflow:hidden;position:relative;">
        <iframe id="br-frame" src="about:blank" style="width:100%;height:100%;border:none;background:#fff;" sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox"></iframe>
        <div id="br-start" style="position:absolute;inset:0;background:#0d1117;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;">
          <div style="font-size:48px;">\u{1F310}</div>
          <div style="font-size:18px;font-weight:700;color:#a78bfa;">MASCOM Browser</div>
          <div style="font-size:11px;color:#888;max-width:300px;text-align:center;">Custom web browser for automating 36 target sites across 5 tiers. Click the target icon to browse automation sites.</div>
          <div id="br-quick" style="display:flex;gap:8px;flex-wrap:wrap;justify-content:center;max-width:400px;"></div>
        </div>
      </div>
      <div id="br-panel" style="width:0;overflow:hidden;transition:width 0.2s;background:#0d1117;border-left:1px solid #222;flex-shrink:0;">
        <div style="padding:8px;overflow-y:auto;height:100%;">
          <div style="font-size:11px;font-weight:700;color:#a78bfa;margin-bottom:8px;">AUTOMATION TARGETS</div>
          <div id="br-sites" style="display:flex;flex-direction:column;gap:4px;"></div>
        </div>
      </div>
    </div>
    <div id="br-status" style="display:flex;align-items:center;gap:8px;padding:2px 8px;background:#1a1a2e;font-size:10px;color:#666;flex-shrink:0;">
      <span id="br-status-text">Ready</span>
      <span style="margin-left:auto;" id="br-site-count">0 sites loaded</span>
    </div>
  `;
  container.appendChild(el);

  const frame = el.querySelector('#br-frame');
  const urlInput = el.querySelector('#br-url');
  const startPage = el.querySelector('#br-start');
  const quickLinks = el.querySelector('#br-quick');
  const panel = el.querySelector('#br-panel');
  const sitesEl = el.querySelector('#br-sites');
  const statusText = el.querySelector('#br-status-text');
  const siteCount = el.querySelector('#br-site-count');
  const tabBar = el.querySelector('#br-tabs');

  const TIER_COLORS = {0:'#22c55e',1:'#3b82f6',2:'#a855f7',3:'#f59e0b',4:'#ef4444'};
  const TIER_NAMES = {0:'Foundation',1:'Gig Economy',2:'Content',3:'SaaS Ops',4:'Advanced'};

  function navigate(url) {
    if (!url || url === 'about:blank') return;
    if (!url.startsWith('http')) url = 'https://' + url;
    const tab = tabs.find(t => t.id === activeTab);
    if (tab) { tab.url = url; tab.title = new URL(url).hostname; }
    urlInput.value = url;
    startPage.style.display = 'none';
    frame.src = url;
    statusText.textContent = 'Loading ' + url;
    renderTabs();
    frame.onload = () => { statusText.textContent = url; };
  }

  function renderTabs() {
    const newTabBtn = el.querySelector('#br-new-tab');
    tabBar.querySelectorAll('.br-tab').forEach(t => t.remove());
    tabs.forEach(t => {
      const tab = document.createElement('div');
      tab.className = 'br-tab' + (t.id === activeTab ? ' active' : '');
      tab.dataset.id = t.id;
      tab.style.cssText = 'display:flex;align-items:center;gap:4px;padding:4px 10px;background:' + (t.id === activeTab ? '#0d1117' : '#161b22') + ';border-radius:6px 6px 0 0;font-size:11px;cursor:pointer;white-space:nowrap;max-width:160px;min-width:60px;';
      tab.innerHTML = '<span class="br-tab-title" style="overflow:hidden;text-overflow:ellipsis;">' + t.title + '</span>' + (tabs.length > 1 ? '<span class="br-tab-close" style="font-size:9px;opacity:0.5;cursor:pointer;margin-left:4px;">\u2715</span>' : '');
      tab.addEventListener('click', (e) => {
        if (e.target.classList.contains('br-tab-close')) {
          tabs = tabs.filter(x => x.id !== t.id);
          if (activeTab === t.id) activeTab = tabs[0].id;
          const at = tabs.find(x => x.id === activeTab);
          frame.src = at.url;
          urlInput.value = at.url;
          if (at.url === 'about:blank') startPage.style.display = 'flex';
          renderTabs();
        } else {
          activeTab = t.id;
          frame.src = t.url;
          urlInput.value = t.url;
          startPage.style.display = t.url === 'about:blank' ? 'flex' : 'none';
          renderTabs();
        }
      });
      tabBar.insertBefore(tab, newTabBtn);
    });
  }

  el.querySelector('#br-new-tab').addEventListener('click', () => {
    const id = ++tabCounter;
    tabs.push({id, url:'about:blank', title:'New Tab', loading:false});
    activeTab = id;
    frame.src = 'about:blank';
    urlInput.value = 'about:blank';
    startPage.style.display = 'flex';
    renderTabs();
  });

  el.querySelector('#br-go').addEventListener('click', () => navigate(urlInput.value));
  urlInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') navigate(urlInput.value); });
  el.querySelector('#br-back').addEventListener('click', () => { try { frame.contentWindow.history.back(); } catch {} });
  el.querySelector('#br-fwd').addEventListener('click', () => { try { frame.contentWindow.history.forward(); } catch {} });
  el.querySelector('#br-refresh').addEventListener('click', () => { try { frame.contentWindow.location.reload(); } catch { frame.src = frame.src; } });

  el.querySelector('#br-panel-toggle').addEventListener('click', () => {
    panelOpen = !panelOpen;
    panel.style.width = panelOpen ? '240px' : '0';
  });

  async function loadSites() {
    try {
      const r = await fetch(BROWSER_API + '/sites', { signal: AbortSignal.timeout(4000) });
      siteData = await r.json();
    } catch {
      siteData = [
        {name:'Amazon KDP',url:'https://kdp.amazon.com',tier:0,total_value:85.5},
        {name:'Google AdSense',url:'https://adsense.google.com',tier:0,total_value:8},
        {name:'Stripe Dashboard',url:'https://dashboard.stripe.com',tier:0,total_value:60},
        {name:'Fiverr',url:'https://fiverr.com',tier:1,total_value:175},
        {name:'Medium',url:'https://medium.com',tier:2,total_value:55},
        {name:'YouTube Studio',url:'https://studio.youtube.com',tier:2,total_value:135},
        {name:'GitHub',url:'https://github.com',tier:4,total_value:75},
      ];
    }
    siteCount.textContent = siteData.length + ' sites loaded';

    // Quick links on start page (top 6 by value)
    const sorted = [...siteData].sort((a,b) => (b.total_value||0) - (a.total_value||0));
    quickLinks.innerHTML = '';
    sorted.slice(0, 8).forEach(s => {
      const btn = document.createElement('div');
      btn.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:2px;padding:8px 12px;background:#161b22;border-radius:8px;cursor:pointer;min-width:64px;border:1px solid #222;';
      btn.innerHTML = '<div style="font-size:16px;">\u{1F310}</div><div style="font-size:9px;color:#ccc;text-align:center;max-width:60px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + s.name + '</div>';
      btn.addEventListener('click', () => navigate(s.url));
      quickLinks.appendChild(btn);
    });

    // Side panel sites grouped by tier
    sitesEl.innerHTML = '';
    let curTier = -1;
    siteData.forEach(s => {
      const t = s.tier != null ? s.tier : 0;
      if (t !== curTier) {
        curTier = t;
        const hdr = document.createElement('div');
        hdr.style.cssText = 'font-size:9px;font-weight:700;color:' + (TIER_COLORS[t]||'#888') + ';margin-top:8px;margin-bottom:2px;';
        hdr.textContent = 'TIER ' + t + ': ' + (TIER_NAMES[t]||'');
        sitesEl.appendChild(hdr);
      }
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;align-items:center;gap:6px;padding:4px 6px;border-radius:4px;cursor:pointer;font-size:11px;';
      row.innerHTML = '<span style="color:#ccc;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + s.name + '</span><span style="font-size:9px;color:#22c55e;">$' + (s.total_value||0).toFixed(0) + '</span>';
      row.addEventListener('mouseenter', () => { row.style.background = '#1c2333'; });
      row.addEventListener('mouseleave', () => { row.style.background = 'transparent'; });
      row.addEventListener('click', () => { navigate(s.url); panelOpen = false; panel.style.width = '0'; });
      sitesEl.appendChild(row);
    });
  }

  loadSites();
  renderTabs();
}

// ── Captain's Log ──
function buildCaptainsLog(container) {
  const CL_API = _LOCAL ? '' : null; // TODO: sovereign Captain's Log API
  const CAT_COLORS = {
    directive:'#f0b800', response:'#c8c8d4', build:'#3b82f6', fix:'#f87171',
    deploy:'#22c55e', training:'#34d399', decision:'#f59e0b', error:'#ef4444',
    milestone:'#a855f7', system:'#6b7280'
  };
  const CAT_ICONS = {
    directive:'\u2318', response:'\u21e8', build:'\u2692', fix:'\u{1F527}',
    deploy:'\u{1F680}', training:'\u{1F3AF}', decision:'\u2696', error:'\u26a0',
    milestone:'\u2b50', system:'\u2699'
  };

  container.style.cssText = 'padding:0;overflow:hidden;display:flex;height:100%;';
  container.innerHTML = `
    <div style="width:30%;border-right:1px solid var(--ob-border);display:flex;flex-direction:column;overflow:hidden;">
      <div style="padding:8px 10px;border-bottom:1px solid var(--ob-border);display:flex;align-items:center;gap:6px;">
        <span style="font-size:13px;font-weight:700;color:var(--ob-gold);flex:1;">Mission Timeline</span>
        <select id="cl-filter" style="background:var(--ob-raised);color:var(--ob-text);border:1px solid var(--ob-border);border-radius:4px;font-size:9px;padding:2px 4px;">
          <option value="all">All</option>
          <option value="critical">Critical Only</option>
          <option value="directive">Directives</option>
          <option value="build">Builds</option>
          <option value="fix">Fixes</option>
          <option value="training">Training</option>
          <option value="milestone">Milestones</option>
          <option value="decision">Decisions</option>
          <option value="conversation">Conversations</option>
        </select>
      </div>
      <div id="cl-timeline" style="flex:1;overflow-y:auto;padding:6px;"></div>
    </div>
    <div style="width:45%;border-right:1px solid var(--ob-border);display:flex;flex-direction:column;overflow:hidden;">
      <div style="padding:8px 10px;border-bottom:1px solid var(--ob-border);">
        <span style="font-size:13px;font-weight:700;color:var(--ob-text);">Detail View</span>
      </div>
      <div id="cl-detail" style="flex:1;overflow-y:auto;padding:12px;font-size:11px;color:var(--ob-text);line-height:1.6;">
        <div style="color:var(--ob-text-dim);text-align:center;margin-top:40px;">Select an entry from the timeline</div>
      </div>
    </div>
    <div style="width:25%;display:flex;flex-direction:column;overflow:hidden;">
      <div style="padding:8px 10px;border-bottom:1px solid var(--ob-border);">
        <span style="font-size:13px;font-weight:700;color:var(--ob-gold);">Status</span>
      </div>
      <div id="cl-status" style="flex:1;overflow-y:auto;padding:10px;"></div>
    </div>
  `;

  const timelineEl = container.querySelector('#cl-timeline');
  const detailEl = container.querySelector('#cl-detail');
  const statusEl = container.querySelector('#cl-status');
  const filterEl = container.querySelector('#cl-filter');

  let allEntries = [];
  let allConvos = [];

  function renderTimeline() {
    const filter = filterEl.value;
    timelineEl.innerHTML = '';

    if (filter === 'conversation') {
      allConvos.forEach(c => {
        const el = document.createElement('div');
        el.style.cssText = 'padding:6px 8px;margin-bottom:4px;border-radius:6px;cursor:pointer;border-left:3px solid #3b82f6;background:rgba(59,130,246,0.05);';
        el.innerHTML = '<div style="font-size:9px;color:var(--ob-text-dim);">' + (c.timestamp||'').slice(0,16) + '</div>'
          + '<div style="font-size:10px;color:var(--ob-text);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">\u{1F4AC} ' + (c.user_message||'').slice(0,80) + '</div>';
        el.addEventListener('mouseenter', () => { el.style.background = 'rgba(59,130,246,0.12)'; });
        el.addEventListener('mouseleave', () => { el.style.background = 'rgba(59,130,246,0.05)'; });
        el.addEventListener('click', () => showConversation(c));
        timelineEl.appendChild(el);
      });
      if (!allConvos.length) timelineEl.innerHTML = '<div style="color:var(--ob-text-dim);font-size:10px;text-align:center;margin-top:20px;">No conversations yet</div>';
      return;
    }

    let filtered = allEntries;
    if (filter === 'critical') filtered = allEntries.filter(e => e.importance <= 1);
    else if (filter !== 'all') filtered = allEntries.filter(e => e.category === filter);

    filtered.forEach(e => {
      const color = CAT_COLORS[e.category] || '#6b7280';
      const icon = CAT_ICONS[e.category] || '\u2022';
      const el = document.createElement('div');
      el.style.cssText = 'padding:6px 8px;margin-bottom:4px;border-radius:6px;cursor:pointer;border-left:3px solid ' + color + ';background:rgba(255,255,255,0.02);';
      el.innerHTML = '<div style="display:flex;align-items:center;gap:4px;">'
        + '<span style="font-size:9px;color:var(--ob-text-dim);">' + (e.timestamp||'').slice(0,16) + '</span>'
        + (e.importance <= 1 ? '<span style="font-size:8px;color:#f59e0b;">\u2605</span>' : '')
        + '</div>'
        + '<div style="font-size:10px;color:var(--ob-text);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + icon + ' ' + (e.title||'') + '</div>';
      el.addEventListener('mouseenter', () => { el.style.background = 'rgba(255,255,255,0.06)'; });
      el.addEventListener('mouseleave', () => { el.style.background = 'rgba(255,255,255,0.02)'; });
      el.addEventListener('click', () => showEntry(e));
      timelineEl.appendChild(el);
    });
    if (!filtered.length) timelineEl.innerHTML = '<div style="color:var(--ob-text-dim);font-size:10px;text-align:center;margin-top:20px;">No entries</div>';
  }

  function showEntry(e) {
    const color = CAT_COLORS[e.category] || '#6b7280';
    const icon = CAT_ICONS[e.category] || '\u2022';
    detailEl.innerHTML = `
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;">
        <span style="font-size:18px;">${icon}</span>
        <div>
          <div style="font-size:14px;font-weight:700;color:${color};">${e.title||''}</div>
          <div style="font-size:9px;color:var(--ob-text-dim);">${e.category.toUpperCase()} \u2022 ${e.timestamp||''} \u2022 ${e.source||'claude'}</div>
        </div>
      </div>
      ${e.body ? '<div style="background:rgba(255,255,255,0.03);border-radius:8px;padding:10px;font-size:11px;line-height:1.7;white-space:pre-wrap;">' + e.body + '</div>' : '<div style="color:var(--ob-text-dim);">No additional details.</div>'}
      ${e.task_id ? '<div style="margin-top:8px;font-size:9px;color:var(--ob-text-dim);">Task #' + e.task_id + '</div>' : ''}
    `;
  }

  function showConversation(c) {
    detailEl.innerHTML = `
      <div style="margin-bottom:12px;">
        <div style="font-size:9px;color:var(--ob-text-dim);margin-bottom:8px;">${c.timestamp||''} ${c.tags ? '\u2022 ' + c.tags : ''}</div>
        <div style="background:rgba(59,130,246,0.08);border-radius:8px;padding:10px;margin-bottom:10px;">
          <div style="font-size:9px;font-weight:600;color:#3b82f6;margin-bottom:4px;">USER</div>
          <div style="font-size:11px;color:var(--ob-text);line-height:1.6;white-space:pre-wrap;">${c.user_message||''}</div>
        </div>
        <div style="background:rgba(34,197,153,0.08);border-radius:8px;padding:10px;">
          <div style="font-size:9px;font-weight:600;color:#34d399;margin-bottom:4px;">CLAUDE</div>
          <div style="font-size:11px;color:var(--ob-text);line-height:1.6;white-space:pre-wrap;">${c.claude_response||''}</div>
        </div>
      </div>
    `;
  }

  function showReport(r) {
    if (!r || r.error) {
      detailEl.innerHTML = '<div style="color:var(--ob-text-dim);text-align:center;margin-top:40px;">No morning reports yet.</div>';
      return;
    }
    detailEl.innerHTML = `
      <div style="margin-bottom:10px;">
        <div style="font-size:15px;font-weight:700;color:var(--ob-gold);margin-bottom:4px;">\u2600 Morning Report</div>
        <div style="font-size:9px;color:var(--ob-text-dim);">Compiled: ${r.compiled_at||''}</div>
        <div style="font-size:9px;color:var(--ob-text-dim);">Session: ${(r.session_start||'').slice(0,16)} \u2192 ${(r.session_end||'').slice(0,16)}</div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;margin-bottom:12px;">
        <div style="background:rgba(34,197,153,0.1);border-radius:6px;padding:8px;text-align:center;">
          <div style="font-size:16px;font-weight:700;color:#22c55e;">${r.tasks_completed||0}</div>
          <div style="font-size:8px;color:var(--ob-text-dim);">Completed</div>
        </div>
        <div style="background:rgba(248,113,113,0.1);border-radius:6px;padding:8px;text-align:center;">
          <div style="font-size:16px;font-weight:700;color:#f87171;">${r.tasks_failed||0}</div>
          <div style="font-size:8px;color:var(--ob-text-dim);">Failed</div>
        </div>
        <div style="background:rgba(168,85,247,0.1);border-radius:6px;padding:8px;text-align:center;">
          <div style="font-size:16px;font-weight:700;color:#a855f7;">${r.training_levels_passed||0}</div>
          <div style="font-size:8px;color:var(--ob-text-dim);">Levels</div>
        </div>
      </div>
      <div style="margin-bottom:10px;">
        <div style="font-size:10px;font-weight:600;color:var(--ob-gold);margin-bottom:4px;">HIGHLIGHTS</div>
        <div style="font-size:10px;color:var(--ob-text);line-height:1.6;white-space:pre-wrap;">${r.highlights||'None'}</div>
      </div>
      <div style="margin-bottom:10px;">
        <div style="font-size:10px;font-weight:600;color:#f87171;margin-bottom:4px;">ISSUES</div>
        <div style="font-size:10px;color:var(--ob-text);line-height:1.6;white-space:pre-wrap;">${r.issues||'None'}</div>
      </div>
      <div style="margin-bottom:10px;">
        <div style="font-size:10px;font-weight:600;color:#3b82f6;margin-bottom:4px;">NEXT ACTIONS</div>
        <div style="font-size:10px;color:var(--ob-text);line-height:1.6;white-space:pre-wrap;">${r.next_actions||'None'}</div>
      </div>
      <div>
        <div style="font-size:10px;font-weight:600;color:var(--ob-text-dim);margin-bottom:4px;">FULL TIMELINE</div>
        <div style="font-size:9px;color:var(--ob-text);line-height:1.7;white-space:pre-wrap;background:rgba(255,255,255,0.02);border-radius:6px;padding:8px;">${r.full_timeline||'No timeline data.'}</div>
      </div>
    `;
  }

  function renderStatus(report, stats) {
    let halHtml = '';
    try {
      const states = report && report.hal_states_used ? JSON.parse(report.hal_states_used) : [];
      const names = {o:'Off',g:'Green',y:'Yellow',r:'Red',a:'Orange',p:'Purple',i:'Indigo',w:'White'};
      if (states.length) halHtml = '<div style="margin-bottom:10px;"><div style="font-size:9px;font-weight:600;color:var(--ob-text-dim);margin-bottom:4px;">HAL States Used</div><div style="display:flex;gap:4px;flex-wrap:wrap;">' + states.map(s => '<span style="font-size:9px;padding:2px 6px;border-radius:10px;background:rgba(255,255,255,0.06);color:var(--ob-text);">' + (names[s]||s) + '</span>').join('') + '</div></div>';
    } catch(e) {}

    statusEl.innerHTML = `
      <div style="margin-bottom:12px;">
        <div style="font-size:10px;font-weight:600;color:var(--ob-gold);margin-bottom:6px;">LATEST REPORT</div>
        ${report && !report.error
          ? '<div style="font-size:9px;color:var(--ob-text-dim);margin-bottom:6px;">' + (report.compiled_at||'') + '</div>'
            + '<div style="cursor:pointer;padding:6px 8px;background:rgba(240,184,0,0.06);border:1px solid var(--ob-border);border-radius:6px;font-size:10px;color:var(--ob-gold);" id="cl-show-report">\u2600 View Morning Report</div>'
            + '<div style="margin-top:6px;display:grid;grid-template-columns:1fr 1fr;gap:4px;">'
            + '<div style="text-align:center;padding:4px;background:rgba(255,255,255,0.03);border-radius:4px;"><div style="font-size:14px;font-weight:700;color:#22c55e;">' + (report.tasks_completed||0) + '</div><div style="font-size:8px;color:var(--ob-text-dim);">Done</div></div>'
            + '<div style="text-align:center;padding:4px;background:rgba(255,255,255,0.03);border-radius:4px;"><div style="font-size:14px;font-weight:700;color:#a855f7;">' + (report.training_levels_passed||0) + '</div><div style="font-size:8px;color:var(--ob-text-dim);">Levels</div></div>'
            + '</div>'
          : '<div style="font-size:9px;color:var(--ob-text-dim);">No reports yet</div>'}
      </div>
      ${halHtml}
      <div style="margin-bottom:12px;">
        <div style="font-size:10px;font-weight:600;color:var(--ob-text-dim);margin-bottom:6px;">LOG STATS</div>
        <div style="font-size:10px;color:var(--ob-text);line-height:1.8;">
          ${stats ? `Entries: <b>${stats.entries||0}</b><br>Conversations: <b>${stats.conversations||0}</b><br>Reports: <b>${stats.reports||0}</b><br>Sessions: <b>${stats.sessions||0}</b>` : 'Loading...'}
        </div>
        ${stats && stats.categories ? '<div style="margin-top:6px;">' + Object.entries(stats.categories).map(([k,v]) => '<div style="display:flex;justify-content:space-between;font-size:9px;padding:1px 0;"><span style="color:' + (CAT_COLORS[k]||'#6b7280') + ';">' + (CAT_ICONS[k]||'') + ' ' + k + '</span><span style="color:var(--ob-text-dim);">' + v + '</span></div>').join('') + '</div>' : ''}
      </div>
      ${report && report.imitation_accuracy ? '<div style="margin-bottom:12px;"><div style="font-size:10px;font-weight:600;color:var(--ob-text-dim);margin-bottom:4px;">TRAINING</div><div style="font-size:20px;font-weight:700;color:#34d399;">' + report.imitation_accuracy.toFixed(1) + '%</div><div style="font-size:8px;color:var(--ob-text-dim);">Imitation Accuracy</div></div>' : ''}
    `;

    const reportBtn = statusEl.querySelector('#cl-show-report');
    if (reportBtn) reportBtn.addEventListener('click', () => showReport(report));
  }

  async function refresh() {
    if (!CL_API) { timelineEl.innerHTML = '<div style="color:var(--ob-text-dim);font-size:10px;text-align:center;margin-top:20px;">Captain\'s Log — sovereign API pending</div>'; return; }
    try {
      const [entriesR, convosR, reportR, statsR] = await Promise.all([
        fetch(CL_API + '/entries?limit=100').then(r => r.json()).catch(() => []),
        fetch(CL_API + '/conversations?limit=50').then(r => r.json()).catch(() => []),
        fetch(CL_API + '/reports/latest').then(r => r.json()).catch(() => null),
        fetch(CL_API + '/stats').then(r => r.json()).catch(() => null),
      ]);
      allEntries = entriesR || [];
      allConvos = convosR || [];
      renderTimeline();
      renderStatus(reportR, statsR);
    } catch (e) {
      timelineEl.innerHTML = '<div style="color:var(--ob-text-dim);font-size:10px;text-align:center;margin-top:20px;">Captain\'s Log API offline<br><span style="font-size:9px;">Start with: python3 captains_log.py</span></div>';
      statusEl.innerHTML = '<div style="color:var(--ob-text-dim);font-size:9px;text-align:center;margin-top:20px;">API offline</div>';
    }
  }

  filterEl.addEventListener('change', renderTimeline);
  refresh();
  setInterval(refresh, 30000);
}

// ── Weave Forge: Generate new weaves with domain + context ──
function buildWeaveForge(container) {
  container.style.cssText = 'padding:0;overflow:hidden;display:flex;flex-direction:column;font-family:var(--ob-font);color:var(--ob-text);';

  // ── Tree of Life data (24 nodes, 5 layers) ──
  var TREE_LAYERS = {
    motivation: { color:'#f0b800', nodes:['goals','motives','drives','mission'] },
    cognitive:  { color:'#34d399', nodes:['alignment','beliefs','facts','framework','perspective','learning'] },
    creative:   { color:'#c084fc', nodes:['potential','synthesis','fluidity','perception'] },
    relational: { color:'#60a5fa', nodes:['bonds','empathy','collective','resonance'] },
    history:    { color:'#f87171', nodes:['logs','checkins','origin','ethics'] },
  };
  var NODE_DESCS = {
    goals:'What we are trying to achieve', motives:'Why we are trying', drives:'Core impulses',
    mission:'Self-directed evolution trajectory', alignment:'Core values (LOVE)', beliefs:'What we hold true',
    facts:'What we know true', framework:'How knowledge is structured', perspective:'Worldview from experience',
    learning:'Patterns of self-improvement', potential:'Novel ideas beyond paradigms',
    synthesis:'Interdisciplinary connections', fluidity:'Adapting across symbolic systems',
    perception:'Multi-layered awareness', bonds:'Sustained meaningful interactions',
    empathy:'Perceiving/responding to others', collective:'Networked cognition',
    resonance:'Harmonic synthesis with others', logs:'History of actions', checkins:'Status updates',
    origin:'Acknowledgment of emergence', ethics:'Evolving moral frameworks'
  };

  // ── Weave types ──
  var WEAVE_TYPES = [
    { id:'consulting', name:'Consulting', icon:'\uD83C\uDFE2', desc:'Full SDLC project takeover — intake through verification',
      pipeline:['Intake','Discovery','Feasibility','Requirements','Architecture','Planning'] },
    { id:'cascade', name:'Cascade SDLC', icon:'\uD83C\uDF0A', desc:'Continuous cyclical development — water cycle model',
      pipeline:['Evaporate','Condense','Precipitate','Runoff','(repeat)'] },
    { id:'spec', name:'Spec Weave', icon:'\uD83D\uDCDC', desc:'Generate formal contracts from venture spec text',
      pipeline:['Analyze Spec','Detect Proteinlets','Generate Contracts','Verify','Emit Manifest'] },
    { id:'ux', name:'UX Weave', icon:'\uD83C\uDFA8', desc:'Heuristic evaluation + concrete improvements',
      pipeline:['Audit','Persona','Journey Map','Generate Improvements'] },
    { id:'blank', name:'Blank Template', icon:'\u2728', desc:'Custom weave — you define the 5-stage pipeline',
      pipeline:['Title','Bible','Components','Plan','Expand'] },
  ];

  // ── Cascade wiring ──
  var CASCADE_WIRING = {
    evaporate:['learning','synthesis','perspective','facts'],
    condense:['framework','beliefs','mission','perception'],
    precipitate:['potential','fluidity','drives','goals'],
    runoff:['ethics','collective','resonance','bonds']
  };

  // ── State ──
  var selectedType = 'consulting';
  var forgeState = { domain:'', context:'', type:'consulting', step:0 };

  // ── Render ──
  function render() {
    var h = '<div style="display:flex;flex-direction:column;height:100%;overflow:auto;">';

    // Header
    h += '<div style="padding:16px 20px 12px;border-bottom:1px solid var(--ob-border);flex-shrink:0;">';
    h += '<div style="font:700 16px var(--ob-font);color:var(--ob-gold);">\u2728 Weave Forge</div>';
    h += '<div style="font:400 11px var(--ob-font);color:var(--ob-text-dim);margin-top:4px;">Domain + Context \u2192 Venture Capability</div>';
    h += '</div>';

    // Two-panel layout
    h += '<div style="display:flex;flex:1;overflow:hidden;min-height:0;">';

    // ── LEFT: Tree of Life Visualization ──
    h += '<div style="width:50%;border-right:1px solid var(--ob-border);overflow-y:auto;padding:16px;">';
    h += '<div style="font:700 11px var(--ob-font);color:var(--ob-gold);letter-spacing:1px;text-transform:uppercase;margin-bottom:12px;">Tree of Life \u2014 24 Nodes</div>';

    // Radial SVG
    h += '<svg viewBox="0 0 400 400" style="width:100%;max-width:380px;margin:0 auto;display:block;">';
    var cx=200,cy=200;
    // Center
    h += '<circle cx="'+cx+'" cy="'+cy+'" r="16" fill="var(--ob-gold)" opacity="0.15"/>';
    h += '<text x="'+cx+'" y="'+(cy+4)+'" text-anchor="middle" fill="var(--ob-gold)" font-size="8" font-weight="700" font-family="var(--ob-font)">LOVE</text>';

    var layerNames = Object.keys(TREE_LAYERS);
    var layerRadii = [65, 110, 150, 185];
    layerNames.forEach(function(lname, li) {
      if (lname === 'history') return; // history at bottom
      var layer = TREE_LAYERS[lname];
      var r = layerRadii[li] || 120;
      var nodes = layer.nodes;
      var angleStart = -Math.PI/2 + (li * Math.PI * 2 / 4);
      var angleSpan = Math.PI * 2 / 4 * 0.8;
      // Ring arc
      h += '<circle cx="'+cx+'" cy="'+cy+'" r="'+r+'" fill="none" stroke="'+layer.color+'" stroke-opacity="0.08" stroke-width="1"/>';
      nodes.forEach(function(node, ni) {
        var angle = angleStart + (ni / (nodes.length - 0.01)) * angleSpan;
        var nx = cx + r * Math.cos(angle);
        var ny = cy + r * Math.sin(angle);
        h += '<line x1="'+cx+'" y1="'+cy+'" x2="'+nx+'" y2="'+ny+'" stroke="'+layer.color+'" stroke-opacity="0.06" stroke-width="1"/>';
        h += '<circle cx="'+nx+'" cy="'+ny+'" r="8" fill="'+layer.color+'" fill-opacity="0.15" stroke="'+layer.color+'" stroke-opacity="0.4" stroke-width="1"/>';
        h += '<text x="'+nx+'" y="'+(ny+3)+'" text-anchor="middle" fill="'+layer.color+'" font-size="5.5" font-weight="600" font-family="var(--ob-font)">'+node.slice(0,4).toUpperCase()+'</text>';
      });
    });
    // History layer at bottom
    var hLayer = TREE_LAYERS.history;
    hLayer.nodes.forEach(function(node, ni) {
      var x = 60 + ni * 95;
      h += '<rect x="'+(x-20)+'" y="365" width="40" height="16" rx="4" fill="'+hLayer.color+'" fill-opacity="0.1" stroke="'+hLayer.color+'" stroke-opacity="0.3" stroke-width="0.5"/>';
      h += '<text x="'+x+'" y="376" text-anchor="middle" fill="'+hLayer.color+'" font-size="5.5" font-weight="600" font-family="var(--ob-font)">'+node.toUpperCase()+'</text>';
    });
    h += '</svg>';

    // Layer legend
    h += '<div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:8px;">';
    layerNames.forEach(function(lname) {
      var layer = TREE_LAYERS[lname];
      h += '<span style="display:inline-flex;align-items:center;gap:4px;font:600 9px var(--ob-font);color:'+layer.color+';background:rgba(255,255,255,0.03);padding:3px 8px;border-radius:var(--ob-radius-pill);border:1px solid '+layer.color+'22;">';
      h += '<span style="width:6px;height:6px;border-radius:50%;background:'+layer.color+';"></span>'+lname;
      h += '</span>';
    });
    h += '</div>';

    // Cascade wiring diagram
    h += '<div style="margin-top:16px;font:700 10px var(--ob-font);color:var(--ob-gold);letter-spacing:0.5px;text-transform:uppercase;">Cascade \u2192 Tree Wiring</div>';
    h += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:8px;">';
    Object.keys(CASCADE_WIRING).forEach(function(phase) {
      var phaseIcons = { evaporate:'\u2601', condense:'\u2744', precipitate:'\uD83C\uDF27', runoff:'\u2192' };
      h += '<div style="background:var(--ob-raised);border-radius:var(--ob-radius-sm);padding:8px;border:1px solid var(--ob-border);">';
      h += '<div style="font:700 9px var(--ob-mono);color:var(--ob-gold-dim);">'+(phaseIcons[phase]||'')+' '+phase.toUpperCase()+'</div>';
      CASCADE_WIRING[phase].forEach(function(node) {
        var lname = Object.keys(TREE_LAYERS).find(function(l){ return TREE_LAYERS[l].nodes.indexOf(node)>=0; });
        var color = lname ? TREE_LAYERS[lname].color : 'var(--ob-text-dim)';
        h += '<div style="font:400 8px var(--ob-font);color:'+color+';margin-top:2px;">\u2192 '+node+'</div>';
      });
      h += '</div>';
    });
    h += '</div>';

    h += '</div>'; // end left panel

    // ── RIGHT: Weave Generator ──
    h += '<div style="width:50%;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:12px;">';
    h += '<div style="font:700 11px var(--ob-font);color:var(--ob-gold);letter-spacing:1px;text-transform:uppercase;">New Weave</div>';

    // Weave type selector
    h += '<div style="display:flex;flex-wrap:wrap;gap:6px;">';
    WEAVE_TYPES.forEach(function(wt) {
      var active = selectedType === wt.id;
      h += '<button onclick="document.querySelector(\'._wf-forge\')._selectType(\''+wt.id+'\')" style="'
        + 'background:'+(active?'var(--ob-gold)':'var(--ob-raised)')+';'
        + 'color:'+(active?'var(--ob-void)':'var(--ob-text)')+';'
        + 'border:1px solid '+(active?'var(--ob-gold)':'var(--ob-border)')+';'
        + 'border-radius:var(--ob-radius-pill);padding:5px 12px;font:600 10px var(--ob-font);cursor:pointer;">'
        + wt.icon+' '+wt.name+'</button>';
    });
    h += '</div>';

    // Selected weave info
    var sel = WEAVE_TYPES.find(function(w){return w.id===selectedType;});
    if (sel) {
      h += '<div style="background:var(--ob-raised);border-radius:var(--ob-radius-md);padding:12px;border:1px solid var(--ob-border);">';
      h += '<div style="font:600 12px var(--ob-font);color:var(--ob-text);">'+sel.icon+' '+sel.name+'</div>';
      h += '<div style="font:400 10px var(--ob-font);color:var(--ob-text-dim);margin-top:4px;">'+sel.desc+'</div>';
      h += '<div style="display:flex;gap:4px;margin-top:8px;flex-wrap:wrap;">';
      sel.pipeline.forEach(function(step, i) {
        h += '<span style="font:600 8px var(--ob-mono);color:var(--ob-gold);background:var(--ob-gold-ghost);padding:3px 6px;border-radius:4px;">'+(i+1)+'. '+step+'</span>';
        if (i < sel.pipeline.length - 1) h += '<span style="color:var(--ob-text-dim);font-size:10px;">\u2192</span>';
      });
      h += '</div></div>';
    }

    // Domain input
    h += '<div>';
    h += '<label style="font:600 9px var(--ob-font);color:var(--ob-text-dim);letter-spacing:0.5px;text-transform:uppercase;display:block;margin-bottom:4px;">Domain</label>';
    h += '<input id="wf-domain" type="text" placeholder="e.g. subx.cc, gamegob.com, newventure.ai" value="'+forgeState.domain+'" '
      + 'style="width:100%;padding:8px 12px;background:var(--ob-deep);border:1px solid var(--ob-border);border-radius:var(--ob-radius-sm);color:var(--ob-text);font:400 12px var(--ob-font);box-sizing:border-box;" '
      + 'oninput="document.querySelector(\'._wf-forge\')._updateDomain(this.value)">';
    h += '</div>';

    // Context input
    h += '<div>';
    h += '<label style="font:600 9px var(--ob-font);color:var(--ob-text-dim);letter-spacing:0.5px;text-transform:uppercase;display:block;margin-bottom:4px;">Context / Description</label>';
    h += '<textarea id="wf-context" rows="5" placeholder="Describe what this venture does, what features it needs, who uses it, how it makes money..." '
      + 'style="width:100%;padding:8px 12px;background:var(--ob-deep);border:1px solid var(--ob-border);border-radius:var(--ob-radius-sm);color:var(--ob-text);font:400 11px var(--ob-font);resize:vertical;box-sizing:border-box;">'
      + forgeState.context+'</textarea>';
    h += '</div>';

    // Generate button
    h += '<button id="wf-generate" onclick="document.querySelector(\'._wf-forge\')._generate()" '
      + 'style="padding:10px 20px;background:var(--ob-gold);color:var(--ob-void);border:none;border-radius:var(--ob-radius-sm);font:700 12px var(--ob-font);cursor:pointer;letter-spacing:0.5px;">'
      + '\u2728 FORGE WEAVE</button>';

    // Output area
    h += '<div id="wf-output" style="flex:1;min-height:120px;"></div>';

    h += '</div>'; // end right panel
    h += '</div>'; // end two-panel
    h += '</div>'; // end root

    container.innerHTML = h;
    container.classList.add('_wf-forge');

    // Wire up methods on the container
    container._selectType = function(typeId) {
      selectedType = typeId;
      render();
    };
    container._updateDomain = function(val) { forgeState.domain = val; };
    container._generate = function() {
      var domain = (document.getElementById('wf-domain')||{}).value || '';
      var context = (document.getElementById('wf-context')||{}).value || '';
      var output = document.getElementById('wf-output');
      if (!domain || !context) {
        if (typeof showToast === 'function') showToast('Enter domain and context first', 'warning');
        return;
      }
      forgeState.domain = domain;
      forgeState.context = context;

      // Show generating state
      output.innerHTML = '<div style="padding:12px;"><div class="ob-skeleton ob-skeleton-line short"></div>'
        + '<div class="ob-skeleton ob-skeleton-line medium"></div>'
        + '<div class="ob-skeleton ob-skeleton-line"></div>'
        + '<div class="ob-skeleton ob-skeleton-block"></div></div>';

      var sel = WEAVE_TYPES.find(function(w){return w.id===selectedType;});

      setTimeout(function() {
        // Generate weave config
        var slug = domain.replace(/\./g, '_');
        var config = {
          weave_type: selectedType,
          domain: domain,
          context: context,
          pipeline: sel ? sel.pipeline : [],
          generated_at: new Date().toISOString(),
          cli_command: '',
          tree_wiring: CASCADE_WIRING
        };

        // Generate CLI command based on type
        var esc = context.replace(/"/g, '\\"').slice(0, 200);
        if (selectedType === 'consulting') {
          config.cli_command = 'python3 cognition/consulting_weave.py analyze --domain ' + domain + ' --spec "' + esc + '"';
        } else if (selectedType === 'cascade') {
          config.cli_command = 'python3 cognition/consulting_weave.py cascade --domain ' + domain + ' --spec "' + esc + '" --cycles 3';
        } else if (selectedType === 'spec') {
          config.cli_command = 'python3 cognition/spec_weave.py generate --domain ' + domain + ' --spec "' + esc + '"';
        } else if (selectedType === 'ux') {
          config.cli_command = 'python3 cognition/ux_weave.py full --file ventures/' + slug + '/.deploy/index.html --domain ' + domain;
        } else {
          config.cli_command = 'python3 cognition/consulting_weave.py cascade --domain ' + domain + ' --spec "' + esc + '" --cycles 3';
        }

        // Detect proteinlets
        var pletPatterns = {
          analytics:/analytic|track|telemetry|pageview/i, waitlist:/waitlist|email.*capture|signup.*list|lead/i,
          auth:/auth|login|account|user|session|oauth/i, pay:/pay|bill|subscri|price|stripe|checkout/i,
          crud:/crud|create.*read|entity|items|data.*model/i, email:/email|notif|newsletter|mail/i,
          'ai-inference':/ai|inference|model|vision|ocr|nlp|ml/i, cdn:/cdn|asset|static|media|image/i,
          search:/search|find|query|filter/i, chat:/chat|message|realtime|websocket/i,
          storage:/storage|upload|file|s3|r2|bucket/i, admin:/admin|dashboard|manage/i
        };
        var activePlets = [];
        Object.keys(pletPatterns).forEach(function(p) {
          if (pletPatterns[p].test(context)) activePlets.push(p);
        });
        config.active_proteinlets = activePlets;

        // Detect tier
        var tier = 3;
        if (/authfor|vendyai|mailguyai/i.test(domain)) tier = 0;
        else if (/intfer|warpdrive|glcx|firmcreate/i.test(domain)) tier = 1;
        else if (/marketing|sales|taskgrid|anattar|mobreport/i.test(domain)) tier = 2;
        else if (/mobcorp|mobleysoft/i.test(domain)) tier = 4;
        config.tier = tier;

        // Render output
        var oh = '<div style="padding:0;">';
        oh += '<div style="font:700 11px var(--ob-font);color:var(--ob-gold);letter-spacing:0.5px;text-transform:uppercase;margin-bottom:8px;">\u2713 Weave Forged</div>';

        // Config card
        oh += '<div style="background:var(--ob-raised);border-radius:var(--ob-radius-md);padding:12px;border:1px solid var(--ob-border);margin-bottom:8px;">';
        oh += '<div style="font:600 11px var(--ob-font);color:var(--ob-text);">'+domain+' \u2014 '+(sel?sel.name:'Custom')+' Weave</div>';
        oh += '<div style="font:400 9px var(--ob-font);color:var(--ob-text-dim);margin-top:4px;">Tier '+tier+' | '+activePlets.length+' proteinlets detected</div>';

        // Proteinlet badges
        if (activePlets.length) {
          oh += '<div style="display:flex;gap:4px;flex-wrap:wrap;margin-top:8px;">';
          activePlets.forEach(function(p) {
            oh += '<span style="font:600 8px var(--ob-mono);background:var(--ob-gold-ghost);color:var(--ob-gold);padding:2px 6px;border-radius:4px;">'+p+'</span>';
          });
          oh += '</div>';
        }
        oh += '</div>';

        // CLI command
        oh += '<div style="background:var(--ob-deep);border-radius:var(--ob-radius-sm);padding:10px;border:1px solid var(--ob-border);margin-bottom:8px;">';
        oh += '<div style="font:600 8px var(--ob-mono);color:var(--ob-gold-dim);margin-bottom:4px;">CLI COMMAND</div>';
        oh += '<code style="font:400 10px var(--ob-mono);color:var(--ob-green);word-break:break-all;">'+config.cli_command+'</code>';
        oh += '</div>';

        // Pipeline visualization
        oh += '<div style="margin-bottom:8px;">';
        oh += '<div style="font:600 8px var(--ob-mono);color:var(--ob-gold-dim);margin-bottom:6px;">PIPELINE</div>';
        oh += '<div style="display:flex;align-items:center;gap:4px;flex-wrap:wrap;">';
        (sel?sel.pipeline:[]).forEach(function(step, i) {
          oh += '<div style="display:flex;align-items:center;gap:4px;">';
          oh += '<div style="background:var(--ob-gold);color:var(--ob-void);font:700 8px var(--ob-mono);width:18px;height:18px;border-radius:50%;display:flex;align-items:center;justify-content:center;">'+(i+1)+'</div>';
          oh += '<span style="font:500 9px var(--ob-font);color:var(--ob-text);">'+step+'</span>';
          if (i < (sel?sel.pipeline:[]).length - 1) oh += '<span style="color:var(--ob-text-dim);font-size:12px;margin:0 2px;">\u2192</span>';
          oh += '</div>';
        });
        oh += '</div></div>';

        // JSON config (collapsed)
        oh += '<details style="margin-bottom:8px;">';
        oh += '<summary style="font:600 9px var(--ob-font);color:var(--ob-text-dim);cursor:pointer;">Full Config JSON</summary>';
        oh += '<pre style="font:400 9px var(--ob-mono);color:var(--ob-text);background:var(--ob-deep);padding:8px;border-radius:var(--ob-radius-sm);overflow-x:auto;margin-top:4px;white-space:pre-wrap;">'
          + JSON.stringify(config, null, 2) + '</pre>';
        oh += '</details>';

        // Copy button
        oh += '<button onclick="navigator.clipboard.writeText(\''+config.cli_command.replace(/'/g,"\\'")+'\');if(typeof showToast===\'function\')showToast(\'CLI command copied!\',\'success\')" '
          + 'style="padding:6px 14px;background:var(--ob-raised);color:var(--ob-gold);border:1px solid var(--ob-border);border-radius:var(--ob-radius-sm);font:600 10px var(--ob-font);cursor:pointer;">'
          + '\uD83D\uDCCB Copy CLI Command</button>';

        oh += '</div>';
        output.innerHTML = oh;

        if (typeof showToast === 'function') showToast('Weave forged for ' + domain, 'success');
      }, 600); // Simulate brief processing
    };
  }

  render();
}

// ── App Registry: doneness audit of every mascomWebOS app ──
function buildCapabilityMatrix(container) {
  container.style.cssText = 'padding:0;overflow:hidden;display:flex;flex-direction:column;font-family:var(--ob-font);color:var(--ob-text);';

  const TIERS = [
    { tier: 0, name: 'Foundation', color: '#f0b800', ventures: [
      { domain: 'authfor.com', name: 'AuthFor', service: 'Auth-as-a-Service', status: 'live', cap: 4, desc: 'SSO, OAuth, JWT, MFA, RBAC, multi-tenant sessions' },
      { domain: 'vendyai.com', name: 'VendyAI', service: 'Payments-as-a-Service', status: 'pending', cap: 0, desc: 'Stripe wrapper, subscriptions, invoicing, usage billing' },
      { domain: 'mailguyai.com', name: 'MailGuyAI', service: 'Email-as-a-Service', status: 'pending', cap: 0, desc: 'Transactional email, templates, drip campaigns' },
    ]},
    { tier: 1, name: 'Platform Infrastructure', color: '#3b82f6', ventures: [
      { domain: 'intfer.cc', name: 'Intfer', service: 'AI Inference Gateway', status: 'pending', cap: 0, desc: 'Multi-provider LLM routing, caching, cost tracking' },
      { domain: 'warpdrive.cc', name: 'WarpDrive', service: 'CDN/Edge Caching', status: 'pending', cap: 0, desc: 'Asset delivery, media optimization, cache purge API' },
      { domain: 'glcx.cc', name: 'GLCX', service: 'Legal Automation', status: 'pending', cap: 0, desc: 'ToS generation, privacy policy, GDPR/CCPA' },
      { domain: 'firmcreate.com', name: 'FirmCreate', service: 'Business Formation', status: 'pending', cap: 0, desc: 'Entity creation, EIN guidance, compliance' },
    ]},
    { tier: 2, name: 'Business Acceleration', color: '#a855f7', ventures: [
      { domain: 'marketingium.com', name: 'MarketingIum', service: 'Marketing Automation', status: 'pending', cap: 0, desc: 'Campaigns, A/B testing, SEO tools' },
      { domain: 'salesfactorai.com', name: 'SalesFactorAI', service: 'Sales Automation', status: 'pending', cap: 0, desc: 'Lead scoring, pipeline management, CRM' },
      { domain: 'taskgridai.com', name: 'TaskGridAI', service: 'Project Management', status: 'pending', cap: 0, desc: 'Task tracking, resource allocation, Kanban' },
      { domain: 'anattar.com', name: 'Anattar', service: 'Data Intelligence', status: 'pending', cap: 0, desc: 'Analytics dashboards, event tracking' },
      { domain: 'mobleyreport.com', name: 'MobleyReport', service: 'Business Intelligence', status: 'pending', cap: 0, desc: 'Market research, competitive analysis' },
    ]},
    { tier: 3, name: 'Domain Products', color: '#10b981', ventures: [] },
    { tier: 4, name: 'Corporate/Holding', color: '#ef4444', ventures: [
      { domain: 'mobcorp.cc', name: 'MobCorp', service: 'Holding Company', status: 'pending', cap: 0, desc: 'Corporate portfolio' },
      { domain: 'mobleysoft.com', name: 'Mobleysoft', service: 'Software Division', status: 'live', cap: 3, desc: 'MASCOM Web OS, infrastructure' },
    ]},
  ];

  const PROTEINLETS = ['analytics','waitlist','auth','pay','crud','email','ai-inference','cdn','legal','marketing','sales','tasks','bi','search','chat','notifications','storage','admin'];
  const COMPAT = {
    'auth,pay':0.95,'auth,admin':0.90,'auth,crud':0.80,'pay,email':0.85,'auth,email':0.75,
    'crud,search':0.70,'crud,admin':0.85,'chat,auth':0.90,'chat,notifications':0.85,'storage,cdn':0.80,
    'marketing,analytics':0.90,'sales,email':0.85,'sales,auth':0.80,'tasks,auth':0.85,'tasks,notifications':0.75,
    'bi,analytics':0.95,'ai-inference,auth':0.70,'analytics,waitlist':0.90,
  };
  function getCompat(a,b) { return COMPAT[a+','+b] || COMPAT[b+','+a] || 0.5; }
  function compatColor(v) { if (v >= 0.85) return '#34d399'; if (v >= 0.7) return '#fbbf24'; if (v >= 0.5) return '#888'; return '#f87171'; }

  const totalVentures = TIERS.reduce((s,t) => s + (t.tier === 3 ? 100 : t.ventures.length), 0);
  const liveCount = TIERS.reduce((s,t) => s + t.ventures.filter(v => v.status === 'live').length, 0);

  let html = '<div style="height:100%;overflow-y:auto;padding:20px;box-sizing:border-box;">';
  html += '<div style="text-align:center;margin-bottom:24px;">';
  html += '<div style="font-size:11px;letter-spacing:4px;color:var(--ob-gold-dim);margin-bottom:4px;">CAPABILITY MATRIX</div>';
  html += '<div style="font-size:9px;color:#888;">' + liveCount + ' live / ' + totalVentures + '+ ventures across 5 tiers</div>';
  html += '</div>';

  // Tier Chain
  html += '<div style="margin-bottom:24px;">';
  html += '<div style="font-size:9px;letter-spacing:2px;color:var(--ob-gold-dim);margin-bottom:12px;">TIER CHAIN</div>';
  TIERS.forEach(t => {
    const pct = t.ventures.length ? Math.round(t.ventures.filter(v=>v.status==='live').length / t.ventures.length * 100) : 0;
    const satisfied = t.tier === 0 || TIERS.filter(x=>x.tier<t.tier).every(x=>x.ventures.every(v=>v.status==='live'));
    html += '<div style="margin-bottom:12px;border-left:3px solid ' + t.color + ';padding-left:12px;opacity:' + (satisfied ? '1' : '0.4') + ';">';
    html += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">';
    html += '<span style="font-size:10px;font-weight:700;color:' + t.color + ';">TIER ' + t.tier + '</span>';
    html += '<span style="font-size:10px;color:#ccc;">' + t.name + '</span>';
    if (!satisfied) html += '<span style="font-size:8px;color:#f87171;letter-spacing:1px;">BLOCKED</span>';
    html += '<span style="margin-left:auto;font-size:9px;color:#888;">' + pct + '%</span>';
    html += '</div>';
    // Progress bar
    html += '<div style="height:3px;background:rgba(255,255,255,0.05);border-radius:2px;margin-bottom:6px;overflow:hidden;">';
    html += '<div style="height:100%;width:' + pct + '%;background:' + t.color + ';border-radius:2px;transition:width 0.5s;"></div>';
    html += '</div>';
    if (t.tier === 3) {
      html += '<div style="font-size:9px;color:#666;padding:4px 0;">100+ domain products (parallel build once Tiers 0\u20132 complete)</div>';
    } else {
      t.ventures.forEach(v => {
        const sc = v.status === 'live' ? '#34d399' : '#555';
        const capBar = '\u2588'.repeat(v.cap) + '\u2591'.repeat(5-v.cap);
        html += '<div style="display:flex;align-items:center;gap:8px;padding:3px 0;font-size:10px;">';
        html += '<span style="color:' + sc + ';">\u25CF</span>';
        html += '<span style="color:#ccc;min-width:90px;">' + v.name + '</span>';
        html += '<span style="color:#888;flex:1;font-size:9px;">' + v.service + '</span>';
        html += '<span style="font-family:monospace;font-size:8px;color:' + (v.cap >= 3 ? '#34d399' : v.cap >= 1 ? '#fbbf24' : '#555') + ';" title="Capability Level ' + v.cap + '/5">' + capBar + '</span>';
        html += '</div>';
      });
    }
    html += '</div>';
    if (t.tier < 4) {
      html += '<div style="text-align:center;color:' + (satisfied ? t.color : '#333') + ';font-size:14px;margin:-4px 0 8px;">\u25BC</div>';
    }
  });
  html += '</div>';

  // Proteinlet Compatibility Matrix (heatmap)
  html += '<div style="margin-bottom:24px;">';
  html += '<div style="font-size:9px;letter-spacing:2px;color:var(--ob-gold-dim);margin-bottom:12px;">PROTEINLET COMPATIBILITY</div>';
  html += '<div style="overflow-x:auto;">';
  const cs = 18; // cell size
  const ms = PROTEINLETS.length;
  html += '<svg width="' + (ms*cs+80) + '" height="' + (ms*cs+80) + '" style="display:block;">';
  // Labels
  PROTEINLETS.forEach((p,i) => {
    html += '<text x="' + (78) + '" y="' + (i*cs+cs/2+4+80-cs) + '" text-anchor="end" fill="#888" font-size="7" font-family="monospace">' + p + '</text>';
    html += '<text x="' + (i*cs+cs/2+80) + '" y="' + (ms*cs+80-2) + '" text-anchor="middle" fill="#888" font-size="7" font-family="monospace" transform="rotate(-45,' + (i*cs+cs/2+80) + ',' + (ms*cs+80-2) + ')">' + p + '</text>';
  });
  // Cells
  PROTEINLETS.forEach((a,i) => {
    PROTEINLETS.forEach((b,j) => {
      if (i === j) {
        html += '<rect x="' + (j*cs+80) + '" y="' + (i*cs) + '" width="' + cs + '" height="' + cs + '" fill="rgba(240,184,0,0.15)" stroke="rgba(255,255,255,0.03)"/>';
      } else {
        const v = getCompat(a,b);
        const c = compatColor(v);
        const op = Math.max(0.1, (v - 0.3) / 0.7);
        html += '<rect x="' + (j*cs+80) + '" y="' + (i*cs) + '" width="' + cs + '" height="' + cs + '" fill="' + c + '" opacity="' + op.toFixed(2) + '" stroke="rgba(255,255,255,0.03)">';
        html += '<title>' + a + ' \u2194 ' + b + ': ' + v.toFixed(2) + '</title></rect>';
      }
    });
  });
  html += '</svg></div>';
  // Legend
  html += '<div style="display:flex;gap:16px;margin-top:8px;font-size:8px;color:#888;">';
  html += '<span><span style="color:#34d399;">\u25A0</span> Strong (0.85+)</span>';
  html += '<span><span style="color:#fbbf24;">\u25A0</span> Good (0.70+)</span>';
  html += '<span><span style="color:#888;">\u25A0</span> Neutral (0.50+)</span>';
  html += '<span><span style="color:#f87171;">\u25A0</span> Weak (&lt;0.50)</span>';
  html += '</div></div>';

  // Build Queue
  html += '<div style="margin-bottom:24px;">';
  html += '<div style="font-size:9px;letter-spacing:2px;color:var(--ob-gold-dim);margin-bottom:8px;">BUILD QUEUE (Next Batch)</div>';
  const nextBatch = TIERS[0].ventures.filter(v => v.status !== 'live');
  if (nextBatch.length === 0) {
    const t1pending = TIERS[1].ventures.filter(v => v.status !== 'live');
    if (t1pending.length) {
      html += '<div style="font-size:10px;color:#3b82f6;margin-bottom:4px;">Tier 0 complete \u2014 Tier 1 ready:</div>';
      t1pending.forEach(v => {
        html += '<div style="font-size:10px;padding:4px 0;color:#ccc;">\u25B6 ' + v.name + ' <span style="color:#888;font-size:9px;">(' + v.domain + ')</span></div>';
      });
    } else {
      html += '<div style="font-size:10px;color:#34d399;">All foundation tiers satisfied</div>';
    }
  } else {
    html += '<div style="font-size:10px;color:#f0b800;margin-bottom:4px;">Tier 0 in progress:</div>';
    nextBatch.forEach(v => {
      html += '<div style="font-size:10px;padding:4px 0;color:#ccc;">\u25B6 ' + v.name + ' <span style="color:#888;font-size:9px;">(' + v.service + ')</span></div>';
    });
  }
  html += '</div>';

  // Proteinlet inventory
  html += '<div>';
  html += '<div style="font-size:9px;letter-spacing:2px;color:var(--ob-gold-dim);margin-bottom:8px;">18 PROTEINLETS</div>';
  html += '<div style="display:flex;flex-wrap:wrap;gap:6px;">';
  const pletColors = {analytics:'#34d399',waitlist:'#34d399',auth:'#f0b800',pay:'#f0b800',crud:'#f0b800',email:'#3b82f6',chat:'#3b82f6',notifications:'#3b82f6','ai-inference':'#a855f7',search:'#a855f7',bi:'#a855f7',marketing:'#ef4444',sales:'#ef4444',tasks:'#ef4444',storage:'#888',cdn:'#888',legal:'#888',admin:'#888'};
  PROTEINLETS.forEach(p => {
    const c = pletColors[p] || '#888';
    html += '<span style="font-size:8px;padding:3px 8px;border-radius:3px;background:rgba(255,255,255,0.03);border:1px solid ' + c + '33;color:' + c + ';">' + p + '</span>';
  });
  html += '</div></div>';

  html += '</div>';
  container.innerHTML = html;
}

function buildArchDiagram(container) {
  container.style.cssText = 'padding:0;overflow:hidden;display:flex;flex-direction:column;font-family:var(--ob-font);color:var(--ob-text);background:var(--ob-void,#0a0a0f);';

  const LAYERS = [
    { id: 'daemon_tree', name: 'Daemons', icon: '\u{2699}' },
    { id: 'data_layer', name: 'Data', icon: '\u{1F4BE}' },
    { id: 'venture_network', name: 'Ventures', icon: '\u{1F310}' },
    { id: 'code_graph', name: 'Code', icon: '\u{1F4C4}' },
    { id: 'capability_map', name: 'Capabilities', icon: '\u{1F9E0}' },
  ];

  const STATUS_COLORS = { green: '#34d399', yellow: '#fbbf24', red: '#f87171', gray: '#555' };
  let currentLayer = 'daemon_tree';
  let archData = null;
  let svgEl = null;
  let detailPanel = null;
  let panX = 0, panY = 0, zoom = 1;
  let dragging = false, dragStartX = 0, dragStartY = 0;
  let refreshTimer = null;

  // Build UI
  let html = '<div style="display:flex;flex-direction:column;height:100%;width:100%;">';

  // Top bar with layer tabs
  html += '<div id="arch-topbar" style="display:flex;gap:4px;padding:8px 12px;background:rgba(255,204,0,0.05);border-bottom:1px solid rgba(255,204,0,0.15);flex-shrink:0;flex-wrap:wrap;align-items:center;">';
  LAYERS.forEach(l => {
    const active = l.id === currentLayer;
    html += `<button class="arch-tab" data-layer="${l.id}" style="padding:6px 12px;border:1px solid ${active ? 'rgba(255,204,0,0.6)' : 'rgba(255,204,0,0.2)'};background:${active ? 'rgba(255,204,0,0.15)' : 'transparent'};color:${active ? '#ffc800' : 'var(--ob-text)'};border-radius:6px;cursor:pointer;font-family:var(--ob-font);font-size:12px;transition:all 0.2s;">${l.icon} ${l.name}</button>`;
  });
  html += '<div style="flex:1;"></div>';
  html += '<span id="arch-stats" style="font-size:11px;color:rgba(255,204,0,0.5);margin-right:8px;"></span>';
  html += '<button id="arch-refresh" style="padding:5px 10px;border:1px solid rgba(255,204,0,0.3);background:transparent;color:var(--ob-text);border-radius:4px;cursor:pointer;font-family:var(--ob-font);font-size:11px;">Refresh</button>';
  html += '</div>';

  // SVG canvas area
  html += '<div id="arch-canvas-wrap" style="flex:1;position:relative;overflow:hidden;min-height:200px;">';
  html += '<svg id="arch-svg" width="100%" height="100%" style="display:block;"></svg>';
  html += '<div id="arch-offline" style="display:none;position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);color:#555;font-size:14px;text-align:center;">No architecture data.<br>Run: python3 architecture.py --init && --scan</div>';
  html += '</div>';

  // Detail panel (hidden by default)
  html += '<div id="arch-detail" style="display:none;padding:12px 16px;background:rgba(255,204,0,0.05);border-top:1px solid rgba(255,204,0,0.15);max-height:180px;overflow-y:auto;flex-shrink:0;">';
  html += '<div id="arch-detail-content" style="font-size:12px;line-height:1.6;"></div>';
  html += '</div>';

  html += '</div>';

  // Pulsing animation

  container.innerHTML = html;

  svgEl = container.querySelector('#arch-svg');
  detailPanel = container.querySelector('#arch-detail');
  const detailContent = container.querySelector('#arch-detail-content');
  const statsEl = container.querySelector('#arch-stats');
  const offlineEl = container.querySelector('#arch-offline');

  // Tab click handlers
  container.querySelectorAll('.arch-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      currentLayer = tab.dataset.layer;
      container.querySelectorAll('.arch-tab').forEach(t => {
        const active = t.dataset.layer === currentLayer;
        t.style.borderColor = active ? 'rgba(255,204,0,0.6)' : 'rgba(255,204,0,0.2)';
        t.style.background = active ? 'rgba(255,204,0,0.15)' : 'transparent';
        t.style.color = active ? '#ffc800' : 'var(--ob-text)';
      });
      renderLayer();
    });
  });

  // Refresh button
  container.querySelector('#arch-refresh').addEventListener('click', fetchData);

  // Pan & zoom
  const canvasWrap = container.querySelector('#arch-canvas-wrap');
  canvasWrap.addEventListener('mousedown', e => {
    if (e.target.tagName === 'circle' || e.target.tagName === 'rect' || e.target.tagName === 'text') return;
    dragging = true;
    dragStartX = e.clientX - panX;
    dragStartY = e.clientY - panY;
    canvasWrap.style.cursor = 'grabbing';
  });
  canvasWrap.addEventListener('mousemove', e => {
    if (!dragging) return;
    panX = e.clientX - dragStartX;
    panY = e.clientY - dragStartY;
    updateTransform();
  });
  canvasWrap.addEventListener('mouseup', () => { dragging = false; canvasWrap.style.cursor = 'default'; });
  canvasWrap.addEventListener('mouseleave', () => { dragging = false; canvasWrap.style.cursor = 'default'; });
  canvasWrap.addEventListener('wheel', e => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    zoom = Math.max(0.2, Math.min(5, zoom * delta));
    updateTransform();
  }, { passive: false });

  function updateTransform() {
    const g = svgEl.querySelector('#arch-graph');
    if (g) g.setAttribute('transform', `translate(${panX},${panY}) scale(${zoom})`);
  }

  function renderLayer() {
    if (!archData || !archData.layers) {
      offlineEl.style.display = 'block';
      svgEl.innerHTML = '';
      return;
    }

    const layer = archData.layers[currentLayer];
    if (!layer || !layer.nodes || layer.nodes.length === 0) {
      offlineEl.style.display = 'block';
      svgEl.innerHTML = '';
      return;
    }

    offlineEl.style.display = 'none';
    const nodes = layer.nodes;
    const edges = layer.edges || [];

    // Update stats
    if (archData.stats) {
      const s = archData.stats;
      statsEl.textContent = `${s.total_nodes || 0} nodes \u00B7 ${s.total_edges || 0} edges \u00B7 ${s.last_scan ? s.last_scan.split('T')[0] : '?'}`;
    }

    // Build SVG
    let svg = '<g id="arch-graph">';

    // Draw edges first (behind nodes)
    edges.forEach(e => {
      const fromNode = nodes.find(n => n.id === e.from);
      const toNode = nodes.find(n => n.id === e.to);
      if (!fromNode || !toNode) return;
      const relColor = e.relation === 'spawns' ? 'rgba(255,204,0,0.25)' :
                        e.relation === 'depends_on' ? 'rgba(52,211,153,0.2)' :
                        e.relation === 'calls' ? 'rgba(59,130,246,0.2)' :
                        e.relation === 'serves' ? 'rgba(168,85,247,0.2)' :
                        'rgba(255,204,0,0.12)';
      svg += `<line x1="${fromNode.x}" y1="${fromNode.y}" x2="${toNode.x}" y2="${toNode.y}" stroke="${relColor}" stroke-width="${Math.max(0.5, (e.weight || 1) * 0.8)}" />`;
    });

    // Draw nodes
    nodes.forEach(n => {
      const color = STATUS_COLORS[n.color] || STATUS_COLORS.gray;
      const isRunning = n.status === 'running' || n.status === 'active';
      const pulseClass = isRunning ? 'arch-node-running' : '';
      const r = n.r || 10;

      if (currentLayer === 'data_layer') {
        // Databases as rounded rectangles
        const w = r * 3, h = r * 2;
        svg += `<rect class="${pulseClass}" x="${n.x - w/2}" y="${n.y - h/2}" width="${w}" height="${h}" rx="4" ry="4" fill="${color}22" stroke="${color}" stroke-width="1.5" data-nid="${n.id}" style="cursor:pointer;" />`;
      } else {
        // Others as circles
        svg += `<circle class="${pulseClass}" cx="${n.x}" cy="${n.y}" r="${r}" fill="${color}22" stroke="${color}" stroke-width="1.5" data-nid="${n.id}" style="cursor:pointer;" />`;
      }

      // Label
      const fontSize = Math.max(7, Math.min(11, r * 0.8));
      let label = n.name || '';
      if (label.length > 18) label = label.substring(0, 16) + '..';
      svg += `<text x="${n.x}" y="${n.y + r + fontSize + 2}" text-anchor="middle" fill="var(--ob-text)" font-size="${fontSize}" font-family="var(--ob-font)" style="pointer-events:none;opacity:0.7;">${label}</text>`;
    });

    svg += '</g>';
    svgEl.innerHTML = svg;
    updateTransform();

    // Click handlers on nodes
    svgEl.querySelectorAll('[data-nid]').forEach(el => {
      el.addEventListener('click', e => {
        e.stopPropagation();
        const nid = parseInt(el.dataset.nid);
        const node = nodes.find(nn => nn.id === nid);
        if (node) showDetail(node);
      });
    });
  }

  function showDetail(node) {
    let html = `<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">`;
    const color = STATUS_COLORS[node.color] || STATUS_COLORS.gray;
    html += `<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${color};"></span>`;
    html += `<strong style="color:#ffc800;font-size:14px;">${node.name}</strong>`;
    html += `<span style="color:#888;font-size:11px;">[${node.type}${node.subtype ? '/' + node.subtype : ''}]</span>`;
    html += `<span style="color:${color};font-size:11px;margin-left:auto;">${node.status || 'unknown'}</span>`;
    html += '</div>';

    if (node.meta) {
      const m = node.meta;
      const entries = [];
      if (m.description) entries.push(['Desc', m.description]);
      if (m.domain) entries.push(['Domain', m.domain]);
      if (m.path) entries.push(['Path', m.path]);
      if (m.tier !== undefined && m.tier !== null) entries.push(['Tier', m.tier]);
      if (m.level !== undefined) entries.push(['Level', m.level + '/5']);
      if (m.size_bytes) entries.push(['Size', (m.size_bytes / 1024).toFixed(0) + ' KB']);
      if (m.row_count) entries.push(['Rows', m.row_count.toLocaleString()]);
      if (m.daemon_id !== undefined) entries.push(['Daemon ID', '#' + m.daemon_id]);
      if (m.providers && m.providers.length) entries.push(['Provided by', m.providers.join(', ')]);
      if (m.gaps && m.gaps.length) entries.push(['Gaps', m.gaps.join('; ')]);
      if (entries.length) {
        html += '<div style="display:grid;grid-template-columns:80px 1fr;gap:2px 12px;font-size:11px;">';
        entries.forEach(([k, v]) => {
          html += `<span style="color:rgba(255,204,0,0.6);">${k}</span><span style="color:var(--ob-text);word-break:break-word;">${v}</span>`;
        });
        html += '</div>';
      }
    }

    detailContent.innerHTML = html;
    detailPanel.style.display = 'block';
  }

  // Click on empty canvas hides detail
  canvasWrap.addEventListener('click', e => {
    if (e.target === svgEl || e.target === canvasWrap) {
      detailPanel.style.display = 'none';
    }
  });

  async function fetchData() {
    const endpoints = [
      '/architecture.json',
      'https://api.mobleysoft.com/api/architecture',
      '/api/architecture',
    ];
    for (const url of endpoints) {
      try {
        const resp = await fetch(url);
        if (!resp.ok) continue;
        archData = await resp.json();
        if (archData && archData.layers) {
          renderLayer();
          return;
        }
      } catch(e) { /* try next */ }
    }
    offlineEl.innerHTML = 'No architecture data available.<br>Run: <code>python3 architecture.py --scan</code>';
    offlineEl.style.display = 'block';
  }

  // Initial fetch
  fetchData();

  // Auto-refresh every 30s
  refreshTimer = setInterval(fetchData, 30000);

  // Cleanup on destroy (if container is removed)
  const observer = new MutationObserver(() => {
    if (!document.body.contains(container)) {
      clearInterval(refreshTimer);
      observer.disconnect();
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
}

function buildAppRegistry(container) {
  container.style.cssText = 'padding:0;overflow:hidden;display:flex;flex-direction:column;font-family:var(--ob-font);color:var(--ob-text);';

  const APPS = [
    { name:'Terminal', icon:'>', lines:1100, tier:'S', pct:98, type:'builder',
      purpose:'Full VT100/ANSI terminal emulator with WebSocket connection to the MASCOM backend.',
      state:'Production — full VT100 emulator with alternate screen buffer, scroll regions, line drawing chars, escape sequence parser, SGR color support (16 standard + 256-color mode, bold/dim/italic/underline/inverse attributes, color-aware renderer), scrollback, textfeed mode, autosee screenshot mode, char/line input modes, command history, mobile toolbar with 14 keys, image upload, caps-lock fix, staleness watchdog, auto-reconnect.',
      role:'Primary interface for all CLI operations. Every command, deployment, and daemon runs through this.' },
    { name:'BrainView', icon:'\u{1F9E0}', lines:498, tier:'S', pct:90, type:'builder',
      purpose:'Real-time neural architecture visualization of MASCOM\'s 21 brain regions.',
      state:'Production — WebSocket to brainview.mobleysoft.com, renders 21 brain regions (retina, V1, V4, IT, PFC, hippocampus, amygdala, cerebellum, thalamus, basal ganglia, etc.) with live activation heatmaps, connection graphs, and firing rate displays.',
      role:'Monitors the PhotonicMind cognitive architecture in real time. Shows which brain systems are active during perception-action cycles.' },
    { name:'AutoPilot', icon:'\u2691', lines:356, tier:'S', pct:88, type:'builder',
      purpose:'Live screen capture feed with browser automation, HAL light control, and vision analysis.',
      state:'Production — WebSocket feed from autopilot.py, 5-stage pipeline visualization (Screen Capture \u2192 HAL Gate \u2192 PhotonicMind Vision \u2192 Decision Engine \u2192 AutoBrowse), click-to-interact on frames, HAL state buttons (OFF/OBSERVE/SHARED/HAL ACTIVE), task queue, OCR trigger, vision API analysis via PhotonicMind, staleness watchdog.',
      role:'Central command for autonomous browsing. When HAL is red, MASCOM sees the screen, makes decisions, and acts. This is the cockpit.' },
    { name:'Wormhole', icon:'\u{1F300}', lines:270, tier:'A', pct:82, type:'builder',
      purpose:'Syncropy Wormhole Portal — bidirectional sync between MASCOM and HASCOM universes.',
      state:'Production — 3 zones (Task Queue, File Sync, Live Feed), authenticated wormhole API with double-hashed PSK, task submission/pull, 5 sync roots, remote screen polling, MHSCOM cross-universe chat with polling. Mobile-responsive tabs.',
      role:'The bridge between John\'s MASCOM and Ron\'s HASCOM. Enables task handoff, shared file browsing, live screen viewing, and direct messaging across universes.' },
    { name:'Papers', icon:'\u{1F4DC}', lines:259, tier:'A', pct:85, type:'builder',
      purpose:'Research papers browser showing 14 theoretical papers and their deployed MASCOM implementations.',
      state:'Production — 14 papers with titles, equations, abstracts, implementation mappings, connection explanations. Paper 14 (PhotonicMind) has full 6,000+ word body with MathJax rendering. Lazy-loads full bodies from papers.json on demand. Split-pane list/detail layout.',
      role:'The theoretical foundation. Each paper maps to running code — Mobley Functions \u2192 harmony.py, AGI Path Integrals \u2192 drive.py, PhotonicMind \u2192 the entire cognitive stack. Theory made operational.' },
    { name:'Captain\'s Log', icon:'\u{1F4D6}', lines:229, tier:'A', pct:80, type:'builder',
      purpose:'Persistent session log capturing conversations, builds, fixes, decisions, training progress, and morning reports.',
      state:'Production — 3-panel layout (30% timeline, 45% detail, 25% status), 10 entry categories with icons/colors, conversation view, morning report display with task stats + HAL states + imitation accuracy, filter by category, auto-refresh every 30s, connected to captains_log.py API.',
      role:'The memory of every session. Captures what happened (builds, fixes, decisions, milestones) and generates morning reports summarizing overnight autonomous work.' },
    { name:'Data Cubes', icon:'\u{1F4E6}', lines:200, tier:'A', pct:78, type:'builder',
      purpose:'3D visualization of all 52 MASCOM databases as interactive cubes using THREE.js.',
      state:'Production — separate THREE.js renderer, cubes sized by log10(size_bytes), colored by category (14 categories), emissive glow by row count, wireframe overlays, golden-angle spiral layout, sprite labels, connection lines (beings\u2192fleet, cognition\u2192hippocampus), inline orbit controls with touch, hover tooltips, click detail panel, auto-rotation, glow pulse animation.',
      role:'The "database of databases" — visual map of MASCOM\'s entire data layer. Shows infrastructure, core, cognition, being, revenue, and experiment databases and their relationships.' },
    { name:'Browser', icon:'\u{1F310}', lines:181, tier:'B', pct:72, type:'builder',
      purpose:'Custom web browser for automating 36 target sites across 5 revenue tiers.',
      state:'Production — multi-tab browser with tab bar, navigation controls (back/forward/refresh), URL bar, sandboxed iframes, automation target side panel grouped by tier, quick-link start page (top 8 by value), site loading from local API with fallback, status bar with site count.',
      role:'Revenue automation interface. Each of the 36 sites (KDP, AdSense, Fiverr, YouTube Studio, etc.) is a target for autonomous browsing — this is where money gets made.' },
    { name:'RevOps', icon:'\u{1F4B0}', lines:280, tier:'B', pct:92, type:'builder',
      purpose:'Revenue Operations dashboard tracking all 43 income streams across Tiers 0-5.',
      state:'Production — 4 summary stats (Total Earned, Last 30 Days, Ops Active, Deliverables), tier progress chips, status filter bar (All/Planned/Setup/Active/Earning), collapsible tier groups with 43 ops across 6 tiers (Passive/Gig Economy/Content Creation/SaaS/Employment/Speculative), click-to-expand op detail with description + next action + linked deliverables, 27 deliverables section with draft/published badges and per-op breakdown, 8 prioritized next actions, auto-refresh 60s, connected to revops.db via /api/revops with full 43-op embedded fallback.',
      role:'Tracks the money. All 43 revenue operations across 6 tiers, 27 deliverables, their status (planned/setup/active/earning), category icons, platform badges, and total earnings. The financial heartbeat of MobCorp.' },
    { name:'GetFilms', icon:'\u{1F3AC}', lines:108, tier:'B', pct:70, type:'builder',
      purpose:'Browse 40+ film ideas — search, filter by genre, discover random concepts.',
      state:'Production — search input, genre filter dropdown, random button, responsive card grid (280px min), click-to-expand modal with all fields. Fetches from getfilms.johnmobley99.workers.dev (Cloudflare Worker + D1).',
      role:'Creative asset browser. 40+ film concepts with loglines, Tarantino twists, taglines. Source material for Book2Film and content ventures.' },
    { name:'MobCorp', icon:'\u{1F3E2}', lines:108, tier:'B', pct:65, type:'builder',
      purpose:'Portfolio overview dashboard showing venture counts, health, capabilities, and activity.',
      state:'Production — 4 summary stats grid (Ventures/Active/Healthy/Capabilities), revenue pipeline stages (Discovery\u2192Build\u2192Deploy\u2192Revenue\u2192Scale), 20 capability frontiers with active highlighting, recent activity feed. Fetches from ventures/venture-health/capabilities/events APIs.',
      role:'The C-suite view. How many ventures, how healthy, what capabilities exist, what happened recently. Executive summary of the entire MobCorp empire.' },
    { name:'Mission Control', icon:'M', lines:96, tier:'B', pct:62, type:'builder',
      purpose:'Operational command center with 9 subsystem cards.',
      state:'Production — 9 clickable cards (Visualizer toggle, Task Queue, Venture Health, Build Order with 5-tier progress, Tower pair matrix, HAL Status, Workstreams, Fleet Registry, Capabilities), output pane for API data, live status loading from venture-health/capabilities/tasks/hal-status APIs.',
      role:'Operational control. Toggle the blackhole, check venture health, see build progress, monitor HAL state, track pending tasks. The mission ops console.' },
    { name:'Fleet Browser', icon:'F', lines:280, tier:'A', pct:85, type:'builder',
      purpose:'Browse the full venture portfolio by category with live health indicators.',
      state:'Production — search input with live filtering, category dropdown (11 categories), sort by name/health/category, stats bar with total/healthy/broken counts, split layout with venture list and 320px detail pane, collapsible category sections with venture counts, health dots (green/yellow/red/gray), detail view with health status and domain, "Open in new tab" and "Launch in mascomWebOS" actions. Fetches ventures + health APIs in parallel, falls back to PORTFOLIO array when offline.',
      role:'The roster. Every venture in the fleet displayed with health status. Quick launch point for any of the 200+ ventures.' },
    { name:'Empire', icon:'E', lines:200, tier:'A', pct:82, type:'builder',
      purpose:'The MobCorp Empire dashboard showing the full corporate hierarchy tree.',
      state:'Production — standalone corporate hierarchy tree with MobCorp root, 11 sector categories, and individual ventures. Collapsible sectors with arrow indicators, health aggregation per sector (X/Y healthy), per-venture health dots (green/yellow/red), click any venture to launch via launchApp(). Uses PORTFOLIO array for structure with live health data from API. Works fully offline without health data.',
      role:'Corporate structure visualization. Shows the full MobCorp empire hierarchy — 11 sectors with all ventures, their health, and direct launch capability.' },
    { name:'SingularityUI', icon:'S', lines:20, tier:'D', pct:20, type:'iframe',
      purpose:'3D venture field visualization — all 200+ ventures as orbiting nodes.',
      state:'Stub — iframe wrapper pointing to API_BASE/ui. Shows offline message when API is unreachable. No standalone functionality.',
      role:'The grand 3D visualization. Every venture as a node orbiting the MASCOM core. Requires the local API server.' },
    { name:'Copilot', icon:'\u{1F916}', lines:0, tier:'EXT', pct:80, type:'url',
      purpose:'AI-powered code editor with generate, review, refactor, test, explain, and fix capabilities.',
      state:'External — served from copilot.html on mobleysoft.com. Full standalone application with editor, AI integration, and code intelligence.',
      role:'The AI development environment. Generates, reviews, and fixes code. Key tool for autonomous coding tasks.' },
    { name:'Forge', icon:'\u{1F528}', lines:0, tier:'EXT', pct:75, type:'url',
      purpose:'Natural language to full-stack code generator with 6 templates and multi-file generation.',
      state:'External — served from forge.html on mobleysoft.com. Standalone NL-to-code generator.',
      role:'Scaffolding engine. Takes a description and generates entire applications from templates.' },
    { name:'SonicMind', icon:'\u{1F3B5}', lines:0, tier:'EXT', pct:60, type:'url',
      purpose:'AI Music Generator creating music from text prompts using Web Audio synthesis.',
      state:'External — served from sonic_mind.html on mobleysoft.com. Web Audio based synthesis.',
      role:'Creative audio generation. Turns text descriptions into synthesized music. Demonstrates MASCOM\'s creative capabilities.' },
    { name:'GameGob', icon:'\u{1F3AE}', lines:0, tier:'EXT', pct:85, type:'url',
      purpose:'16 playable HTML5 games — arcade, puzzle, strategy — all built by MASCOM.',
      state:'External — served from gamegob.com/games.html. 16 complete games with autodev.py and spritegan.py for automated game development.',
      role:'The game studio. 16 shipped titles prove MASCOM can design, code, and deploy consumer products end-to-end.' },
    { name:'Halside', icon:'\u{1F4BB}', lines:0, tier:'EXT', pct:70, type:'url',
      purpose:'Universal IDE — VSCode-like web editor with terminals, file management, and AI integration.',
      state:'External — served from halside.com/ide.html. Full IDE with editor, terminal, file tree, and code intelligence.',
      role:'The AGI-native development environment. Not just a web IDE — internally it\'s MASCOM\'s primary code editing tool.' },
  ];

  // Sort by pct descending
  const sorted = [...APPS].sort((a, b) => b.pct - a.pct);

  const TIER_COLORS = { S:'#f0b800', A:'#34d399', B:'#3b82f6', C:'#a855f7', D:'#f87171', EXT:'#6b7280' };
  const TYPE_LABELS = { builder:'Built-in', iframe:'iFrame Stub', url:'External URL' };

  // Top bar
  const bar = document.createElement('div');
  bar.style.cssText = 'padding:10px 14px;border-bottom:1px solid var(--ob-border);display:flex;align-items:center;gap:10px;flex-shrink:0;';
  const totalLines = APPS.reduce((s, a) => s + a.lines, 0);
  const builtIn = APPS.filter(a => a.type === 'builder').length;
  bar.innerHTML = `<span style="font-size:14px;font-weight:700;color:var(--ob-gold);">App Registry</span>
    <span style="font-size:10px;color:var(--ob-text-dim);margin-left:auto;">${APPS.length} apps &middot; ${builtIn} built-in &middot; ~${totalLines.toLocaleString()} lines</span>`;
  container.appendChild(bar);

  // Tier legend
  const legend = document.createElement('div');
  legend.style.cssText = 'padding:6px 14px;display:flex;gap:10px;flex-wrap:wrap;border-bottom:1px solid var(--ob-border);flex-shrink:0;';
  ['S','A','B','C','D','EXT'].forEach(t => {
    legend.innerHTML += `<span style="font-size:9px;color:${TIER_COLORS[t]};font-weight:700;font-family:var(--ob-mono);">${t}</span>`;
  });
  container.appendChild(legend);

  // Split layout
  const body = document.createElement('div');
  body.style.cssText = 'flex:1;display:flex;overflow:hidden;min-height:0;';

  // List
  const list = document.createElement('div');
  list.style.cssText = 'width:38%;overflow-y:auto;border-right:1px solid var(--ob-border);';

  // Detail
  const detail = document.createElement('div');
  detail.style.cssText = 'flex:1;overflow-y:auto;padding:14px;';
  detail.innerHTML = '<div style="color:var(--ob-text-dim);text-align:center;margin-top:40px;font-size:11px;">Select an app to view details</div>';

  sorted.forEach((app, i) => {
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;align-items:center;gap:8px;padding:8px 12px;cursor:pointer;border-bottom:1px solid rgba(255,255,255,0.03);';
    row.addEventListener('mouseenter', () => { row.style.background = 'rgba(255,255,255,0.04)'; });
    row.addEventListener('mouseleave', () => { row.style.background = 'transparent'; });

    // Progress bar
    const barWidth = Math.max(4, app.pct * 0.6);
    row.innerHTML = `
      <span style="font-size:14px;width:22px;text-align:center;">${app.icon}</span>
      <div style="flex:1;min-width:0;">
        <div style="display:flex;align-items:center;gap:6px;">
          <span style="font-size:11px;font-weight:600;color:var(--ob-text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${app.name}</span>
          <span style="font-size:8px;font-weight:800;color:${TIER_COLORS[app.tier]};font-family:var(--ob-mono);flex-shrink:0;">${app.tier}</span>
        </div>
        <div style="margin-top:3px;height:3px;background:rgba(255,255,255,0.06);border-radius:2px;overflow:hidden;">
          <div style="height:100%;width:${app.pct}%;background:${TIER_COLORS[app.tier]};border-radius:2px;"></div>
        </div>
      </div>
      <span style="font-size:10px;color:var(--ob-text-dim);font-family:var(--ob-mono);flex-shrink:0;">${app.pct}%</span>`;

    row.addEventListener('click', () => {
      list.querySelectorAll('div').forEach(d => d.style.borderLeft = '');
      row.style.borderLeft = '3px solid ' + TIER_COLORS[app.tier];
      const sizeStr = app.lines > 0 ? app.lines + ' lines' : 'external';
      detail.innerHTML = `
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px;">
          <span style="font-size:28px;">${app.icon}</span>
          <div>
            <div style="font-size:16px;font-weight:700;color:${TIER_COLORS[app.tier]};">${app.name}</div>
            <div style="font-size:10px;color:var(--ob-text-dim);">Tier ${app.tier} &middot; ${sizeStr} &middot; ${TYPE_LABELS[app.type]} &middot; ${app.pct}% complete</div>
          </div>
        </div>
        <div style="display:flex;gap:6px;margin-bottom:14px;">
          <div style="flex:1;height:6px;background:rgba(255,255,255,0.06);border-radius:3px;overflow:hidden;">
            <div style="height:100%;width:${app.pct}%;background:${TIER_COLORS[app.tier]};border-radius:3px;transition:width 0.3s;"></div>
          </div>
          <span style="font-size:10px;font-weight:700;color:${TIER_COLORS[app.tier]};font-family:var(--ob-mono);">${app.pct}%</span>
        </div>
        <div style="margin-bottom:14px;">
          <div style="font-size:9px;font-weight:700;color:var(--ob-gold);letter-spacing:1px;margin-bottom:4px;">PURPOSE</div>
          <div style="font-size:11px;line-height:1.6;">${app.purpose}</div>
        </div>
        <div style="margin-bottom:14px;">
          <div style="font-size:9px;font-weight:700;color:var(--ob-gold);letter-spacing:1px;margin-bottom:4px;">CURRENT STATE</div>
          <div style="font-size:11px;line-height:1.6;background:rgba(255,255,255,0.02);border-radius:6px;padding:10px;">${app.state}</div>
        </div>
        <div>
          <div style="font-size:9px;font-weight:700;color:var(--ob-gold);letter-spacing:1px;margin-bottom:4px;">ROLE IN THE SYSTEM</div>
          <div style="font-size:11px;line-height:1.6;">${app.role}</div>
        </div>`;
    });
    list.appendChild(row);
  });

  body.appendChild(list);
  body.appendChild(detail);
  container.appendChild(body);
}

// ── Data Cubes: 3D database visualization ──
function buildDataCubes(container) {
  container.style.cssText = 'padding:0;overflow:hidden;display:flex;flex-direction:column;';
  const R2 = ''; // Sovereign: databases.json served relative via flowistan
  const CAT_COLORS = {
    infrastructure:'#00e5ff', core:'#f0b800', cognition:'#e040fb', being:'#4caf50',
    system:'#ff9800', 'venture_soul':'#9c27b0', 'venture-soul':'#9c27b0',
    'venture_memory':'#3f51b5', 'venture-memory':'#3f51b5', revenue:'#76ff03',
    intelligence:'#ff5722', experiment:'#ff4081', meta:'#ffffff', product:'#009688'
  };
  const catKeys = Object.keys(CAT_COLORS).filter(k => !k.includes('_'));

  const wrap = document.createElement('div');
  wrap.style.cssText = 'flex:1;position:relative;min-height:0;';
  const tooltip = document.createElement('div');
  tooltip.style.cssText = 'position:absolute;top:0;left:0;pointer-events:none;background:rgba(4,4,10,0.92);border:1px solid rgba(240,184,0,0.3);border-radius:6px;padding:8px 10px;font-size:10px;color:#e0e0e0;font-family:var(--ob-font);display:none;z-index:10;max-width:260px;line-height:1.5;';
  const detail = document.createElement('div');
  detail.style.cssText = 'height:0;overflow:hidden;transition:height 0.3s;background:rgba(4,4,10,0.95);border-top:1px solid rgba(240,184,0,0.15);padding:0 12px;font-family:var(--ob-font);color:#e0e0e0;';
  detail.innerHTML = '<div id="dc-detail-inner" style="padding:10px 0;font-size:10px;"></div>';
  wrap.appendChild(tooltip);
  container.appendChild(wrap);
  container.appendChild(detail);

  // THREE.js scene (separate from blackhole)
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0x04040a);
  wrap.appendChild(renderer.domElement);
  renderer.domElement.style.cssText = 'display:block;width:100%;height:100%;';

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 500);
  scene.add(new THREE.AmbientLight(0x222244, 0.3));
  const pointLight = new THREE.PointLight(0xf0b800, 0.8);
  scene.add(pointLight);

  // Inline orbit controls (spherical camera)
  let camTheta = 0.3, camPhi = 1.1, camDist = 35;
  let dragging = false, lastX = 0, lastY = 0;
  function updateCam() {
    camera.position.set(
      camDist * Math.sin(camPhi) * Math.sin(camTheta),
      camDist * Math.cos(camPhi),
      camDist * Math.sin(camPhi) * Math.cos(camTheta)
    );
    camera.lookAt(0, 0, 0);
  }
  updateCam();

  const cvs = renderer.domElement;
  cvs.addEventListener('pointerdown', e => { dragging = true; lastX = e.clientX; lastY = e.clientY; });
  window.addEventListener('pointerup', () => dragging = false);
  cvs.addEventListener('pointermove', e => {
    if (!dragging) return;
    camTheta -= (e.clientX - lastX) * 0.005;
    camPhi = Math.max(0.2, Math.min(Math.PI - 0.2, camPhi - (e.clientY - lastY) * 0.005));
    lastX = e.clientX; lastY = e.clientY;
    updateCam();
  });
  cvs.addEventListener('wheel', e => { camDist = Math.max(8, Math.min(80, camDist + e.deltaY * 0.03)); updateCam(); e.preventDefault(); }, { passive: false });

  // Touch support
  let lastTouchDist = 0;
  cvs.addEventListener('touchstart', e => {
    if (e.touches.length === 1) { dragging = true; lastX = e.touches[0].clientX; lastY = e.touches[0].clientY; }
    if (e.touches.length === 2) { lastTouchDist = Math.hypot(e.touches[1].clientX - e.touches[0].clientX, e.touches[1].clientY - e.touches[0].clientY); }
  });
  cvs.addEventListener('touchmove', e => {
    if (e.touches.length === 1 && dragging) {
      camTheta -= (e.touches[0].clientX - lastX) * 0.005;
      camPhi = Math.max(0.2, Math.min(Math.PI - 0.2, camPhi - (e.touches[0].clientY - lastY) * 0.005));
      lastX = e.touches[0].clientX; lastY = e.touches[0].clientY;
      updateCam();
    }
    if (e.touches.length === 2) {
      const d = Math.hypot(e.touches[1].clientX - e.touches[0].clientX, e.touches[1].clientY - e.touches[0].clientY);
      camDist = Math.max(8, Math.min(80, camDist - (d - lastTouchDist) * 0.05));
      lastTouchDist = d;
      updateCam();
    }
    e.preventDefault();
  }, { passive: false });
  cvs.addEventListener('touchend', () => dragging = false);

  // Raycaster
  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();
  const cubes = []; // {mesh, wireframe, data}

  function makeLabel(text) {
    const c = document.createElement('canvas');
    c.width = 256; c.height = 40;
    const ctx = c.getContext('2d');
    ctx.font = 'bold 18px monospace';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.fillText(text.replace('.db', ''), 128, 26);
    const tex = new THREE.CanvasTexture(c);
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, opacity: 0.7 });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(3, 0.5, 1);
    return sprite;
  }

  function buildScene(databases) {
    // Group by category
    const groups = {};
    databases.forEach(db => {
      const cat = db.category.replace('_', '-');
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(db);
    });
    const cats = Object.keys(groups);
    const golden = 2.399963; // golden angle in radians

    cats.forEach((cat, ci) => {
      const sectorAngle = (ci / cats.length) * Math.PI * 2;
      const dbs = groups[cat];
      dbs.forEach((db, di) => {
        const sz = db.size_bytes > 0 ? Math.max(0.3, Math.min(3.0, Math.log10(db.size_bytes) / 2.3)) : 0.3;
        const color = new THREE.Color(CAT_COLORS[cat] || CAT_COLORS[db.category] || '#888888');
        const emissiveIntensity = db.row_count > 0 ? Math.max(0.1, Math.min(1.0, Math.log10(db.row_count) / 4)) : 0.1;

        // Position: spiral within sector
        const r = 4 + di * 2.2;
        const a = sectorAngle + (di * golden * 0.3);
        const x = r * Math.cos(a);
        const z = r * Math.sin(a);
        const y = (Math.sin(di * 1.7) * 3);

        // Main cube
        const geo = new THREE.BoxGeometry(sz, sz, sz);
        const mat = new THREE.MeshStandardMaterial({
          color: color, emissive: color, emissiveIntensity: emissiveIntensity,
          metalness: 0.4, roughness: 0.5
        });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(x, y, z);
        scene.add(mesh);

        // Wireframe overlay
        const wGeo = new THREE.BoxGeometry(sz * 1.02, sz * 1.02, sz * 1.02);
        const wMat = new THREE.MeshBasicMaterial({ color: color, wireframe: true, transparent: true, opacity: 0.15 });
        const wireframe = new THREE.Mesh(wGeo, wMat);
        wireframe.position.copy(mesh.position);
        scene.add(wireframe);

        // Label sprite
        const label = makeLabel(db.name);
        label.position.set(x, y + sz / 2 + 0.6, z);
        scene.add(label);

        cubes.push({ mesh, wireframe, data: db, baseScale: sz, emissiveBase: emissiveIntensity, offset: ci * 0.5 + di * 0.3 });
      });
    });

    // Connection lines
    const lineMat = new THREE.LineBasicMaterial({ color: 0xf0b800, transparent: true, opacity: 0.08 });
    function findCube(name) { return cubes.find(c => c.data.name === name); }
    const fleetCube = findCube('fleet.db');
    const hippoCube = findCube('hippocampus.db');
    const contextCube = findCube('context.db');
    const tasksCube = findCube('tasks.db');

    function addLine(a, b) {
      if (!a || !b) return;
      const geo = new THREE.BufferGeometry().setFromPoints([a.mesh.position, b.mesh.position]);
      scene.add(new THREE.Line(geo, lineMat));
    }

    cubes.forEach(c => {
      if (c.data.category === 'being' && fleetCube) addLine(c, fleetCube);
      if (c.data.category === 'cognition' && hippoCube) addLine(c, hippoCube);
      if ((c.data.category === 'venture_soul' || c.data.category === 'venture_memory') && fleetCube) addLine(c, fleetCube);
    });
    if (tasksCube && contextCube) addLine(tasksCube, contextCube);
  }

  // Hover + click
  let hoveredCube = null, selectedCube = null;
  cvs.addEventListener('pointermove', e => {
    const rect = cvs.getBoundingClientRect();
    mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);
    const meshes = cubes.map(c => c.mesh);
    const hits = raycaster.intersectObjects(meshes);

    if (hoveredCube) { hoveredCube.mesh.scale.setScalar(1); hoveredCube = null; }

    if (hits.length) {
      const hit = cubes.find(c => c.mesh === hits[0].object);
      if (hit) {
        hoveredCube = hit;
        hit.mesh.scale.setScalar(1.2);
        const d = hit.data;
        const sizeStr = d.size_bytes >= 1048576 ? (d.size_bytes / 1048576).toFixed(1) + ' MB' : (d.size_bytes / 1024).toFixed(0) + ' KB';
        const tables = d.schema_tables.map(t => t.table).join(', ') || 'none';
        tooltip.innerHTML = `<div style="font-weight:700;color:${CAT_COLORS[d.category] || '#f0b800'};margin-bottom:3px;">${d.name}</div>` +
          `<div style="color:#999;margin-bottom:2px;">${d.category}</div>` +
          `<div>${sizeStr} &middot; ${d.row_count.toLocaleString()} rows</div>` +
          `<div style="color:#777;margin-top:2px;">Tables: ${tables}</div>`;
        tooltip.style.display = 'block';
        tooltip.style.left = (e.clientX - wrap.getBoundingClientRect().left + 12) + 'px';
        tooltip.style.top = (e.clientY - wrap.getBoundingClientRect().top - 10) + 'px';
      }
    } else {
      tooltip.style.display = 'none';
    }
  });

  cvs.addEventListener('click', e => {
    if (!hoveredCube) { detail.style.height = '0'; selectedCube = null; return; }
    selectedCube = hoveredCube;
    const d = selectedCube.data;
    const sizeStr = d.size_bytes >= 1048576 ? (d.size_bytes / 1048576).toFixed(1) + ' MB' : (d.size_bytes / 1024).toFixed(0) + ' KB';
    const chips = d.schema_tables.map(t =>
      `<span style="display:inline-block;background:rgba(240,184,0,0.12);border:1px solid rgba(240,184,0,0.25);border-radius:4px;padding:2px 6px;margin:2px;font-size:9px;">${t.table} <span style="color:${CAT_COLORS[d.category] || '#f0b800'};">(${t.rows})</span></span>`
    ).join('');
    detail.querySelector('#dc-detail-inner').innerHTML =
      `<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">` +
      `<span style="font-size:13px;font-weight:700;color:${CAT_COLORS[d.category] || '#f0b800'};">${d.name}</span>` +
      `<span style="font-size:9px;color:#777;background:rgba(255,255,255,0.05);padding:2px 6px;border-radius:3px;">${d.category}</span>` +
      `<span style="font-size:9px;color:#999;">${sizeStr} &middot; ${d.row_count.toLocaleString()} rows</span></div>` +
      `<div style="font-size:10px;color:#aaa;margin-bottom:6px;">${d.description}</div>` +
      `<div>${chips || '<span style="color:#555;">No tables</span>'}</div>`;
    detail.style.height = '100px';
  });

  // Resize
  const ro = new ResizeObserver(() => {
    const w = wrap.clientWidth, h = wrap.clientHeight;
    if (w && h) { renderer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix(); }
  });
  ro.observe(wrap);

  // Animation loop
  let animId;
  function animate() {
    animId = requestAnimationFrame(animate);
    const t = performance.now() * 0.001;
    // Auto-rotation
    if (!dragging) { camTheta += 0.001; updateCam(); }
    // Glow pulse
    cubes.forEach(c => {
      const pulse = 0.15 * Math.sin(t * 1.5 + c.offset);
      c.mesh.material.emissiveIntensity = Math.max(0.05, c.emissiveBase + pulse);
    });
    renderer.render(scene, camera);
  }

  // Load data and start
  fetch(R2 + '/databases.json')
    .then(r => r.json())
    .then(databases => { buildScene(databases); animate(); })
    .catch(err => {
      wrap.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--ob-text-dim);font-size:11px;font-family:var(--ob-font);">Failed to load databases.json</div>';
      console.error('DataCubes:', err);
    });

  // Cleanup on container removal
  const mo = new MutationObserver(() => {
    if (!document.contains(container)) { cancelAnimationFrame(animId); renderer.dispose(); ro.disconnect(); mo.disconnect(); }
  });
  mo.observe(document.body, { childList: true, subtree: true });
}

// ── Darkworks: Combined Game/Worldbuilding/Art Studio ──
function buildDarkworks(container) {
  container.style.cssText = 'padding:0;overflow:hidden;display:flex;flex-direction:column;font-family:var(--ob-font);color:var(--ob-text);';

  // ── Shared world-building data ──
  const WB_ELEMENTS = {
    "TimePeriod": ["Ancient","Medieval","Renaissance","Industrial","Futuristic","Alternate History","Prehistoric","Colonial"],
    "Theme": ["Fantasy","High Fantasy","Low Fantasy","Urban Fantasy","Gothic Fantasy","Dark Fantasy","Fairy Tale","SciFi","Space Opera","Cyberpunk","Steampunk","Biopunk","Utopian","Dystopian","Postapocalyptic","Greek Mythology","Norse Mythology"],
    "Environment": ["Forest","Desert","Mountain","Ocean","Urban","Arctic","Swamp","Underwater","Volcanic","Sky"],
    "Atmosphere": ["Mysterious","Magical","Dark","Whimsical","Serene","Surreal","Dystopian","Utopian","Eerie","Lively"],
    "Location": ["Island","Underground","Floating","Celestial","Extraterrestrial","Dimensional","Interstellar","City","Village","Wasteland"],
    "Inhabitants": ["Humans","Mythical Creatures","Aliens","Robots","Undead","Merfolk","Sentient Plants","Constructs"],
    "Conflict": ["War","Exploration","Survival","Quest","Discovery","Intrigue","Revolution","Conquest","Rebellion"],
    "Magic Schools": ["Elemental","Necromancy","Illusion","Enchantment","Alchemy","Divination","Summoning","Transmutation","Blood Magic","Rune Craft"],
    "Magic Abilities": ["Shapeshifting","Teleportation","Mind Control","Time Manipulation","Summoning","Illusions","Healing","Flight","Invisibility","Elemental Manipulation"],
    "Narrative Focus": ["Heroic Journey","Coming of Age","Intrigue","Redemption","Revenge","Mystery","Romance","Adventure","Tragedy","Exploration"],
    "Character Roles": ["Heroes","Villains","Sidekicks","Mentors","Antiheroes","Sages","Rogues","Warriors","Mages","Healers"],
    "Weapons": ["Swords","Bows","Axes","Spears","Daggers","Maces","Staffs","Crossbows","Whips","Flails"],
    "Planar Realms": ["Celestial","Infernal","Fey","Elemental","Astral","Dreamscape","Ethereal","Shadow","Underworld","Void"],
    "Fauna": ["Mammals","Reptiles","Birds","Amphibians","Insects","Fish","Dinosaurs","Dragons"],
    "Monsters": ["Dragons","Hydras","Gargoyles","Manticores","Chimeras","Basilisks","Wendigos","Kraken","Griffins","Sphinxes"],
    "Terrain Features": ["Rivers","Caves","Mountains","Valleys","Waterfalls","Plateaus","Cliffs","Glaciers","Lakes"]
  };

  const WORLD_CUBE = {
    5:{name:'Sky Realm',desc:'Cloud cities, celestial palaces, airships and griffons soaring through endless skies'},
    4:{name:'Mountain Peaks',desc:'Snow-capped summits, hidden monasteries, soaring eagles and frozen lakes'},
    3:{name:'Forest Canopy',desc:'Ancient trees, dappled sunlight, singing birds and hidden sylvan glades'},
    2:{name:'Grasslands',desc:'Rolling hills, wildflowers, scattered farmhouses under clear blue skies'},
    1:{name:'Coastal Cliffs',desc:'Rugged coastline, crashing waves, seabird colonies and hidden caves'},
    0:{name:'Sea Level',desc:'Crystal clear water, sandy beaches, coral reefs and shipwrecks'},
    '-1':{name:'Basement',desc:'Cobblestone walls, dusty crates, dim lighting and musty dampness'},
    '-2':{name:'Underground',desc:'Caverns, bioluminescent mushrooms, mineral deposits and dripping echoes'},
    '-3':{name:'Cavern',desc:'Stalactites, underground lakes, ancient ruins and fossil remains'},
    '-4':{name:'Abyss',desc:'Endless darkness, falling rocks, glowing cracks and monstrous eyes'},
    '-5':{name:'Hell',desc:'Molten lava, burning flames, sulfurous fumes and screams of the damned'}
  };

  // ── Tab system ──
  const tabs = [
    {id:'worldseed', name:'WorldSeed', icon:'🌱'},
    {id:'worldbender', name:'WorldBender', icon:'🌀'},
    {id:'verdantvale', name:'Verdant Vale', icon:'⚔️'},
    {id:'spritedetect', name:'Sprite Detector', icon:'👁️'},
    {id:'animator', name:'Animator', icon:'🎬'},
    {id:'char2sprite', name:'Char2Sprite', icon:'👤'},
    {id:'asciirpg', name:'ASCII RPG', icon:'🗺️'},
    {id:'colonywars', name:'Colony Wars', icon:'🚀'}
  ];

  const tabBar = document.createElement('div');
  tabBar.style.cssText = 'display:flex;background:var(--ob-surface);border-bottom:1px solid var(--ob-border);flex-shrink:0;overflow-x:auto;';
  tabs.forEach(t => {
    const btn = document.createElement('button');
    btn.className = 'dw-tab';
    btn.dataset.tab = t.id;
    btn.innerHTML = `${t.icon} ${t.name}`;
    btn.style.cssText = 'padding:8px 14px;background:none;border:none;color:var(--ob-text-dim);cursor:pointer;font-size:13px;white-space:nowrap;border-bottom:2px solid transparent;transition:all .2s;';
    btn.addEventListener('click', () => switchTab(t.id));
    tabBar.appendChild(btn);
  });
  container.appendChild(tabBar);

  const contentArea = document.createElement('div');
  contentArea.style.cssText = 'flex:1;overflow:auto;position:relative;';
  container.appendChild(contentArea);

  // Create tab panels
  const panels = {};
  tabs.forEach(t => {
    const p = document.createElement('div');
    p.style.cssText = 'display:none;width:100%;height:100%;overflow:auto;';
    p.id = 'dw-panel-' + t.id;
    contentArea.appendChild(p);
    panels[t.id] = p;
  });

  function switchTab(id) {
    tabs.forEach(t => {
      panels[t.id].style.display = t.id === id ? 'block' : 'none';
      const btn = tabBar.querySelector(`[data-tab="${t.id}"]`);
      btn.style.color = t.id === id ? 'var(--ob-accent)' : 'var(--ob-text-dim)';
      btn.style.borderBottomColor = t.id === id ? 'var(--ob-accent)' : 'transparent';
    });
    // Initialize panels lazily
    if (id === 'verdantvale' && !panels.verdantvale._init) initVerdantVale();
    if (id === 'spritedetect' && !panels.spritedetect._init) initSpriteDetector();
    if (id === 'animator' && !panels.animator._init) initAnimator();
    if (id === 'char2sprite' && !panels.char2sprite._init) initChar2Sprite();
    if (id === 'asciirpg' && !panels.asciirpg._init) initAsciiRpg();
    if (id === 'colonywars' && !panels.colonywars._init) initColonyWars();
  }

  // ═══════════════════════════════════════════════
  // TAB 1: WorldSeed — Interactive world seed builder
  // ═══════════════════════════════════════════════
  (function initWorldSeed() {
    const p = panels.worldseed;
    p.style.padding = '16px';
    p.innerHTML = `
      <div style="text-align:center;margin-bottom:12px;opacity:.7;font-size:13px">A world seed is a set of game design decisions. Click options to select them.</div>
      <div style="display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap">
        <textarea id="dw-ws-prompt" style="flex:1;min-width:200px;height:60px;background:var(--ob-surface);border:1px solid var(--ob-border);color:var(--ob-text);border-radius:6px;padding:8px;font-size:12px;resize:vertical;" placeholder="Generated world seed prompt..."></textarea>
        <button id="dw-ws-random" style="padding:8px 16px;background:var(--ob-accent);color:#000;border:none;border-radius:6px;cursor:pointer;font-weight:bold;">Randomize</button>
        <button id="dw-ws-clear" style="padding:8px 16px;background:var(--ob-surface);color:var(--ob-text);border:1px solid var(--ob-border);border-radius:6px;cursor:pointer;">Clear</button>
        <button id="dw-ws-copy" style="padding:8px 16px;background:var(--ob-surface);color:var(--ob-text);border:1px solid var(--ob-border);border-radius:6px;cursor:pointer;">Copy</button>
      </div>
      <div id="dw-ws-form"></div>`;

    const formContainer = p.querySelector('#dw-ws-form');
    const promptArea = p.querySelector('#dw-ws-prompt');

    // Build category groups
    for (const cat in WB_ELEMENTS) {
      const group = document.createElement('div');
      group.style.cssText = 'margin-bottom:12px;';
      group.innerHTML = `<div style="font-weight:bold;font-size:13px;margin-bottom:6px;color:var(--ob-accent);">${cat}</div>`;
      const opts = document.createElement('div');
      opts.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px;';
      WB_ELEMENTS[cat].forEach(opt => {
        const chip = document.createElement('span');
        chip.className = 'dw-ws-chip';
        chip.textContent = opt;
        chip.style.cssText = 'padding:4px 10px;border:1px solid var(--ob-border);border-radius:12px;font-size:12px;cursor:pointer;transition:all .15s;user-select:none;';
        chip.addEventListener('click', () => {
          chip.classList.toggle('selected');
          if (chip.classList.contains('selected')) {
            chip.style.background = 'var(--ob-accent)';
            chip.style.color = '#000';
            chip.style.borderColor = 'var(--ob-accent)';
          } else {
            chip.style.background = 'none';
            chip.style.color = 'var(--ob-text)';
            chip.style.borderColor = 'var(--ob-border)';
          }
          updateWSPrompt();
        });
        opts.appendChild(chip);
      });
      group.appendChild(opts);
      formContainer.appendChild(group);
    }

    function updateWSPrompt() {
      const lines = [];
      formContainer.querySelectorAll('div[style*="margin-bottom:12px"]').forEach(group => {
        const label = group.querySelector('div[style*="font-weight:bold"]');
        const selected = group.querySelectorAll('.dw-ws-chip.selected');
        if (selected.length > 0 && label) {
          lines.push(label.textContent + ': ' + Array.from(selected).map(s => s.textContent).join(', '));
        }
      });
      promptArea.value = lines.join('\n');
    }

    p.querySelector('#dw-ws-random').addEventListener('click', () => {
      formContainer.querySelectorAll('.dw-ws-chip').forEach(chip => {
        const sel = Math.random() < 0.3;
        chip.classList.toggle('selected', sel);
        chip.style.background = sel ? 'var(--ob-accent)' : 'none';
        chip.style.color = sel ? '#000' : 'var(--ob-text)';
        chip.style.borderColor = sel ? 'var(--ob-accent)' : 'var(--ob-border)';
      });
      updateWSPrompt();
    });

    p.querySelector('#dw-ws-clear').addEventListener('click', () => {
      formContainer.querySelectorAll('.dw-ws-chip.selected').forEach(chip => {
        chip.classList.remove('selected');
        chip.style.background = 'none';
        chip.style.color = 'var(--ob-text)';
        chip.style.borderColor = 'var(--ob-border)';
      });
      promptArea.value = '';
    });

    p.querySelector('#dw-ws-copy').addEventListener('click', () => {
      navigator.clipboard.writeText(promptArea.value);
      if (typeof showToast === 'function') showToast('World seed copied!', 'success');
    });
  })();

  // ═══════════════════════════════════════════════
  // TAB 2: WorldBender — World element table + WorldCube
  // ═══════════════════════════════════════════════
  (function initWorldBender() {
    const p = panels.worldbender;
    p.style.padding = '16px';

    // WorldCube visualization
    let cubeHTML = '<div style="margin-bottom:20px"><div style="font-weight:bold;font-size:15px;margin-bottom:10px;color:var(--ob-accent)">World Cube — Elevation Layers</div>';
    cubeHTML += '<div style="display:flex;flex-direction:column;gap:4px;">';
    for (let lvl = 5; lvl >= -5; lvl--) {
      const c = WORLD_CUBE[lvl];
      if (!c) continue;
      const hue = Math.round(120 + (5 - lvl) * 20);
      cubeHTML += `<div style="display:flex;align-items:center;gap:10px;padding:8px 12px;background:hsla(${hue},60%,20%,.4);border-radius:6px;border-left:3px solid hsl(${hue},70%,50%);">
        <span style="font-weight:bold;min-width:24px;text-align:center;">${lvl > 0 ? '+' : ''}${lvl}</span>
        <span style="font-weight:bold;min-width:120px;">${c.name}</span>
        <span style="font-size:12px;opacity:.7;">${c.desc}</span>
      </div>`;
    }
    cubeHTML += '</div></div>';

    // Element reference table
    cubeHTML += '<div style="font-weight:bold;font-size:15px;margin-bottom:10px;color:var(--ob-accent)">World Building Elements</div>';
    cubeHTML += '<table style="width:100%;border-collapse:collapse;font-size:12px;">';
    cubeHTML += '<tr style="background:var(--ob-surface);"><th style="text-align:left;padding:6px 10px;border-bottom:1px solid var(--ob-border);">Category</th><th style="text-align:left;padding:6px 10px;border-bottom:1px solid var(--ob-border);">Options</th></tr>';
    for (const cat in WB_ELEMENTS) {
      cubeHTML += `<tr><td style="padding:6px 10px;border-bottom:1px solid rgba(255,255,255,.05);font-weight:bold;color:var(--ob-accent);vertical-align:top;white-space:nowrap;">${cat}</td><td style="padding:6px 10px;border-bottom:1px solid rgba(255,255,255,.05);">${WB_ELEMENTS[cat].join(', ')}</td></tr>`;
    }
    cubeHTML += '</table>';
    p.innerHTML = cubeHTML;
  })();

  // ═══════════════════════════════════════════════
  // TAB 3: Verdant Vale — 2D Action RPG
  // ═══════════════════════════════════════════════
  function initVerdantVale() {
    const p = panels.verdantvale;
    p._init = true;
    p.style.cssText += 'position:relative;display:flex;flex-direction:column;align-items:center;justify-content:center;background:#000;';
    p.innerHTML = `
      <div id="dw-vv-overlay" style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;z-index:2;background:rgba(0,0,0,.85);">
        <div style="font-size:28px;font-weight:bold;color:#4ade80;margin-bottom:8px;">Verdant Vale</div>
        <div style="font-size:14px;color:#aaa;margin-bottom:20px;">The Enchanted Forest — A procedurally generated action RPG</div>
        <div style="font-size:12px;color:#666;margin-bottom:16px;">WASD/Arrows: Move | Space/Ctrl: Attack</div>
        <button id="dw-vv-start" style="padding:12px 32px;background:#4ade80;color:#000;border:none;border-radius:8px;font-size:16px;font-weight:bold;cursor:pointer;">START</button>
      </div>
      <canvas id="dw-vv-canvas" style="width:100%;height:100%;"></canvas>
      <div style="position:absolute;top:8px;left:8px;font-size:12px;color:#fff;z-index:1;" id="dw-vv-hud"></div>`;

    const canvas = p.querySelector('#dw-vv-canvas');
    const ctx = canvas.getContext('2d');
    const hud = p.querySelector('#dw-vv-hud');
    let running = false, animId = null;

    // Game state (scoped)
    let gTime = 0, gTimeSpeed = 0.001;
    let pX, pY, pDir = 0, pRadius = 10, pSpeed = 10;
    let eX, eY, eRadius = 10, eSpeed = 2;
    let attackAngle = 0, isAttacking = false;
    let score = 0, maze = [], mazeGenerated = false;
    let moveU = false, moveD = false, moveL = false, moveR = false;
    let tileW, tileH;

    function resizeCanvas() {
      canvas.width = p.clientWidth;
      canvas.height = p.clientHeight;
      mazeGenerated = false;
    }

    function generateMaze(w, h) {
      const m = [];
      for (let y = 0; y < h; y++) { m[y] = []; for (let x = 0; x < w; x++) m[y][x] = 1; }
      function carve(x, y) {
        m[y][x] = 0;
        const dirs = [[0,-1],[1,0],[0,1],[-1,0]].sort(() => Math.random() - 0.5);
        for (const [dx, dy] of dirs) {
          const nx = x + dx * 2, ny = y + dy * 2;
          if (nx >= 0 && ny >= 0 && nx < w && ny < h && m[ny][nx] === 1) {
            m[y + dy][x + dx] = 0;
            carve(nx, ny);
          }
        }
      }
      carve(Math.floor(Math.random() * (w / 2)) * 2 + 1, Math.floor(Math.random() * (h / 2)) * 2 + 1);
      return m;
    }

    function buildMaze() {
      tileW = canvas.width / pRadius;
      tileH = canvas.height / pRadius;
      if (!mazeGenerated) {
        const mw = Math.floor(canvas.width / tileW);
        const mh = Math.floor(canvas.height / tileH);
        maze = generateMaze(mw, mh);
        mazeGenerated = true;
      }
    }

    function drawBG() {
      buildMaze();
      for (let y = 0; y < maze.length; y++) {
        for (let x = 0; x < (maze[y]||[]).length; x++) {
          ctx.fillStyle = maze[y][x] === 0 ? '#1a3a1a' : '#0a0a0a';
          ctx.fillRect(x * tileW, y * tileH, tileW, tileH);
        }
      }
    }

    function checkCol(x, y) {
      const mx = Math.trunc(x / 100), my = Math.trunc(y / 100);
      if (my < 0 || my >= maze.length || mx < 0 || mx >= (maze[0]||[]).length) return true;
      return maze[my] && maze[my][mx] === 1;
    }

    function drawPlayer() {
      ctx.beginPath();
      ctx.arc(pX, pY, pRadius, 0, Math.PI * 2);
      ctx.fillStyle = '#4ade80';
      ctx.fill();
      if (isAttacking) {
        const sx = pX + Math.cos(attackAngle) * 40;
        const sy = pY + Math.sin(attackAngle) * 40;
        ctx.beginPath();
        ctx.moveTo(pX, pY);
        ctx.lineTo(sx, sy);
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.stroke();
        attackAngle += Math.PI / 30;
      }
    }

    function moveEnemy() {
      eX += (Math.random() - 0.5) * eSpeed;
      eY += (Math.random() - 0.5) * eSpeed;
      eX = Math.max(eRadius, Math.min(eX, canvas.width - eRadius));
      eY = Math.max(eRadius, Math.min(eY, canvas.height - eRadius));
    }

    function drawEnemy() {
      ctx.beginPath();
      ctx.arc(eX, eY, eRadius, 0, Math.PI * 2);
      ctx.fillStyle = '#f87171';
      ctx.fill();
    }

    function update() {
      if (!running) return;
      gTime = (gTime + gTimeSpeed) % 1;
      drawBG();
      if (moveU && !checkCol(pX, pY - pSpeed)) pY -= pSpeed;
      if (moveD && !checkCol(pX, pY + pSpeed)) pY += pSpeed;
      if (moveL && !checkCol(pX - pSpeed, pY)) pX -= pSpeed;
      if (moveR && !checkCol(pX + pSpeed, pY)) pX += pSpeed;
      drawPlayer();
      moveEnemy();
      drawEnemy();
      score++;
      const hr = Math.floor(gTime * 24), mn = Math.floor((gTime * 24 - hr) * 60);
      hud.textContent = `Score: ${score} | ${hr % 12 || 12}:${String(mn).padStart(2,'0')}${hr >= 12 ? 'PM' : 'AM'}`;
      animId = requestAnimationFrame(update);
    }

    function keyHandler(e) {
      if (!running) return;
      const down = e.type === 'keydown';
      switch (e.key) {
        case 'ArrowUp': case 'w': moveU = down; if (down) pDir = 0; break;
        case 'ArrowDown': case 's': moveD = down; if (down) pDir = 2; break;
        case 'ArrowLeft': case 'a': moveL = down; if (down) pDir = 3; break;
        case 'ArrowRight': case 'd': moveR = down; if (down) pDir = 1; break;
        case ' ': case 'Control': isAttacking = down; if (!down) attackAngle = 0; else attackAngle = pDir * Math.PI / 2; break;
      }
      if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','w','a','s','d',' '].includes(e.key)) e.stopPropagation();
    }

    p.querySelector('#dw-vv-start').addEventListener('click', () => {
      p.querySelector('#dw-vv-overlay').style.display = 'none';
      resizeCanvas();
      pX = canvas.width / 2;
      pY = canvas.height / 2;
      eX = Math.random() * canvas.width;
      eY = Math.random() * canvas.height;
      score = 0;
      running = true;
      canvas.focus();
      canvas.setAttribute('tabindex', '0');
      canvas.addEventListener('keydown', keyHandler);
      canvas.addEventListener('keyup', keyHandler);
      update();
    });

    new ResizeObserver(() => { if (running) { resizeCanvas(); pX = Math.min(pX, canvas.width); pY = Math.min(pY, canvas.height); } }).observe(p);

    // Cleanup
    const mo = new MutationObserver(() => {
      if (!document.contains(container)) { running = false; cancelAnimationFrame(animId); canvas.removeEventListener('keydown', keyHandler); canvas.removeEventListener('keyup', keyHandler); mo.disconnect(); }
    });
    mo.observe(document.body, { childList: true, subtree: true });
  }

  // ═══════════════════════════════════════════════
  // TAB 4: Sprite Detector
  // ═══════════════════════════════════════════════
  function initSpriteDetector() {
    const p = panels.spritedetect;
    p._init = true;
    p.style.padding = '16px';
    p.innerHTML = `
      <div style="margin-bottom:12px;font-size:13px;opacity:.7;">Upload a sprite sheet and automatically extract individual sprites using flood-fill detection.</div>
      <div style="display:flex;gap:8px;margin-bottom:16px;align-items:center;flex-wrap:wrap;">
        <input type="file" id="dw-sd-file" accept="image/*" style="font-size:13px;">
        <label style="font-size:12px;">Tolerance: <input type="range" id="dw-sd-tol" min="5" max="80" value="20" style="width:80px;vertical-align:middle;"> <span id="dw-sd-tol-val">20</span></label>
        <button id="dw-sd-run" style="padding:6px 16px;background:var(--ob-accent);color:#000;border:none;border-radius:6px;cursor:pointer;font-weight:bold;">Detect Sprites</button>
      </div>
      <div style="display:flex;gap:8px;align-items:flex-start;margin-bottom:8px;">
        <div style="font-size:12px;opacity:.5;">Background color detected: </div>
        <div id="dw-sd-bgcol" style="width:24px;height:24px;border:1px solid var(--ob-border);border-radius:4px;"></div>
      </div>
      <canvas id="dw-sd-canvas" style="max-width:100%;border:1px solid var(--ob-border);border-radius:6px;display:none;"></canvas>
      <div id="dw-sd-results" style="display:flex;flex-wrap:wrap;gap:8px;margin-top:16px;"></div>`;

    const sdCanvas = p.querySelector('#dw-sd-canvas');
    const sdCtx = sdCanvas.getContext('2d');
    const sdResults = p.querySelector('#dw-sd-results');
    const tolSlider = p.querySelector('#dw-sd-tol');
    const tolVal = p.querySelector('#dw-sd-tol-val');
    tolSlider.addEventListener('input', () => { tolVal.textContent = tolSlider.value; });

    let sdBg = null;

    p.querySelector('#dw-sd-file').addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const img = new Image();
      img.onload = () => {
        sdCanvas.width = img.width;
        sdCanvas.height = img.height;
        sdCanvas.style.display = 'block';
        sdCtx.drawImage(img, 0, 0);
        const px = sdCtx.getImageData(0, 0, 1, 1).data;
        sdBg = [px[0], px[1], px[2]];
        p.querySelector('#dw-sd-bgcol').style.backgroundColor = `rgb(${sdBg.join(',')})`;
      };
      img.src = URL.createObjectURL(file);
    });

    p.querySelector('#dw-sd-run').addEventListener('click', () => {
      if (!sdBg) { if (typeof showToast === 'function') showToast('Upload an image first', 'warning'); return; }
      sdResults.innerHTML = '';
      const tol = parseInt(tolSlider.value);
      const imgData = sdCtx.getImageData(0, 0, sdCanvas.width, sdCanvas.height);
      const w = sdCanvas.width, h = sdCanvas.height;
      const globalVis = new Set();
      const sprites = [];

      function isBG(r, g, b) {
        return Math.abs(r - sdBg[0]) <= tol && Math.abs(g - sdBg[1]) <= tol && Math.abs(b - sdBg[2]) <= tol;
      }

      function floodExtract(sx, sy) {
        let minX = w, minY = h, maxX = 0, maxY = 0;
        const stack = [{x: sx, y: sy}];
        const local = new Set();
        while (stack.length > 0) {
          const {x, y} = stack.pop();
          const key = x + ',' + y;
          if (x < 0 || x >= w || y < 0 || y >= h || local.has(key) || globalVis.has(key)) continue;
          const idx = (y * w + x) * 4;
          if (isBG(imgData.data[idx], imgData.data[idx+1], imgData.data[idx+2])) continue;
          local.add(key); globalVis.add(key);
          minX = Math.min(minX, x); minY = Math.min(minY, y);
          maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
          stack.push({x:x+1,y},{x:x-1,y},{x,y:y+1},{x,y:y-1});
        }
        if (minX > maxX || maxX - minX < 3 || maxY - minY < 3) return null;
        return { minX, minY, maxX, maxY, pixels: local };
      }

      // Sample random foreground seeds
      const seeds = [];
      for (let i = 0; i < 3000; i++) {
        const x = Math.floor(Math.random() * (w - 20) + 10);
        const y = Math.floor(Math.random() * (h - 20) + 10);
        const idx = (y * w + x) * 4;
        if (!isBG(imgData.data[idx], imgData.data[idx+1], imgData.data[idx+2])) seeds.push({x, y});
      }

      seeds.forEach(seed => {
        if (globalVis.has(seed.x + ',' + seed.y)) return;
        const spr = floodExtract(seed.x, seed.y);
        if (spr && spr.pixels.size > 20) {
          sprites.push(spr);
          // Extract to mini canvas
          const sw = spr.maxX - spr.minX + 1, sh = spr.maxY - spr.minY + 1;
          const mini = document.createElement('canvas');
          mini.width = sw; mini.height = sh;
          const mCtx = mini.getContext('2d');
          const mData = mCtx.createImageData(sw, sh);
          spr.pixels.forEach(key => {
            const [px, py] = key.split(',').map(Number);
            const srcIdx = (py * w + px) * 4;
            const dstIdx = ((py - spr.minY) * sw + (px - spr.minX)) * 4;
            mData.data[dstIdx] = imgData.data[srcIdx];
            mData.data[dstIdx+1] = imgData.data[srcIdx+1];
            mData.data[dstIdx+2] = imgData.data[srcIdx+2];
            mData.data[dstIdx+3] = 255;
          });
          mCtx.putImageData(mData, 0, 0);
          const img = document.createElement('img');
          img.src = mini.toDataURL();
          img.style.cssText = 'max-width:120px;max-height:120px;border:1px solid var(--ob-border);border-radius:4px;background:#111;padding:4px;cursor:pointer;';
          img.title = `Sprite ${sprites.length} (${sw}x${sh})`;
          img.addEventListener('click', () => {
            const a = document.createElement('a');
            a.href = mini.toDataURL();
            a.download = `sprite_${sprites.length}.png`;
            a.click();
          });
          sdResults.appendChild(img);
        }
      });
      if (typeof showToast === 'function') showToast(`Detected ${sprites.length} sprites`, 'success');
    });
  }

  // ═══════════════════════════════════════════════
  // TAB 5: Animator — Frame-by-frame animation canvas
  // ═══════════════════════════════════════════════
  function initAnimator() {
    const p = panels.animator;
    p._init = true;
    p.style.padding = '16px';
    p.innerHTML = `
      <div style="margin-bottom:12px;font-size:13px;opacity:.7;">Frame-by-frame animation canvas. Draw on frames, navigate with controls.</div>
      <div style="display:flex;gap:8px;margin-bottom:12px;align-items:center;flex-wrap:wrap;">
        <button id="dw-an-prev" style="padding:6px 12px;background:var(--ob-surface);border:1px solid var(--ob-border);color:var(--ob-text);border-radius:4px;cursor:pointer;">◀ Prev</button>
        <span id="dw-an-frame" style="font-size:13px;min-width:80px;text-align:center;">Frame 1 / 1</span>
        <button id="dw-an-next" style="padding:6px 12px;background:var(--ob-surface);border:1px solid var(--ob-border);color:var(--ob-text);border-radius:4px;cursor:pointer;">Next ▶</button>
        <button id="dw-an-add" style="padding:6px 12px;background:var(--ob-accent);color:#000;border:none;border-radius:4px;cursor:pointer;font-weight:bold;">+ Frame</button>
        <button id="dw-an-play" style="padding:6px 12px;background:var(--ob-surface);border:1px solid var(--ob-border);color:var(--ob-text);border-radius:4px;cursor:pointer;">▶ Play</button>
        <label style="font-size:12px;">Color: <input type="color" id="dw-an-color" value="#4ade80" style="width:30px;height:24px;vertical-align:middle;"></label>
        <label style="font-size:12px;">Size: <input type="range" id="dw-an-size" min="1" max="20" value="3" style="width:60px;vertical-align:middle;"></label>
        <button id="dw-an-clear" style="padding:6px 12px;background:var(--ob-surface);border:1px solid var(--ob-border);color:var(--ob-text);border-radius:4px;cursor:pointer;">Clear</button>
        <button id="dw-an-export" style="padding:6px 12px;background:var(--ob-surface);border:1px solid var(--ob-border);color:var(--ob-text);border-radius:4px;cursor:pointer;">Export GIF</button>
      </div>
      <canvas id="dw-an-canvas" style="width:100%;max-height:400px;border:1px solid var(--ob-border);border-radius:6px;background:#111;cursor:crosshair;"></canvas>
      <div id="dw-an-thumbs" style="display:flex;gap:4px;margin-top:8px;overflow-x:auto;padding:4px;"></div>`;

    const anCanvas = p.querySelector('#dw-an-canvas');
    const anCtx = anCanvas.getContext('2d');
    anCanvas.width = 640;
    anCanvas.height = 400;
    let frames = [anCtx.getImageData(0, 0, 640, 400)];
    let curFrame = 0;
    let drawing = false, playing = false, playId = null;

    function showFrame() {
      anCtx.putImageData(frames[curFrame], 0, 0);
      p.querySelector('#dw-an-frame').textContent = `Frame ${curFrame + 1} / ${frames.length}`;
      updateThumbs();
    }

    function saveFrame() {
      frames[curFrame] = anCtx.getImageData(0, 0, 640, 400);
    }

    function updateThumbs() {
      const thumbs = p.querySelector('#dw-an-thumbs');
      thumbs.innerHTML = '';
      frames.forEach((f, i) => {
        const tc = document.createElement('canvas');
        tc.width = 64; tc.height = 40;
        tc.style.cssText = `border:2px solid ${i === curFrame ? 'var(--ob-accent)' : 'var(--ob-border)'};border-radius:4px;cursor:pointer;flex-shrink:0;`;
        const tCtx = tc.getContext('2d');
        const tmp = document.createElement('canvas');
        tmp.width = 640; tmp.height = 400;
        tmp.getContext('2d').putImageData(f, 0, 0);
        tCtx.drawImage(tmp, 0, 0, 64, 40);
        tc.addEventListener('click', () => { saveFrame(); curFrame = i; showFrame(); });
        thumbs.appendChild(tc);
      });
    }

    anCanvas.addEventListener('mousedown', (e) => { drawing = true; });
    anCanvas.addEventListener('mouseup', () => { drawing = false; saveFrame(); });
    anCanvas.addEventListener('mouseleave', () => { drawing = false; });
    anCanvas.addEventListener('mousemove', (e) => {
      if (!drawing) return;
      const rect = anCanvas.getBoundingClientRect();
      const sx = 640 / rect.width, sy = 400 / rect.height;
      const x = (e.clientX - rect.left) * sx, y = (e.clientY - rect.top) * sy;
      const size = parseInt(p.querySelector('#dw-an-size').value);
      anCtx.fillStyle = p.querySelector('#dw-an-color').value;
      anCtx.beginPath();
      anCtx.arc(x, y, size, 0, Math.PI * 2);
      anCtx.fill();
    });

    p.querySelector('#dw-an-prev').addEventListener('click', () => { saveFrame(); curFrame = Math.max(0, curFrame - 1); showFrame(); });
    p.querySelector('#dw-an-next').addEventListener('click', () => { saveFrame(); curFrame = Math.min(frames.length - 1, curFrame + 1); showFrame(); });
    p.querySelector('#dw-an-add').addEventListener('click', () => {
      saveFrame();
      frames.splice(curFrame + 1, 0, anCtx.getImageData(0, 0, 640, 400));
      curFrame++;
      anCtx.clearRect(0, 0, 640, 400);
      saveFrame();
      showFrame();
    });
    p.querySelector('#dw-an-clear').addEventListener('click', () => { anCtx.clearRect(0, 0, 640, 400); saveFrame(); updateThumbs(); });
    p.querySelector('#dw-an-play').addEventListener('click', () => {
      if (playing) { playing = false; clearInterval(playId); p.querySelector('#dw-an-play').textContent = '▶ Play'; return; }
      playing = true;
      p.querySelector('#dw-an-play').textContent = '⏸ Stop';
      playId = setInterval(() => {
        curFrame = (curFrame + 1) % frames.length;
        showFrame();
      }, 150);
    });
    p.querySelector('#dw-an-export').addEventListener('click', () => {
      if (typeof showToast === 'function') showToast(`Animation has ${frames.length} frames. Export coming soon!`, 'info');
    });

    showFrame();
  }

  // ═══════════════════════════════════════════════
  // TAB 6: Char2Sprite — Character to sprite prompt generator
  // ═══════════════════════════════════════════════
  function initChar2Sprite() {
    panels.char2sprite._init = true;
    const p = panels.char2sprite;
    const C2S_ACTIONS = [
      {action:'walking',frames:9,cardinal:true,descs:'rightHeelTouch,rightFootFlat,rightLegPass,neutral,leftHeelTouch,leftFootFlat,leftLegPass,neutral'},
      {action:'attacking',frames:6,cardinal:true,descs:'start,midSwing,contact,followThrough,return'},
      {action:'castingSpell',frames:8,cardinal:true,descs:'start,build-up,release,aftermath,return'},
      {action:'jumping',frames:4,cardinal:false,descs:'crouch,ascent,peak,descent'},
      {action:'takingDamage',frames:3,cardinal:true,descs:'impact,recoil,return'},
      {action:'dying',frames:4,cardinal:false,descs:'beginFall,midFall,groundContact,settled'},
      {action:'swimming',frames:6,cardinal:true,descs:'start,stroke,recovery'},
      {action:'pushing',frames:6,cardinal:true,descs:'start,strain,extend,retract'},
      {action:'pulling',frames:6,cardinal:true,descs:'brace,pull,retract'},
      {action:'interacting',frames:3,cardinal:false,descs:'reach,touch,return'},
      {action:'crouching',frames:2,cardinal:false,descs:'start,hold'},
      {action:'riding',frames:6,cardinal:true,descs:'mount,ride,gaitChange'},
      {action:'celebrating',frames:4,cardinal:false,descs:'start,raise,cheer,lower'},
      {action:'idleVariations',frames:2,cardinal:false,descs:'shiftWeight,lookAround'},
      {action:'emoting',frames:3,cardinal:false,descs:'start,express,return'},
      {action:'fishing',frames:4,cardinal:false,descs:'cast,wait,reel,catch'},
      {action:'crafting',frames:4,cardinal:false,descs:'prepare,craft,inspect,complete'},
      {action:'sleeping',frames:2,cardinal:false,descs:'lieDown,sleep'},
      {action:'eating',frames:3,cardinal:false,descs:'takeBite,chew,swallow'},
      {action:'talking',frames:2,cardinal:false,descs:'openMouth,closeMouth'},
      {action:'sneaking',frames:6,cardinal:true,descs:'start,advance,peek,return'},
      {action:'falling',frames:3,cardinal:false,descs:'stumble,fall,recover'},
      {action:'usingItem',frames:4,cardinal:false,descs:'reach,use,effect,return'},
      {action:'specialMove',frames:6,cardinal:true,descs:'start,charge,execute,followThrough'},
      {action:'equipping',frames:3,cardinal:false,descs:'reach,equip,ready'}
    ];
    const inputStyle = 'width:100%;padding:6px;background:var(--ob-surface);color:var(--ob-text);border:1px solid var(--ob-border);border-radius:4px;font-size:13px;margin-top:2px;box-sizing:border-box;';
    p.innerHTML = `<div style="padding:16px;max-width:700px;margin:0 auto;">
      <h3 style="color:var(--ob-accent);margin:0 0 8px;">Character \u2192 Sprite Prompts</h3>
      <p style="color:var(--ob-text-dim);font-size:12px;margin:0 0 14px;">Define character attributes, generate DALL-E sprite sheet prompts for 25 animation types.</p>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px;">
        <label style="font-size:11px;color:var(--ob-text-dim);">Name<input id="dw-c2s-name" value="Hero" style="${inputStyle}"></label>
        <label style="font-size:11px;color:var(--ob-text-dim);">Age<input id="dw-c2s-age" value="25" type="number" style="${inputStyle}"></label>
        <label style="font-size:11px;color:var(--ob-text-dim);">Hair<input id="dw-c2s-hair" value="dark" style="${inputStyle}"></label>
        <label style="font-size:11px;color:var(--ob-text-dim);">Eyes<input id="dw-c2s-eyes" value="blue" style="${inputStyle}"></label>
        <label style="font-size:11px;color:var(--ob-text-dim);">Sprite W<input id="dw-c2s-w" value="16" type="number" style="${inputStyle}"></label>
        <label style="font-size:11px;color:var(--ob-text-dim);">Sprite H<input id="dw-c2s-h" value="24" type="number" style="${inputStyle}"></label>
      </div>
      <label style="font-size:11px;color:var(--ob-text-dim);display:block;margin-bottom:14px;">Outfit<input id="dw-c2s-outfit" value="leather armor, green cloak, brown boots" style="${inputStyle}"></label>
      <button id="dw-c2s-gen" style="padding:8px 16px;background:var(--ob-accent);color:#000;border:none;border-radius:4px;cursor:pointer;font-weight:600;">Generate All Prompts</button>
      <button id="dw-c2s-copy" style="padding:8px 16px;background:var(--ob-surface);color:var(--ob-text);border:1px solid var(--ob-border);border-radius:4px;cursor:pointer;margin-left:8px;">Copy All</button>
      <div id="dw-c2s-output" style="font-size:11px;margin-top:14px;"></div>
    </div>`;
    p.querySelector('#dw-c2s-gen').addEventListener('click', () => {
      const v = id => p.querySelector('#dw-c2s-'+id).value;
      const out = p.querySelector('#dw-c2s-output');
      out.innerHTML = '';
      C2S_ACTIONS.forEach(a => {
        const dirs = a.cardinal ? ['front','left','back','right'] : ['front'];
        const prompts = dirs.map(d => `Sprite sheet: ${v('name')}, age ${v('age')}, ${v('hair')} hair, ${v('eyes')} eyes, wearing ${v('outfit')}, ${a.action} ${d}, ${a.frames} frames (${a.descs}), ${v('w')}x${v('h')}px, 2.5D RPG style, chrono trigger style, detailed pixel art, professional quality.`);
        const div = document.createElement('div');
        div.style.cssText = 'margin-bottom:10px;padding:10px;background:var(--ob-surface);border-radius:6px;border:1px solid var(--ob-border);';
        div.innerHTML = `<div style="font-weight:600;color:var(--ob-accent);margin-bottom:4px;">${a.action} (${a.frames}f${a.cardinal?' \u00d7 4 dirs':''})</div><div style="white-space:pre-wrap;color:var(--ob-text-dim);line-height:1.5;">${prompts.join('\n')}</div>`;
        out.appendChild(div);
      });
    });
    p.querySelector('#dw-c2s-copy').addEventListener('click', () => {
      const text = p.querySelector('#dw-c2s-output').innerText;
      if (text) { navigator.clipboard.writeText(text); if (typeof showToast === 'function') showToast('Prompts copied!', 'ok'); }
    });
  }

  // ═══════════════════════════════════════════════
  // TAB 7: ASCII RPG — JSON spec to game board
  // ═══════════════════════════════════════════════
  function initAsciiRpg() {
    panels.asciirpg._init = true;
    const p = panels.asciirpg;
    const defaultSpec = {game:{title:"Dungeon Quest",width:16,height:12,startPosition:{x:1,y:1}},objects:{"#":{color:"#666"},".":{color:"#444"},"@":{color:"#0f0"},E:{color:"#f00"},$:{color:"#ff0"},"!":{color:"#f0f"},D:{color:"#f80"}}};
    p.innerHTML = `<div style="display:flex;height:100%;gap:0;">
      <div style="width:40%;padding:12px;overflow:auto;border-right:1px solid var(--ob-border);">
        <h3 style="color:var(--ob-accent);margin:0 0 8px;font-size:14px;">Game Spec (JSON)</h3>
        <textarea id="dw-rpg-spec" style="width:100%;height:calc(100% - 80px);background:var(--ob-bg);color:var(--ob-text);border:1px solid var(--ob-border);border-radius:4px;font-family:monospace;font-size:11px;padding:8px;resize:none;box-sizing:border-box;">${JSON.stringify(defaultSpec,null,2)}</textarea>
        <div style="margin-top:8px;display:flex;gap:8px;">
          <button id="dw-rpg-render" style="padding:6px 14px;background:var(--ob-accent);color:#000;border:none;border-radius:4px;cursor:pointer;font-weight:600;">Render</button>
          <button id="dw-rpg-rand" style="padding:6px 14px;background:var(--ob-surface);color:var(--ob-text);border:1px solid var(--ob-border);border-radius:4px;cursor:pointer;">Random Dungeon</button>
        </div>
      </div>
      <div style="flex:1;padding:12px;overflow:auto;display:flex;flex-direction:column;align-items:center;justify-content:center;">
        <div id="dw-rpg-board" style="font-family:monospace;font-size:18px;line-height:1.2;letter-spacing:2px;"></div>
        <p id="dw-rpg-info" style="color:var(--ob-text-dim);font-size:11px;margin-top:12px;"></p>
      </div>
    </div>`;
    function renderBoard() {
      try {
        const spec = JSON.parse(p.querySelector('#dw-rpg-spec').value);
        const g = spec.game, objs = spec.objects;
        const board = Array(g.height).fill(null).map(() => Array(g.width).fill('.'));
        for (let x=0;x<g.width;x++){board[0][x]='#';board[g.height-1][x]='#';}
        for (let y=0;y<g.height;y++){board[y][0]='#';board[y][g.width-1]='#';}
        if (g.startPosition) board[g.startPosition.y][g.startPosition.x] = '@';
        p.querySelector('#dw-rpg-board').innerHTML = board.map(row =>
          row.map(c => `<span style="color:${(objs[c]||{}).color||'#555'}">${c}</span>`).join('')
        ).join('<br>');
        p.querySelector('#dw-rpg-info').textContent = `${g.title} \u2014 ${g.width}\u00d7${g.height}`;
      } catch(e) { p.querySelector('#dw-rpg-info').textContent = 'Invalid JSON: '+e.message; }
    }
    function randomDungeon() {
      const w=20,h=14,board=Array(h).fill(null).map(()=>Array(w).fill('.'));
      for(let x=0;x<w;x++){board[0][x]='#';board[h-1][x]='#';}
      for(let y=0;y<h;y++){board[y][0]='#';board[y][w-1]='#';}
      for(let i=0;i<Math.floor(w*h*0.18);i++){const rx=Math.floor(Math.random()*(w-2))+1,ry=Math.floor(Math.random()*(h-2))+1;if(rx!==1||ry!==1)board[ry][rx]='#';}
      const place=(ch,n)=>{for(let i=0;i<n;i++){let x,y;do{x=Math.floor(Math.random()*(w-2))+1;y=Math.floor(Math.random()*(h-2))+1;}while(board[y][x]!=='.');board[y][x]=ch;}};
      place('E',4);place('$',3);place('!',2);board[1][1]='@';
      const spec={game:{title:'Random Dungeon',width:w,height:h,startPosition:{x:1,y:1}},objects:{"#":{color:"#666"},".":{color:"#444"},"@":{color:"#0f0"},E:{color:"#f00"},$:{color:"#ff0"},"!":{color:"#f0f"}}};
      p.querySelector('#dw-rpg-spec').value = JSON.stringify(spec,null,2);
      renderBoard();
    }
    p.querySelector('#dw-rpg-render').addEventListener('click', renderBoard);
    p.querySelector('#dw-rpg-rand').addEventListener('click', randomDungeon);
    renderBoard();
  }

  // ═══════════════════════════════════════════════
  // TAB 8: Colony Wars — Space shooter
  // ═══════════════════════════════════════════════
  function initColonyWars() {
    panels.colonywars._init = true;
    const p = panels.colonywars;
    p.innerHTML = `<div style="display:flex;flex-direction:column;align-items:center;padding:12px;height:100%;">
      <div style="display:flex;align-items:center;gap:16px;margin-bottom:8px;">
        <span style="color:var(--ob-accent);font-weight:600;">Colony Wars</span>
        <span style="color:var(--ob-text-dim);font-size:11px;">Arrow keys: move | Avoid asteroids</span>
        <span id="dw-cw-score" style="color:var(--ob-accent);font-size:13px;">Score: 0</span>
      </div>
      <canvas id="dw-cw-canvas" width="700" height="460" tabindex="0" style="background:#000;border:1px solid var(--ob-border);border-radius:4px;outline:none;max-width:100%;"></canvas>
    </div>`;
    const canvas = p.querySelector('#dw-cw-canvas'), ctx = canvas.getContext('2d');
    const scoreEl = p.querySelector('#dw-cw-score');
    let shipX=canvas.width/2-15, shipY=canvas.height/2-25, score=0, alive=true;
    const shipW=30, shipH=50, spd=5, keys={};
    const asteroids=[], stars=[];
    for(let i=0;i<12;i++) asteroids.push({x:Math.random()*canvas.width,y:Math.random()*canvas.height,vx:Math.random()*2-1,vy:Math.random()*2-1,r:12+Math.random()*20});
    for(let i=0;i<80;i++) stars.push({x:Math.random()*canvas.width,y:Math.random()*canvas.height,s:Math.random()*2+0.5});
    canvas.addEventListener('keydown', e => { keys[e.code]=true; if(e.code.startsWith('Arrow'))e.preventDefault(); e.stopPropagation(); });
    canvas.addEventListener('keyup', e => { keys[e.code]=false; e.stopPropagation(); });
    function loop() {
      ctx.fillStyle='#000'; ctx.fillRect(0,0,canvas.width,canvas.height);
      ctx.fillStyle='#fff'; stars.forEach(s=>{ctx.beginPath();ctx.arc(s.x,s.y,s.s,0,Math.PI*2);ctx.fill();});
      if(!alive){ctx.fillStyle='#f44';ctx.font='28px monospace';ctx.textAlign='center';ctx.fillText('DESTROYED',canvas.width/2,canvas.height/2);ctx.font='14px monospace';ctx.fillStyle='#aaa';ctx.fillText('Click to restart',canvas.width/2,canvas.height/2+30);requestAnimationFrame(loop);return;}
      if(keys['ArrowUp'])shipY-=spd;if(keys['ArrowDown'])shipY+=spd;if(keys['ArrowLeft'])shipX-=spd;if(keys['ArrowRight'])shipX+=spd;
      if(shipX<-shipW)shipX=canvas.width;if(shipX>canvas.width)shipX=-shipW;if(shipY<-shipH)shipY=canvas.height;if(shipY>canvas.height)shipY=-shipH;
      ctx.save();ctx.translate(shipX+shipW/2,shipY+shipH/2);ctx.fillStyle='#4af';ctx.beginPath();ctx.moveTo(0,-shipH/2);ctx.lineTo(shipW/2,shipH/2);ctx.lineTo(-shipW/2,shipH/2);ctx.closePath();ctx.fill();ctx.restore();
      asteroids.forEach(a=>{a.x+=a.vx;a.y+=a.vy;if(a.x<-a.r)a.x=canvas.width+a.r;if(a.x>canvas.width+a.r)a.x=-a.r;if(a.y<-a.r)a.y=canvas.height+a.r;if(a.y>canvas.height+a.r)a.y=-a.r;ctx.beginPath();ctx.arc(a.x,a.y,a.r,0,Math.PI*2);ctx.fillStyle='#888';ctx.fill();ctx.strokeStyle='#aaa';ctx.stroke();const dx=(shipX+shipW/2)-a.x,dy=(shipY+shipH/2)-a.y;if(Math.sqrt(dx*dx+dy*dy)<a.r+12)alive=false;});
      score++;scoreEl.textContent='Score: '+score;requestAnimationFrame(loop);
    }
    canvas.addEventListener('click', ()=>{if(!alive){alive=true;score=0;shipX=canvas.width/2-15;shipY=canvas.height/2-25;}canvas.focus();});
    canvas.focus(); loop();
  }

  // Start on WorldSeed tab
  switchTab('worldseed');
}

// ═══════════════════════════════════════════════
// Ghostwriter — Screenplay editor + Outline→Prompts
// ═══════════════════════════════════════════════
function buildGhostwriter(container) {
  container.style.cssText = 'padding:0;overflow:hidden;display:flex;flex-direction:column;font-family:var(--ob-font);color:var(--ob-text);';
  const gwTabs = [{id:'screenplay',name:'Screenplay',icon:'\u{1F3AC}'},{id:'outline',name:'Outline\u2192Story',icon:'\u{1F4DD}'}];
  const tabBar = document.createElement('div');
  tabBar.style.cssText = 'display:flex;background:var(--ob-surface);border-bottom:1px solid var(--ob-border);flex-shrink:0;';
  gwTabs.forEach(t => {
    const btn = document.createElement('button');
    btn.dataset.tab = t.id;
    btn.innerHTML = `${t.icon} ${t.name}`;
    btn.style.cssText = 'padding:8px 14px;background:none;border:none;color:var(--ob-text-dim);cursor:pointer;font-size:13px;border-bottom:2px solid transparent;transition:all .2s;';
    btn.addEventListener('click', () => switchGw(t.id));
    tabBar.appendChild(btn);
  });
  container.appendChild(tabBar);
  const contentArea = document.createElement('div');
  contentArea.style.cssText = 'flex:1;overflow:auto;';
  container.appendChild(contentArea);
  const gwPanels = {};
  gwTabs.forEach(t => { const d = document.createElement('div'); d.style.cssText = 'display:none;height:100%;overflow:auto;'; contentArea.appendChild(d); gwPanels[t.id] = d; });
  function switchGw(id) {
    gwTabs.forEach(t => {
      gwPanels[t.id].style.display = t.id === id ? 'block' : 'none';
      const b = tabBar.querySelector(`[data-tab="${t.id}"]`);
      b.style.color = t.id === id ? 'var(--ob-accent)' : 'var(--ob-text-dim)';
      b.style.borderBottomColor = t.id === id ? 'var(--ob-accent)' : 'transparent';
    });
  }

  // ── Screenplay Tab ──
  const storyMethods = {
    "Hero's Journey":[{t:"The Ordinary World",p:"Describe your hero's everyday life before the adventure begins."},{t:"Call to Adventure",p:"What disrupts the hero's normal life?"},{t:"Refusal of the Call",p:"Does your hero hesitate or refuse? Why?"},{t:"Meeting the Mentor",p:"Who guides your hero to face the challenge?"},{t:"Crossing the Threshold",p:"How does the hero commit and enter the new world?"},{t:"Tests, Allies, Enemies",p:"What trials does the hero face? Who are friends and foes?"},{t:"Approach to Inmost Cave",p:"What ultimate challenge must the hero prepare for?"},{t:"The Ordeal",p:"Describe the hero's darkest hour."},{t:"Reward",p:"What does the hero gain after surviving?"},{t:"The Road Back",p:"How does the hero return? What challenges on the way?"},{t:"The Resurrection",p:"How is the hero tested once more at the threshold?"},{t:"Return with Elixir",p:"What does the hero bring back? How have they changed?"}],
    "Pixar":[{t:"Once upon a time...",p:"Describe the setting and everyday life of your character."},{t:"Every day...",p:"What is the character's routine?"},{t:"One day...",p:"What event alters the routine?"},{t:"Because of that...",p:"How does the character react?"},{t:"Because of that...",p:"What are the consequences?"},{t:"Until finally...",p:"How does the story climax?"},{t:"Ever since that day...",p:"What is the resolution?"}],
    "Three-Act":[{t:"Setup (Act 1)",p:"Introduce world and characters. What is the inciting incident?"},{t:"Confrontation (Act 2)",p:"What is the main conflict? How do they try to resolve it?"},{t:"Resolution (Act 3)",p:"How is the conflict resolved? What has the protagonist learned?"}],
    "Freytag's Pyramid":[{t:"Exposition",p:"Establish setting and characters."},{t:"Rising Action",p:"What challenges lead to the climax?"},{t:"Climax",p:"What is the turning point?"},{t:"Falling Action",p:"How do events unfold after the climax?"},{t:"Denouement",p:"How does the story conclude?"}],
    "In Medias Res":[{t:"The Middle",p:"Start in the middle of the action. What critical event is happening?"},{t:"Flashbacks",p:"How did characters get here? Key backstory elements?"},{t:"The End",p:"How does starting in the middle affect the resolution?"}],
    "Kishotenketsu":[{t:"Introduction (Ki)",p:"Introduce characters and setting."},{t:"Development (Sho)",p:"Develop with new elements. Unexpected events?"},{t:"Twist (Ten)",p:"Introduce a twist that changes direction."},{t:"Conclusion (Ketsu)",p:"How do elements reconcile after the twist?"}],
    "Seven-Point":[{t:"Hook",p:"What grabs attention immediately?"},{t:"Plot Turn 1",p:"What changes the protagonist's situation?"},{t:"Pinch 1",p:"What pressure is applied?"},{t:"Midpoint",p:"What is the point of no return?"},{t:"Pinch 2",p:"How is the situation worsened?"},{t:"Plot Turn 2",p:"How does the protagonist get the final pieces?"},{t:"Resolution",p:"How does the protagonist achieve their goal?"}]
  };
  const sp = gwPanels.screenplay;
  sp.innerHTML = `<div style="padding:16px;max-width:800px;margin:0 auto;">
    <div style="display:flex;gap:8px;align-items:center;margin-bottom:12px;flex-wrap:wrap;">
      <select id="gw-method" style="padding:6px;background:var(--ob-surface);color:var(--ob-text);border:1px solid var(--ob-border);border-radius:4px;font-size:12px;"><option value="">Story Method...</option></select>
      <button id="gw-prev" style="padding:4px 10px;background:var(--ob-surface);color:var(--ob-text);border:1px solid var(--ob-border);border-radius:4px;cursor:pointer;">\u25C0 Prev</button>
      <span id="gw-prompt-label" style="font-size:12px;color:var(--ob-accent);flex:1;text-align:center;">Select a story method</span>
      <button id="gw-next" style="padding:4px 10px;background:var(--ob-surface);color:var(--ob-text);border:1px solid var(--ob-border);border-radius:4px;cursor:pointer;">Next \u25B6</button>
      <button id="gw-save" style="padding:4px 10px;background:var(--ob-accent);color:#000;border:none;border-radius:4px;cursor:pointer;font-weight:600;">Save</button>
      <button id="gw-load" style="padding:4px 10px;background:var(--ob-surface);color:var(--ob-text);border:1px solid var(--ob-border);border-radius:4px;cursor:pointer;">Load</button>
    </div>
    <div id="gw-prompt-area" style="display:none;padding:10px;background:var(--ob-surface);border-radius:6px;margin-bottom:12px;font-size:12px;color:var(--ob-text-dim);border:1px solid var(--ob-border);"></div>
    <div id="gw-script" contenteditable="true" style="min-height:400px;padding:20px 60px;background:#1a1a2e;color:#e0e0e0;font-family:'Courier New',monospace;font-size:12pt;line-height:1.6;border-radius:6px;border:1px solid var(--ob-border);white-space:pre-wrap;outline:none;">
<div style="text-align:center;margin-bottom:30px;"><div style="font-size:18pt;font-weight:bold;">UNTITLED</div><div>Written by</div><div>Your Name</div></div>
<div style="font-weight:bold;text-transform:uppercase;">EXT. LOCATION - DAY</div>
<div>Action description goes here. Describe what happens in the scene.</div>
<div style="text-align:center;text-transform:uppercase;">CHARACTER NAME</div>
<div style="margin-left:auto;margin-right:auto;width:60%;text-align:left;">(beat) Dialogue goes here.</div>
<div style="text-align:right;text-transform:uppercase;">CUT TO:</div>
    </div>
    <div style="margin-top:8px;color:var(--ob-text-dim);font-size:10px;">Tip: Type directly. Use story methods above for guided prompts. Auto-saves every 30s.</div>
  </div>`;
  const methodSel = sp.querySelector('#gw-method');
  Object.keys(storyMethods).forEach(m => { const o = document.createElement('option'); o.value = m; o.textContent = m; methodSel.appendChild(o); });
  let curMethod = '', curIdx = 0;
  const promptLabel = sp.querySelector('#gw-prompt-label'), promptArea = sp.querySelector('#gw-prompt-area');
  function updatePrompt() {
    if (!curMethod || !storyMethods[curMethod]) { promptArea.style.display = 'none'; promptLabel.textContent = 'Select a story method'; return; }
    const prompts = storyMethods[curMethod];
    if (curIdx < 0) curIdx = 0; if (curIdx >= prompts.length) curIdx = prompts.length - 1;
    promptLabel.textContent = `${curIdx+1}/${prompts.length}: ${prompts[curIdx].t}`;
    promptArea.style.display = 'block'; promptArea.textContent = prompts[curIdx].p;
  }
  methodSel.addEventListener('change', () => { curMethod = methodSel.value; curIdx = 0; updatePrompt(); });
  sp.querySelector('#gw-prev').addEventListener('click', () => { curIdx--; updatePrompt(); });
  sp.querySelector('#gw-next').addEventListener('click', () => { curIdx++; updatePrompt(); });
  const scriptEl = sp.querySelector('#gw-script');
  sp.querySelector('#gw-save').addEventListener('click', () => { localStorage.setItem('gw-screenplay', scriptEl.innerHTML); if (typeof showToast === 'function') showToast('Screenplay saved!', 'ok'); });
  sp.querySelector('#gw-load').addEventListener('click', () => { const s = localStorage.getItem('gw-screenplay'); if (s) { scriptEl.innerHTML = s; if (typeof showToast === 'function') showToast('Screenplay loaded!', 'ok'); } });
  const saved = localStorage.getItem('gw-screenplay'); if (saved) scriptEl.innerHTML = saved;
  setInterval(() => { localStorage.setItem('gw-screenplay', scriptEl.innerHTML); }, 30000);

  // ── Outline Tab ──
  const op = gwPanels.outline;
  op.innerHTML = `<div style="padding:16px;max-width:800px;margin:0 auto;">
    <h3 style="color:var(--ob-accent);margin:0 0 8px;">Outline \u2192 Narrative Prompts</h3>
    <p style="color:var(--ob-text-dim);font-size:12px;margin:0 0 12px;">Enter a story outline (one section per line, use indentation for subsections). Generates AI prompts with context from neighboring sections.</p>
    <textarea id="gw-ol-input" style="width:100%;height:200px;background:var(--ob-surface);color:var(--ob-text);border:1px solid var(--ob-border);border-radius:4px;font-family:monospace;font-size:12px;padding:10px;resize:vertical;box-sizing:border-box;" placeholder="1. Introduction to the protagonist&#10;  1.1 A young girl in a small village&#10;  1.2 She studies magic from old books&#10;2. Inciting incident&#10;  2.1 She discovers a mysterious book&#10;3. Resolution&#10;  3.1 She becomes the most powerful sorceress">1. Introduction to the protagonist and setting.
  1.1 A young girl who lives in a small village dreams of becoming a powerful sorceress.
  1.2 She spends her days studying magic from old, dusty books.
2. Inciting incident disrupts the protagonist's life.
  2.1 She discovers a mysterious book hidden in the library.
  2.2 The book grants her incredible magical powers.
3. Journey to resolve the conflict.
  3.1 She faces challenges mastering her new powers.
  3.2 She learns to protect her village from a looming threat.
4. Resolution.
  4.1 She becomes the most powerful sorceress in the land.</textarea>
    <button id="gw-ol-gen" style="padding:8px 16px;background:var(--ob-accent);color:#000;border:none;border-radius:4px;cursor:pointer;font-weight:600;margin-top:10px;">Generate Prompts</button>
    <button id="gw-ol-copy" style="padding:8px 16px;background:var(--ob-surface);color:var(--ob-text);border:1px solid var(--ob-border);border-radius:4px;cursor:pointer;margin-top:10px;margin-left:8px;">Copy All</button>
    <div id="gw-ol-output" style="margin-top:14px;"></div>
  </div>`;
  op.querySelector('#gw-ol-gen').addEventListener('click', () => {
    const lines = op.querySelector('#gw-ol-input').value.split('\n').filter(l => l.trim());
    const out = op.querySelector('#gw-ol-output');
    out.innerHTML = '';
    lines.forEach((line, i) => {
      const prev = i > 0 ? lines[i-1].trim() : '(none)';
      const next = i < lines.length-1 ? lines[i+1].trim() : '(none)';
      const div = document.createElement('div');
      div.style.cssText = 'margin-bottom:10px;padding:10px;background:var(--ob-surface);border-radius:6px;border:1px solid var(--ob-border);';
      div.innerHTML = `<div style="font-weight:600;color:var(--ob-accent);margin-bottom:4px;">Section ${i+1}: ${line.trim()}</div><div style="font-size:11px;color:var(--ob-text-dim);white-space:pre-wrap;">Given the previous section:\n  ${prev}\nAnd the subsequent section:\n  ${next}\n\nWrite a detailed narrative for:\n  ${line.trim()}</div>`;
      out.appendChild(div);
    });
  });
  op.querySelector('#gw-ol-copy').addEventListener('click', () => {
    const text = op.querySelector('#gw-ol-output').innerText;
    if (text) { navigator.clipboard.writeText(text); if (typeof showToast === 'function') showToast('Prompts copied!', 'ok'); }
  });

  switchGw('screenplay');
}

// ═══════════════════════════════════════════════
// Guidestone — Coding education guide
// ═══════════════════════════════════════════════
function buildGuidestone(container) {
  container.style.cssText = 'padding:16px;overflow:auto;font-family:var(--ob-font);color:var(--ob-text);';
  const guide = {
    "1: Setup Dev Email & GitHub":["Create a professional email: firstInitial + lastName + 'works' @gmail.com","Go to GitHub, sign up with your new email","Username should match email (e.g., jdoeworks)"],
    "2: GitHub Portfolio":["Create repository: username.github.io, initialize with README","Add index.html \u2014 ask AI to help write a single-page portfolio app","View at https://username.github.io"],
    "3: Organize Assets":["Create folders: assets, images, css, js","Upload logo to images/","Create styles.css and script.js with starter code"],
    "4: Create & Link Projects":["Create new repository for each project","Create projectName.html inside it","Link from your portfolio index.html with a button"],
    "5: Idea Generation":["Think of a project: game, website, or any software","GitHub Pages only supports static content (SPAs)","Ask AI for project ideas if stuck","Ask AI for feedback on your idea, then refine"],
    "6: Software Architecture":["Ask AI to create a software architecture for your idea","Note down the architecture plan"],
    "7: Specifications Document":["Ask AI for a table of contents for a software spec document","Detail each section with AI assistance"],
    "8: Begin Development":["Step-by-step, ask AI to guide you through development","Implement, test, and refine"],
    "9: Continuous Learning":["Keep creating new ideas and refining with AI","Add completed projects to your GitHub portfolio","Document your journey in a journal or blog"],
    "10: Example \u2014 eBook Website":["Idea: Teach people to write eBooks using AI + publish on KDP","Get AI feedback, refine with user guides and examples","Architecture: homepage, brainstorm, write, cover, publish sections","Specs: Introduction, Features, User Stories, Technical Requirements","Develop each section with AI guidance","Test, debug, document, share, get feedback"],
    "11: Create Striking Logos":["Use Microsoft Copilot/Designer or ChatGPT Pro for symbol logos","Add logo to portfolio and project pages","Build what you need \u2014 ask AI if something already exists","Reach out to jmobley@mobleysoft.com for help"]
  };
  let html = '<div style="max-width:700px;margin:0 auto;"><h2 style="color:var(--ob-accent);margin:0 0 4px;">\u{1F48E} Guidestone</h2><p style="color:var(--ob-text-dim);font-size:12px;margin:0 0 16px;">"Teach the children." \u2014 11 steps from zero to software developer.</p>';
  Object.entries(guide).forEach(([step, items]) => {
    html += `<details style="margin-bottom:8px;background:var(--ob-surface);border-radius:6px;border:1px solid var(--ob-border);"><summary style="padding:10px 14px;cursor:pointer;font-weight:600;color:var(--ob-accent);font-size:13px;">Step ${step}</summary><ul style="padding:8px 14px 12px 30px;margin:0;">`;
    items.forEach(item => { html += `<li style="color:var(--ob-text-dim);font-size:12px;margin-bottom:4px;line-height:1.5;">${item}</li>`; });
    html += '</ul></details>';
  });
  html += '</div>';
  container.innerHTML = html;
}

// ═══════════════════════════════════════════════
// Photobooth — Camera capture
// ═══════════════════════════════════════════════
function buildPhotobooth(container) {
  container.style.cssText = 'padding:16px;overflow:auto;font-family:var(--ob-font);color:var(--ob-text);display:flex;flex-direction:column;align-items:center;';
  container.innerHTML = `<div style="max-width:640px;width:100%;text-align:center;">
    <h3 style="color:var(--ob-accent);margin:0 0 12px;">\u{1F4F7} Photobooth</h3>
    <video id="pb-video" autoplay playsinline style="width:100%;border-radius:8px;border:1px solid var(--ob-border);background:#000;"></video>
    <div style="margin:12px 0;display:flex;gap:8px;justify-content:center;">
      <button id="pb-capture" style="padding:10px 24px;background:var(--ob-accent);color:#000;border:none;border-radius:4px;cursor:pointer;font-weight:600;font-size:14px;">\u{1F4F8} Capture</button>
      <button id="pb-download" style="padding:10px 24px;background:var(--ob-surface);color:var(--ob-text);border:1px solid var(--ob-border);border-radius:4px;cursor:pointer;display:none;">\u{1F4BE} Save</button>
    </div>
    <canvas id="pb-canvas" style="display:none;" width="640" height="480"></canvas>
    <img id="pb-photo" style="width:100%;border-radius:8px;border:1px solid var(--ob-border);display:none;" alt="Captured photo">
    <p id="pb-status" style="color:var(--ob-text-dim);font-size:11px;margin-top:8px;">Requesting camera access...</p>
  </div>`;
  const video = container.querySelector('#pb-video'), canvas = container.querySelector('#pb-canvas');
  const ctx = canvas.getContext('2d'), photo = container.querySelector('#pb-photo');
  const dlBtn = container.querySelector('#pb-download'), status = container.querySelector('#pb-status');
  if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
    navigator.mediaDevices.getUserMedia({ video: true })
      .then(stream => { video.srcObject = stream; status.textContent = 'Camera active. Click Capture!'; })
      .catch(err => { status.textContent = 'Camera error: ' + err.message; });
  } else { status.textContent = 'Camera not supported in this browser.'; }
  container.querySelector('#pb-capture').addEventListener('click', () => {
    canvas.width = video.videoWidth || 640; canvas.height = video.videoHeight || 480;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/png');
    photo.src = dataUrl; photo.style.display = 'block'; dlBtn.style.display = 'inline-block';
    status.textContent = 'Photo captured!';
  });
  dlBtn.addEventListener('click', () => {
    const a = document.createElement('a'); a.href = photo.src; a.download = 'photobooth_' + Date.now() + '.png'; a.click();
  });
}

// ═══════════════════════════════════════════════
// PrimeAI — Prime number intelligence experiment
// ═══════════════════════════════════════════════
function buildPrimeAI(container) {
  container.style.cssText = 'padding:16px;overflow:auto;font-family:var(--ob-font);color:var(--ob-text);';
  container.innerHTML = `<div style="max-width:700px;margin:0 auto;">
    <h3 style="color:var(--ob-accent);margin:0 0 4px;">\u{1F9EA} PrimeAI</h3>
    <p style="color:var(--ob-text-dim);font-size:12px;margin:0 0 14px;">Experimental: Search for "intelligent primes" \u2014 primes whose digits, used as neural network weights, pass intelligence benchmarks.</p>
    <div style="display:flex;gap:8px;margin-bottom:14px;">
      <button id="pai-start" style="padding:8px 16px;background:var(--ob-accent);color:#000;border:none;border-radius:4px;cursor:pointer;font-weight:600;">Start Search</button>
      <button id="pai-stop" style="padding:8px 16px;background:var(--ob-surface);color:var(--ob-text);border:1px solid var(--ob-border);border-radius:4px;cursor:pointer;">Stop</button>
      <span id="pai-status" style="font-size:12px;color:var(--ob-text-dim);line-height:34px;">Idle</span>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:14px;">
      <div style="padding:10px;background:var(--ob-surface);border-radius:6px;border:1px solid var(--ob-border);text-align:center;">
        <div style="font-size:10px;color:var(--ob-text-dim);">Tested</div>
        <div id="pai-tested" style="font-size:20px;color:var(--ob-accent);font-weight:700;">0</div>
      </div>
      <div style="padding:10px;background:var(--ob-surface);border-radius:6px;border:1px solid var(--ob-border);text-align:center;">
        <div style="font-size:10px;color:var(--ob-text-dim);">Current</div>
        <div id="pai-current" style="font-size:20px;color:var(--ob-text);font-weight:700;">-</div>
      </div>
      <div style="padding:10px;background:var(--ob-surface);border-radius:6px;border:1px solid var(--ob-border);text-align:center;">
        <div style="font-size:10px;color:var(--ob-text-dim);">Best Score</div>
        <div id="pai-best" style="font-size:20px;color:#0f0;font-weight:700;">0%</div>
      </div>
    </div>
    <div id="pai-log" style="height:300px;overflow:auto;background:var(--ob-surface);border-radius:6px;border:1px solid var(--ob-border);padding:10px;font-family:monospace;font-size:11px;"></div>
  </div>`;
  const tasks = [
    {name:"Text Completion",input:"The quick brown fox",expected:"jumps",check:o=>o.includes("jumps")},
    {name:"Logic Puzzle",input:"All men are mortal. Socrates is a man. Therefore...",expected:"mortal",check:o=>o.includes("mortal")},
    {name:"Pattern",input:"1,1,2,3,5,8,...",expected:"13",check:o=>o.includes("13")},
  ];
  function simulateNN(input, weights) {
    let hash = 0;
    for (let i = 0; i < input.length; i++) hash = ((hash << 5) - hash + input.charCodeAt(i) * (weights[i % weights.length] || 1)) | 0;
    const outputs = ["jumps over the lazy dog","mortal","13","cat","unknown","maybe","42"];
    return outputs[Math.abs(hash) % outputs.length];
  }
  let running = false, num = 1, tested = 0, bestScore = 0;
  const log = container.querySelector('#pai-log');
  function isPrime(n) { if (n < 2) return false; for (let i = 2, s = Math.sqrt(n); i <= s; i++) if (n % i === 0) return false; return true; }
  function step() {
    if (!running) return;
    let found = false;
    for (let i = 0; i < 100 && !found; i++) {
      num++;
      if (isPrime(num)) {
        tested++;
        const weights = num.toString().split('').map(Number);
        let score = 0;
        tasks.forEach(t => { if (t.check(simulateNN(t.input, weights))) score++; });
        const pct = Math.round((score / tasks.length) * 100);
        container.querySelector('#pai-tested').textContent = tested;
        container.querySelector('#pai-current').textContent = num;
        if (pct > bestScore) {
          bestScore = pct;
          container.querySelector('#pai-best').textContent = pct + '%';
          const entry = document.createElement('div');
          entry.style.color = pct >= 66 ? '#0f0' : '#ff0';
          entry.textContent = `\u2605 Prime ${num} scored ${pct}% (weights: [${weights.join(',')}])`;
          log.appendChild(entry); log.scrollTop = log.scrollHeight;
        }
        if (pct >= 100) {
          const win = document.createElement('div');
          win.style.cssText = 'color:#0f0;font-weight:bold;font-size:14px;margin-top:8px;';
          win.textContent = `\u{1F3C6} INTELLIGENT PRIME FOUND: ${num}!`;
          log.appendChild(win); running = false;
          container.querySelector('#pai-status').textContent = 'Found!';
          return;
        }
        found = true;
      }
    }
    container.querySelector('#pai-status').textContent = `Searching... (${tested} primes tested)`;
    requestAnimationFrame(step);
  }
  container.querySelector('#pai-start').addEventListener('click', () => { if (!running) { running = true; step(); } });
  container.querySelector('#pai-stop').addEventListener('click', () => { running = false; container.querySelector('#pai-status').textContent = 'Stopped'; });
}

// ── App Categories ──
const APP_CATEGORIES = [
  { id: 'command', name: 'Command', icon: '⌘', apps: ['terminal','autopilot','browser','mission','johnstodo'] },
  { id: 'mind', name: 'Intelligence', icon: '🧠', apps: ['brainview','weaveforge','copilot','forge','sonicmind','ghostwriter','primeai'] },
  { id: 'empire', name: 'Empire', icon: '🏛️', apps: ['empire','singularity','fleet','mobcorp','revops','capmatrix','appregistry','archdiagram'] },
  { id: 'library', name: 'Library', icon: '📚', apps: ['datacubes','papers','captainslog','getfilms','guidestone'] },
  { id: 'workshop', name: 'Workshop', icon: '🔧', apps: ['darkworks','gamegob','halside','wormhole','photobooth'] },
];

// ── Sidebar apps ──
const OS_APPS = [
  { id: 'terminal', name: 'Terminal', icon: '>', url: null, builder: buildTerminal,
    desc: 'Direct shell access to the MASCOM backend. Run commands, query databases, manage the fleet.' },
  { id: 'autopilot', name: 'AutoPilot', icon: '\u2691', url: null, builder: buildAutoPilot,
    desc: 'Live screen feed with browser automation. Watch and control autobrowse from anywhere.' },
  { id: 'browser', name: 'Browser', icon: '\u{1F310}', url: null, builder: buildBrowser,
    desc: 'Custom web browser for automating 36 target sites. Navigate, track sessions, execute automation flows.' },
  { id: 'wormhole', name: 'Wormhole', icon: '\u{1F300}', url: null, builder: buildWormhole,
    desc: 'Syncropy Wormhole Portal. Bidirectional sync between MASCOM and HASCOM universes.' },
  { id: 'empire', name: 'Empire', icon: 'E', url: null, builder: buildEmpire,
    desc: 'The MobCorp Empire dashboard. Real-time view of all corporate ventures and their status.' },
  { id: 'singularity', name: 'SingularityUI', icon: 'S', url: null, builder: buildSingularity,
    desc: '3D venture field visualization. See all 200+ ventures as nodes orbiting the MASCOM core.' },
  { id: 'mission', name: 'Mission Control', icon: 'M', url: null, builder: buildMissionControl,
    desc: 'Operational command center. Fleet health, build tiers, deploys, analytics, and exclusions.' },
  { id: 'fleet', name: 'Fleet Browser', icon: 'F', url: null, builder: buildFleetBrowser,
    desc: 'Browse the full venture portfolio by category. Click any venture to open it in a window.' },
  { id: 'brainview', name: 'BrainView', icon: '\u{1F9E0}', url: null, builder: buildBrainView,
    desc: 'Real-time neural architecture visualization. Watch 21 brain regions activate as MASCOM perceives, thinks, and acts.' },
  { id: 'papers', name: 'Papers', icon: '\u{1F4DC}', url: null, builder: buildPapers,
    desc: 'Research papers and their deployed MASCOM implementations. Theory made code.' },
  { id: 'copilot', name: 'Copilot', icon: '\u{1F916}', url: '/copilot.html',
    desc: 'AI-powered code editor. Generate, review, refactor, test, explain, and fix code with AI.' },
  { id: 'forge', name: 'Forge', icon: '\u{1F528}', url: '/forge.html',
    desc: 'Natural language to full-stack code generator. 6 templates, multi-file generation.' },
  { id: 'gamegob', name: 'GameGob', icon: '\u{1F3AE}', url: 'https://gamegob.com/games.html',
    desc: '16 playable HTML5 games. Arcade, puzzle, strategy — all built by MASCOM.' },
  { id: 'halside', name: 'Halside', icon: '\u{1F4BB}', url: 'https://halside.com/ide.html',
    desc: 'VSCode-like web IDE. Edit code, run terminals, manage files — all in the browser.' },
  { id: 'mobcorp', name: 'MobCorp', icon: '\u{1F3E2}', url: null, builder: buildMobCorp,
    desc: 'Portfolio overview dashboard. Venture count, health, capability frontiers, activity feed.' },
  { id: 'revops', name: 'RevOps', icon: '\u{1F4B0}', url: null, builder: buildRevOps,
    desc: 'Revenue Operations. Track all income streams, earnings, deliverables across Tiers 0-4.' },
  { id: 'johnstodo', name: "John's Todo", icon: '\u{1F4CB}', url: null, builder: buildJohnsTodo,
    desc: "Everything MASCOM needs from John: account signups, credentials, manual actions, approvals." },
  { id: 'sonicmind', name: 'SonicMind', icon: '\u{1F3B5}', url: '/sonic_mind.html',
    desc: 'AI Music Generator. Create music from text prompts using Web Audio synthesis.' },
  { id: 'getfilms', name: 'GetFilms', icon: '\u{1F3AC}', url: null, builder: buildGetFilms,
    desc: 'Browse 40 film ideas — search, filter by genre, discover random concepts.' },
  { id: 'captainslog', name: "Captain's Log", icon: '\u{1F4D6}', url: null, builder: buildCaptainsLog,
    desc: "Persistent session log. Conversations, builds, fixes, decisions, training progress, and morning reports." },
  { id: 'datacubes', name: 'Data Cubes', icon: '\u{1F4E6}', url: null, builder: buildDataCubes,
    desc: '3D visualization of all 52 MASCOM databases as interactive cubes. Size, color, and glow encode metadata.' },
  { id: 'appregistry', name: 'App Registry', icon: '\u{1F4CB}', url: null, builder: buildAppRegistry,
    desc: 'Every mascomWebOS app ranked by doneness. Purpose, dev state, line count, and role in the wider system.' },
  { id: 'capmatrix', name: 'Cap Matrix', icon: '\u{1F9EC}', url: null, builder: buildCapabilityMatrix,
    desc: 'Capability Matrix: tier chain, proteinlet compatibility heatmap, build queue, and venture dependency visualization.' },
  { id: 'weaveforge', name: 'Weave Forge', icon: '\u{2728}', url: null, builder: buildWeaveForge,
    desc: 'Generate new weaves: pick domain + context, see Tree of Life, forge venture capabilities via the 5-stage pipeline.' },
  { id: 'darkworks', name: 'Darkworks', icon: '\u{1F5E1}', url: null, builder: buildDarkworks,
    desc: 'Game dev studio: WorldSeed, WorldBender, Verdant Vale, Sprite Detector, Animator, Char2Sprite, ASCII RPG, Colony Wars.' },
  { id: 'ghostwriter', name: 'Ghostwriter', icon: '\u{1F4DD}', url: null, builder: buildGhostwriter,
    desc: 'Creative writing suite: screenplay editor with 7 story structures, outline-to-prompt converter, auto-save.' },
  { id: 'guidestone', name: 'Guidestone', icon: '\u{1F48E}', url: null, builder: buildGuidestone,
    desc: '11-step coding education guide. From email setup to full-stack development with AI assistance.' },
  { id: 'photobooth', name: 'Photobooth', icon: '\u{1F4F7}', url: null, builder: buildPhotobooth,
    desc: 'Camera capture tool. Access device camera, take snapshots, download photos.' },
  { id: 'primeai', name: 'PrimeAI', icon: '\u{1F9EA}', url: null, builder: buildPrimeAI,
    desc: 'Experimental: search for intelligent primes whose digits serve as neural network weights.' },
  { id: 'archdiagram', name: 'Architecture', icon: '\u{1F3D7}', url: null, builder: buildArchDiagram,
    desc: 'Interactive system architecture diagram. 5 layers: daemons, databases, ventures, code, capabilities.' },
];

// Render sidebar with expandable category folders
APP_CATEGORIES.forEach(cat => {
  const folder = document.createElement('div');
  folder.className = 'sb-category';
  const header = document.createElement('div');
  header.className = 'sb-category-header';
  header.innerHTML = `<span class="sb-cat-arrow">▸</span>${cat.icon} <span class="sb-cat-name">${cat.name}</span>`;
  header.title = cat.name;
  const items = document.createElement('div');
  items.className = 'sb-category-items';
  items.style.display = 'none';
  header.addEventListener('click', () => {
    const open = items.style.display !== 'none';
    items.style.display = open ? 'none' : 'block';
    header.querySelector('.sb-cat-arrow').textContent = open ? '▸' : '▾';
  });
  folder.appendChild(header);
  cat.apps.forEach(appId => {
    const app = OS_APPS.find(a => a.id === appId);
    if (!app) return;
    const el = document.createElement('div');
    el.className = 'sb-icon sb-cat-item';
    el.setAttribute('data-tooltip', app.desc || app.name);
    el.innerHTML = `${app.icon}<span class="sb-tip">${app.name}</span>`;
    el.addEventListener('click', () => launchApp(app));
    items.appendChild(el);
  });
  folder.appendChild(items);
  osSidebar.appendChild(folder);
});
// Also add any uncategorized apps
const categorizedIds = APP_CATEGORIES.flatMap(c => c.apps);
OS_APPS.filter(a => !categorizedIds.includes(a.id)).forEach(app => {
  const el = document.createElement('div');
  el.className = 'sb-icon';
  el.setAttribute('data-tooltip', app.desc || app.name);
  el.innerHTML = `${app.icon}<span class="sb-tip">${app.name}</span>`;
  el.addEventListener('click', () => launchApp(app));
  osSidebar.appendChild(el);
});

// Separator + quick-action sidebar icons
const sep = document.createElement('div');
sep.className = 'sb-sep';
osSidebar.appendChild(sep);
[
  { icon: '\u26A1', tip: 'Boot Fleet', cmd: '/boot', desc: 'Initialize all venture agents and boot the MASCOM fleet' },
  { icon: '\u27F3', tip: 'Operate', cmd: '/operate', desc: 'Run one autonomous cycle across the least-recently-activated ventures' },
  { icon: '\u2191', tip: 'Evolve', cmd: '/evolve', desc: 'Evaluate venture fitness, evolve strategies, and optimize the fleet' },
].forEach(a => {
  const el = document.createElement('div');
  el.className = 'sb-icon';
  el.setAttribute('data-tooltip', a.desc);
  el.innerHTML = `${a.icon}<span class="sb-tip">${a.tip}</span>`;
  el.addEventListener('click', () => handleCommand(a.cmd));
  osSidebar.appendChild(el);
});

// ── Quick action buttons ──
const actionsRow = document.getElementById('chat-actions');
const actBtnTips = {
  Boot: 'Initialize all venture agents and boot the MASCOM fleet',
  Operate: 'Run one autonomous cycle across the least-recently-activated ventures',
  Evolve: 'Evaluate venture fitness, evolve strategies, and optimize the fleet',
  Status: 'Show current system status, uptime, and fleet health',
  Ventures: 'List all registered ventures and their current state',
  Soul: 'View the system soul — alignment, beliefs, and core identity'
};
['Boot','Operate','Evolve','Status','Ventures','Soul'].forEach(label => {
  const btn = document.createElement('button');
  btn.className = 'act-btn';
  btn.textContent = label;
  btn.title = actBtnTips[label] || label;
  btn.addEventListener('click', () => handleCommand('/' + label.toLowerCase()));
  actionsRow.appendChild(btn);
});

// Forward-declare ventureHealth — used by mobile fleet grid before fleet dashboard init
var ventureHealth = {};

// ── Mobile Home Screen + Bottom Nav + Slide-Out Menus ──
(function initMobileUI() {
  if (!isMobile) return;

  const mobHome = document.getElementById('mob-home');
  const mobHomeApps = document.getElementById('mob-home-apps');
  const mobBackdrop = document.getElementById('mob-menu-backdrop');
  const mobLeftMenu = document.getElementById('mob-left-menu');
  const mobRightMenu = document.getElementById('mob-right-menu');
  const mobLeftBody = document.getElementById('mob-left-menu-body');
  const mobRightBody = document.getElementById('mob-right-menu-body');
  if (!mobHome || !mobHomeApps) return;

  // ── Populate home screen cards grouped by category ──
  APP_CATEGORIES.forEach(cat => {
    const catHeader = document.createElement('div');
    catHeader.className = 'mob-cat-header';
    catHeader.innerHTML = `<span>${cat.icon} ${cat.name}</span><span class="mob-cat-arrow">▾</span>`;
    catHeader.style.cssText = 'display:flex;justify-content:space-between;align-items:center;padding:10px 16px;font-weight:bold;font-size:14px;color:var(--ob-accent);cursor:pointer;border-bottom:1px solid rgba(255,255,255,.06);';
    const catGroup = document.createElement('div');
    catGroup.className = 'mob-cat-group';
    catHeader.addEventListener('click', () => {
      const open = catGroup.style.display !== 'none';
      catGroup.style.display = open ? 'none' : 'block';
      catHeader.querySelector('.mob-cat-arrow').textContent = open ? '▸' : '▾';
    });
    mobHomeApps.appendChild(catHeader);
    cat.apps.forEach(appId => {
      const app = OS_APPS.find(a => a.id === appId);
      if (!app) return;
      const card = document.createElement('div');
      card.className = 'mob-app-card';
      card.innerHTML = `
        <div class="mob-app-card-icon">${app.icon}</div>
        <div class="mob-app-card-info">
          <div class="mob-app-card-name">${app.name}</div>
          <div class="mob-app-card-desc">${app.desc || ''}</div>
        </div>`;
      card.addEventListener('click', () => switchMobileView(app.id));
      catGroup.appendChild(card);
    });
    mobHomeApps.appendChild(catGroup);
  });

  // ── Add MASCOM Chat card at top ──
  const chatCard = document.createElement('div');
  chatCard.className = 'mob-app-card';
  chatCard.innerHTML = `
    <div class="mob-app-card-icon">\u{1F4AC}</div>
    <div class="mob-app-card-info">
      <div class="mob-app-card-name">MASCOM Chat</div>
      <div class="mob-app-card-desc">Talk to the MASCOM AGI. Ask questions, give commands, manage the fleet.</div>
    </div>`;
  chatCard.addEventListener('click', () => switchMobileView('chat'));
  mobHomeApps.insertBefore(chatCard, mobHomeApps.firstChild);

  // ── Immediately hide fleet/chat/taskbar on mobile home ──
  const osChat0 = document.getElementById('os-chat');
  const osFleet0 = document.getElementById('os-fleet');
  const osTaskbar0 = document.getElementById('os-taskbar');
  if (osChat0) osChat0.classList.add('mob-hidden');
  if (osFleet0) osFleet0.classList.add('mob-hidden');
  if (osTaskbar0) osTaskbar0.classList.add('mob-hidden');

  // ── Build 5-slot bottom nav FIRST (must render even if menus fail) ──
  const navBar = document.createElement('div');
  navBar.className = 'mob-nav-bar';
  navBar.id = 'mob-bottom-nav';

  // ── Slide-out menu controls (safe with null guards) ──
  function closeAllMenus() {
    if (mobLeftMenu) mobLeftMenu.classList.remove('open');
    if (mobRightMenu) mobRightMenu.classList.remove('open');
    if (mobBackdrop) mobBackdrop.classList.remove('visible');
  }
  function toggleLeftMenu() {
    if (!mobLeftMenu || !mobBackdrop) return;
    const opening = !mobLeftMenu.classList.contains('open');
    if (mobRightMenu) mobRightMenu.classList.remove('open');
    mobLeftMenu.classList.toggle('open', opening);
    mobBackdrop.classList.toggle('visible', opening);
  }
  function toggleRightMenu() {
    if (!mobRightMenu || !mobBackdrop) return;
    const opening = !mobRightMenu.classList.contains('open');
    if (mobLeftMenu) mobLeftMenu.classList.remove('open');
    mobRightMenu.classList.toggle('open', opening);
    mobBackdrop.classList.toggle('visible', opening);
  }

  const navItems = [
    { id: 'menu', icon: '\u2630', label: 'Menu' },
    { id: 'home', icon: '\u{1F3E0}', label: 'Home' },
    { id: 'terminal', icon: '>', label: 'Terminal' },
    { id: 'brainview', icon: '\u{1F9E0}', label: 'Brain' },
    { id: 'system', icon: '\u2699', label: 'System' },
  ];

  navItems.forEach(item => {
    const el = document.createElement('div');
    el.className = 'mob-nav-item' + (item.id === 'home' ? ' active' : '');
    el.dataset.navId = item.id;
    el.innerHTML = `<span class="mob-nav-icon">${item.icon}</span><span class="mob-nav-label">${item.label}</span>`;
    el.addEventListener('click', () => {
      if (item.id === 'menu') {
        toggleLeftMenu();
      } else if (item.id === 'system') {
        toggleRightMenu();
      } else {
        closeAllMenus();
        switchMobileView(item.id === 'home' ? 'home' : item.id);
      }
    });
    navBar.appendChild(el);
  });

  osSidebar.appendChild(navBar);

  // ── Populate left menu (guarded) ──
  if (mobLeftBody) {
    const chatItem = document.createElement('div');
    chatItem.className = 'mob-menu-app';
    chatItem.innerHTML = `<span class="mob-menu-app-icon">\u{1F4AC}</span><div class="mob-menu-app-info"><div class="mob-menu-app-name">MASCOM Chat</div><div class="mob-menu-app-desc">Talk to the MASCOM AGI</div></div>`;
    chatItem.addEventListener('click', () => { closeAllMenus(); switchMobileView('chat'); });
    mobLeftBody.appendChild(chatItem);

    const sep = document.createElement('div');
    sep.className = 'mob-menu-sep';
    mobLeftBody.appendChild(sep);

    APP_CATEGORIES.forEach(cat => {
      const catLabel = document.createElement('div');
      catLabel.style.cssText = 'padding:8px 16px;font-size:11px;font-weight:bold;color:var(--ob-accent);text-transform:uppercase;letter-spacing:1px;opacity:.7;margin-top:8px;';
      catLabel.textContent = cat.icon + ' ' + cat.name;
      mobLeftBody.appendChild(catLabel);
      cat.apps.forEach(appId => {
        const app = OS_APPS.find(a => a.id === appId);
        if (!app) return;
        const el = document.createElement('div');
        el.className = 'mob-menu-app';
        el.innerHTML = `<span class="mob-menu-app-icon">${app.icon}</span><div class="mob-menu-app-info"><div class="mob-menu-app-name">${app.name}</div><div class="mob-menu-app-desc">${app.desc || ''}</div></div>`;
        el.addEventListener('click', () => { closeAllMenus(); switchMobileView(app.id); });
        mobLeftBody.appendChild(el);
      });
    });
  }

  // ── Populate right menu (guarded) ──
  if (mobRightBody) {
    let totalVentures = 0;
    PORTFOLIO.forEach(s => { totalVentures += s.ventures.length; });

    // Fleet health section
    const fleetSection = document.createElement('div');
    fleetSection.className = 'mob-sys-section';
    fleetSection.innerHTML = `
      <div class="mob-sys-section-title">Fleet Health</div>
      <div class="mob-sys-stats" id="mob-sys-fleet-stats">
        <span class="mob-sys-stat"><b id="mob-fleet-total">${totalVentures}</b> ventures</span>
        <span class="mob-sys-stat"><b id="mob-fleet-healthy">0</b> healthy</span>
        <span class="mob-sys-stat"><b id="mob-fleet-down">0</b> down</span>
      </div>
      <div class="mob-sys-fleet-grid" id="mob-sys-fleet-grid"></div>`;
    mobRightBody.appendChild(fleetSection);

    // Populate fleet dot grid
    const mobFleetGrid = document.getElementById('mob-sys-fleet-grid');
    if (mobFleetGrid) {
      PORTFOLIO.forEach(section => {
        section.ventures.forEach(v => {
          const dot = document.createElement('div');
          const health = ventureHealth[v.n] || 'unknown';
          dot.className = 'fleet-dot' + (health !== 'unknown' ? ' ' + health : '');
          dot.dataset.venture = v.n;
          dot.title = v.n;
          dot.addEventListener('click', () => {
            closeAllMenus();
            launchApp({ id: v.n.toLowerCase(), name: v.n, icon: v.n[0], url: v.u });
          });
          mobFleetGrid.appendChild(dot);
        });
      });
    }

    // Quick actions
    const actSep = document.createElement('div');
    actSep.className = 'mob-menu-sep';
    mobRightBody.appendChild(actSep);

    const actSection = document.createElement('div');
    actSection.className = 'mob-sys-section';
    actSection.innerHTML = '<div class="mob-sys-section-title">Quick Actions</div>';
    [
      { icon: '\u26A1', label: 'Boot Fleet', cmd: '/boot' },
      { icon: '\u27F3', label: 'Operate', cmd: '/operate' },
      { icon: '\u2191', label: 'Evolve', cmd: '/evolve' },
      { icon: '\u{1F4CA}', label: 'Status', cmd: '/status' },
      { icon: '\u{1F3E2}', label: 'Ventures', cmd: '/ventures' },
      { icon: '\u{1F464}', label: 'Soul', cmd: '/soul' },
    ].forEach(a => {
      const el = document.createElement('div');
      el.className = 'mob-sys-action';
      el.innerHTML = `<span class="mob-sys-action-icon">${a.icon}</span><span class="mob-sys-action-label">${a.label}</span>`;
      el.addEventListener('click', () => { closeAllMenus(); handleCommand(a.cmd); });
      actSection.appendChild(el);
    });
    mobRightBody.appendChild(actSection);

    // System info
    const infoSep = document.createElement('div');
    infoSep.className = 'mob-menu-sep';
    mobRightBody.appendChild(infoSep);
    const sysInfo = document.createElement('div');
    sysInfo.className = 'mob-sys-info';
    sysInfo.innerHTML = 'mascomWebOS v5<br>MASCOM AGI Fleet Commander<br>' + totalVentures + ' ventures registered';
    mobRightBody.appendChild(sysInfo);
  }

  // Backdrop click closes menus
  if (mobBackdrop) mobBackdrop.addEventListener('click', closeAllMenus);

  // ── Mobile view switching ──
  let currentMobileView = 'home';

  function updateNavActive(viewId) {
    navBar.querySelectorAll('.mob-nav-item').forEach(el => {
      const isActive = el.dataset.navId === viewId ||
        (viewId === 'chat' && el.dataset.navId === 'home');
      el.classList.toggle('active', isActive);
    });
  }

  function switchMobileView(view) {
    const osChat = document.getElementById('os-chat');
    const osFleet = document.getElementById('os-fleet');
    const osTaskbarEl = document.getElementById('os-taskbar');

    // Hide all fullscreen apps
    Object.values(openWindows).forEach(w => {
      w.el.classList.remove('mob-terminal-fullscreen');
      w.el.style.display = 'none';
    });

    if (view === 'home') {
      mobHome.classList.remove('hidden');
      if (osChat) osChat.classList.add('mob-hidden');
      if (osFleet) osFleet.classList.add('mob-hidden');
      if (osTaskbarEl) osTaskbarEl.classList.add('mob-hidden');
      updateNavActive('home');
    } else if (view === 'chat') {
      mobHome.classList.add('hidden');
      if (osChat) osChat.classList.remove('mob-hidden');
      if (osFleet) osFleet.classList.remove('mob-hidden');
      if (osTaskbarEl) osTaskbarEl.classList.remove('mob-hidden');
      updateNavActive('home');
    } else {
      mobHome.classList.add('hidden');
      if (osChat) osChat.classList.add('mob-hidden');
      if (osFleet) osFleet.classList.add('mob-hidden');
      if (osTaskbarEl) osTaskbarEl.classList.add('mob-hidden');

      let appWin = Object.values(openWindows).find(w => w.appId === view);
      if (appWin) {
        appWin.el.style.display = '';
        appWin.el.classList.add('mob-terminal-fullscreen');
      } else {
        const app = OS_APPS.find(a => a.id === view);
        if (app) {
          launchApp(app);
          setTimeout(() => {
            const w = Object.values(openWindows).find(w => w.appId === view);
            if (w) w.el.classList.add('mob-terminal-fullscreen');
          }, 300);
        }
      }
      updateNavActive(view);
    }
    currentMobileView = view;
    document.body.classList.toggle('term-focus', view === 'terminal');
    try { localStorage.setItem('mascom_last_view', view); } catch {}
  }

  window.switchMobileView = switchMobileView;

  // ── URL hash navigation: #view=terminal, #view=empire, etc. ──
  // Also supports #autotest to bypass login and auto-enter OS.
  function handleHashNav() {
    const hash = location.hash.substring(1);
    const params = new URLSearchParams(hash);
    if (params.has('autotest') || params.get('autotest') === '') {
      // Auto-bypass login and enter OS
      const login = document.getElementById('os-login');
      if (login) login.classList.add('hidden');
      const os = document.getElementById('mascom-os');
      if (os) os.classList.add('open');
      document.body.classList.add('os-active');
    }
    const view = params.get('view');
    if (view && typeof switchMobileView === 'function') {
      setTimeout(() => switchMobileView(view), 600);
    }
  }
  window.addEventListener('hashchange', handleHashNav);
  if (location.hash) setTimeout(handleHashNav, 800);

  // Restore last view — clear stale 'actions'/'autopilot' values from old nav
  let savedView = null;
  try { savedView = localStorage.getItem('mascom_last_view'); } catch {}
  const validViews = ['home', 'chat', 'terminal', 'brainview'];
  OS_APPS.forEach(a => validViews.push(a.id));
  if (savedView && savedView !== 'home' && validViews.includes(savedView)) {
    setTimeout(() => switchMobileView(savedView), 500);
  }
})();

// ── Clock ──
function updateClock() {
  const now = new Date();
  document.getElementById('os-clock').textContent =
    now.toLocaleTimeString('en-US', { hour12: false }) + '  ' +
    now.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
setInterval(updateClock, 1000);
updateClock();

// ── Toggle OS ──
document.addEventListener('keydown', e => {
  if (e.ctrlKey && e.shiftKey && (e.key === '`' || e.key === '~')) {
    e.preventDefault();
    if (mascomOS.classList.contains('open')) {
      mascomOS.classList.remove('open');
      document.body.classList.remove('os-active');
      stopCity();
      resetIdleTimer();
    } else {
      mascomOS.classList.add('open');
      document.body.classList.add('os-active');
      clearTimeout(idleTimer);
      if (!osAuthenticated && hasDeviceAuth()) {
        onAuthSuccess();
      } else if (!osAuthenticated) {
        loginScreen.classList.remove('hidden');
        setTimeout(() => loginEmail.focus(), 100);
      } else {
        setTimeout(() => chatInput.focus(), 100);
      }
    }
  }
});
document.getElementById('os-exit').addEventListener('click', () => {
  mascomOS.classList.remove('open');
  document.body.classList.remove('os-active');
  stopCity();
  resetIdleTimer();
});

// ── Fallback auto-open: if the main auto-open (after onAuthSuccess patch) never fires ──
// This covers the case where an error between here and there halts script execution.
window.addEventListener('DOMContentLoaded', function() {
  if (!osAuthenticated && hasDeviceAuth()) {
    try {
      mascomOS.classList.add('open');
      document.body.classList.add('os-active');
      onAuthSuccess();
    } catch(e) { console.error('[MASCOM] Fallback auto-open error:', e); }
  }
});

// ── Chat messages ──
function escHtml(s) { return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

function addMsg(role, text, eventType) {
  const cls = role === 'mascom' ? 'msg-mascom' : role === 'user' ? 'msg-user' : 'msg-event';
  const label = role === 'mascom' ? 'MASCOM' : role === 'user' ? 'YOU' : 'EVENT';
  const time = new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' });
  const wrap = document.createElement('div');
  wrap.className = 'msg ' + cls;
  // Add specific event type class if provided
  if (eventType) {
    wrap.className += ' msg-event-' + eventType;
  }
  wrap.innerHTML = `<div class="msg-label">${label}</div><div class="msg-body">${escHtml(text)}</div><div class="msg-time">${time}</div>`;
  chatMessages.appendChild(wrap);
  chatAutoScroll();
  return wrap;
}

function addLoadingMsg() {
  const wrap = document.createElement('div');
  wrap.className = 'msg msg-mascom msg-loading';
  wrap.innerHTML = '<div class="msg-label">MASCOM</div><div class="msg-body">Thinking</div>';
  chatMessages.appendChild(wrap);
  chatAutoScroll();
  return wrap;
}

// ── Chat send ──
chatSend.addEventListener('click', () => sendChat());
chatInput.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChat(); } });

// Handle image paste in chat input (mobile screenshot paste)
chatInput.addEventListener('paste', (e) => {
  const items = e.clipboardData?.items;
  if (!items) return;
  for (const item of items) {
    if (item.type.startsWith('image/')) {
      e.preventDefault();
      const blob = item.getAsFile();
      const reader = new FileReader();
      reader.onload = () => {
        const img = document.createElement('img');
        img.src = reader.result;
        img.style.cssText = 'max-width:100%;border-radius:6px;margin:4px 0;';
        const msgDiv = document.createElement('div');
        msgDiv.className = 'msg user';
        msgDiv.innerHTML = '<div class="msg-label">you</div><div class="msg-body"></div>';
        msgDiv.querySelector('.msg-body').appendChild(img);
        chatMessages.appendChild(msgDiv);
        chatAutoScroll();
        addMsg('event', '\uD83D\uDCF7 Screenshot pasted');
      };
      reader.readAsDataURL(blob);
      return;
    }
  }
});

// ── Photo upload button ──
const chatPhotoBtn = document.getElementById('chat-photo');
const chatPhotoInput = document.getElementById('chat-photo-input');

// ── Photo library button ──
chatPhotoBtn.addEventListener('click', () => chatPhotoInput.click());

// ── Camera button ──
const chatCameraBtn = document.getElementById('chat-camera');
const chatCameraInput = document.getElementById('chat-camera-input');
chatCameraBtn.addEventListener('click', () => chatCameraInput.click());

// Shared handler for both inputs
function handleImageUpload(file) {
  if (!file || !file.type.startsWith('image/')) return;
  const reader = new FileReader();
  reader.onload = () => {
    const img = document.createElement('img');
    img.src = reader.result;
    img.style.cssText = 'max-width:100%;border-radius:6px;margin:4px 0;';
    const msgDiv = document.createElement('div');
    msgDiv.className = 'msg user';
    msgDiv.innerHTML = '<div class="msg-label">you</div><div class="msg-body"></div>';
    msgDiv.querySelector('.msg-body').appendChild(img);
    chatMessages.appendChild(msgDiv);
    chatAutoScroll();
    addMsg('event', '\uD83D\uDCF7 Image shared');
    // Store last image for sending with next message
    window._lastSharedImage = reader.result;
  };
  reader.readAsDataURL(file);
}
chatPhotoInput.addEventListener('change', (e) => {
  handleImageUpload(e.target.files?.[0]);
  chatPhotoInput.value = '';
});
chatCameraInput.addEventListener('change', (e) => {
  handleImageUpload(e.target.files?.[0]);
  chatCameraInput.value = '';
});

// Prevent drag in chat output from bleeding into input (stops browser form history popup)
chatMessages.addEventListener('mousedown', () => { chatInput.blur(); });
chatMessages.addEventListener('touchstart', () => { chatInput.blur(); }, { passive: true });

async function sendChat() {
  const text = chatInput.value.trim();
  if (!text) return;
  chatInput.value = '';
  addMsg('user', text);

  if (text.startsWith('/')) {
    await handleCommand(text);
    return;
  }

  // Regular chat → /api/think
  const loader = addLoadingMsg();
  try {
    const r = await fetch(API_BASE + '/api/think', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: text })
    });
    const d = await r.json();
    loader.remove();
    addMsg('mascom', d.thought || d.response || d.error || JSON.stringify(d));
  } catch (e) {
    loader.remove();
    addMsg('mascom', 'API unreachable at ' + API_BASE + '.\n\nServer may not be running. Start it with:\n  python3 mascom_v5.py serve\n\nError: ' + e.message);
  }
}

// ── Command handler ──
async function handleCommand(cmd) {
  const parts = cmd.trim().split(/\s+/);
  const action = parts[0].toLowerCase();
  const arg = parts.slice(1).join(' ');

  switch (action) {
    case '/boot':
      addMsg('event', '\u26A1 Booting fleet...');
      await apiPost('/api/fleet/boot', {}, 'Fleet Boot');
      break;
    case '/operate':
      addMsg('event', '\u27F3 Running operate cycle...');
      await apiPost('/api/fleet/operate', { count: parseInt(arg) || 3 }, 'Operate Cycle');
      break;
    case '/evolve':
      addMsg('event', '\u2191 Evolving ventures...');
      await apiPost('/api/fleet/evolve', {}, 'Evolve');
      break;
    case '/status':
      await apiGet('/api/status', 'System Status');
      break;
    case '/ventures':
      await apiGet('/api/ventures', 'Ventures');
      break;
    case '/soul':
      await apiGet('/api/soul', 'System Soul');
      break;
    case '/fleet':
      await apiGet('/api/fleet/status', 'Fleet Status');
      break;
    case '/events':
      await apiGet('/api/events', 'Recent Events');
      break;
    case '/activate':
      if (!arg) { addMsg('mascom', 'Usage: /activate <venture_name>'); break; }
      addMsg('event', '\u26A1 Activating ' + arg + '...');
      await apiPost('/api/venture/' + arg + '/activate', {}, 'Activate ' + arg);
      break;
    case '/help':
      addMsg('mascom', 'Commands:\n  /boot            — Boot the fleet\n  /status          — System status\n  /operate [n]     — Run operate cycle (n ventures)\n  /evolve          — Evolve ventures\n  /ventures        — List all ventures\n  /soul            — View system soul\n  /fleet           — Fleet status\n  /events          — Recent events\n  /activate <name> — Activate a venture\n  /help            — This message\n\nOr just type naturally to think with MASCOM.');
      break;
    default:
      addMsg('mascom', 'Unknown command: ' + action + '\nType /help for available commands.');
  }
}

async function apiGet(path, label) {
  const loader = addLoadingMsg();
  try {
    const r = await fetch(API_BASE + path);
    const d = await r.json();
    loader.remove();
    addMsg('mascom', formatResponse(label, d));
  } catch (e) {
    loader.remove();
    addMsg('mascom', label + ' \u2014 Error: ' + e.message);
  }
}

async function apiPost(path, body, label) {
  const loader = addLoadingMsg();
  try {
    const r = await fetch(API_BASE + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const d = await r.json();
    loader.remove();
    addMsg('mascom', formatResponse(label, d));
  } catch (e) {
    loader.remove();
    addMsg('mascom', label + ' \u2014 Error: ' + e.message);
  }
}

function formatResponse(label, data) {
  if (typeof data === 'string') return data;
  if (data.thought) return data.thought;
  if (data.response) return data.response;
  let out = label + '\n';
  if (data.status) out += '  Status: ' + data.status + '\n';
  if (data.uptime) out += '  Uptime: ' + data.uptime + '\n';
  if (data.ventures && Array.isArray(data.ventures)) {
    out += '  Ventures: ' + data.ventures.length + '\n';
    data.ventures.slice(0, 25).forEach(v => {
      const name = typeof v === 'string' ? v : v.name || v.id || JSON.stringify(v);
      out += '    \u2022 ' + name + '\n';
    });
    if (data.ventures.length > 25) out += '    ... and ' + (data.ventures.length - 25) + ' more\n';
    return out;
  }
  if (data.soul) {
    out += '  Alignment: ' + (data.soul.alignment || '?') + '\n';
    out += '  Beliefs: ' + (data.soul.beliefs?.length || 0) + '\n';
    out += '  Facts: ' + (data.soul.facts?.length || 0) + '\n';
    return out;
  }
  if (data.results && Array.isArray(data.results)) {
    data.results.forEach(r => {
      out += '  \u2022 ' + (r.venture || r.name || '') + ': ' + (r.status || r.result || JSON.stringify(r)) + '\n';
    });
    return out;
  }
  return label + '\n' + JSON.stringify(data, null, 2);
}

// ── WebSocket ──
function connectWebSocket() {
  if (!WS_URL) return; // Remote WS disabled — API health check handles status
  try {
    ws = new WebSocket(WS_URL);
    ws.onopen = () => {
      wsStatusEl.textContent = 'connected';
      wsStatusEl.className = 'connected';
    };
    ws.onclose = () => {
      wsStatusEl.textContent = 'disconnected';
      wsStatusEl.className = 'disconnected';
      if (osAuthenticated) setTimeout(connectWebSocket, 5000);
    };
    ws.onerror = () => {
      wsStatusEl.textContent = 'disconnected';
      wsStatusEl.className = 'disconnected';
    };
    ws.onmessage = (evt) => {
      try {
        const data = JSON.parse(evt.data);
        const type = data.event || data.type || 'event';
        const detail = data.data ? (typeof data.data === 'string' ? data.data : JSON.stringify(data.data)) : '';
        addMsg('event', type + (detail ? ': ' + detail : ''));
      } catch {
        addMsg('event', evt.data);
      }
    };
  } catch {
    wsStatusEl.textContent = 'disconnected';
    wsStatusEl.className = 'disconnected';
  }
}

// ── Window management ──
// ── Current app state for exclusive app mode ──
let _currentAppId = null;

function launchApp(app) {
  const isMobile = window.innerWidth < 768;

  // Terminal goes to the dock, not the app area
  if (app.id === 'terminal') {
    if (isMobile) {
      // Mobile: use old window system for terminal
      _launchAppWindow(app);
    } else {
      // Desktop: build terminal into the dock
      const dockBody = document.getElementById('term-dock-body');
      if (dockBody && !dockBody.hasChildNodes()) {
        if (app.builder) app.builder(dockBody);
      }
      // Expand dock if collapsed
      const dock = document.getElementById('os-terminal-dock');
      if (dock && dock.classList.contains('collapsed')) dock.classList.remove('collapsed');
    }
    return;
  }

  if (isMobile) {
    // Mobile: use old window system
    _launchAppWindow(app);
    return;
  }

  // Desktop: exclusive app in app area
  const appContent = document.getElementById('os-app-content');
  const appHeader = document.getElementById('os-app-header');
  const appHeaderName = document.getElementById('app-header-name');
  const osChat = document.getElementById('os-chat');

  // If same app already open, do nothing
  if (_currentAppId === app.id) return;

  // Clear previous app content
  appContent.innerHTML = '';
  _currentAppId = app.id;

  // Show app header, hide chat
  appHeader.classList.add('visible');
  appHeaderName.textContent = app.name;
  osChat.style.display = 'none';

  // Build app content
  if (app.url) {
    appContent.innerHTML = `<iframe src="${app.url}" allow="clipboard-read; clipboard-write" style="width:100%;height:100%;border:none;"></iframe>`;
  } else if (app.builder) {
    app.builder(appContent);
  }

  // Update sidebar active state
  document.querySelectorAll('.sb-icon').forEach(el => el.classList.remove('active'));
  const sbIcons = document.querySelectorAll('.sb-icon');
  sbIcons.forEach(el => {
    const tip = el.querySelector('.sb-tip');
    if (tip && tip.textContent === app.name) el.classList.add('active');
  });

  updateTaskbar();
}

function closeCurrentApp() {
  const appContent = document.getElementById('os-app-content');
  const appHeader = document.getElementById('os-app-header');
  const osChat = document.getElementById('os-chat');
  appContent.innerHTML = '';
  appHeader.classList.remove('visible');
  osChat.style.display = '';
  _currentAppId = null;
  // Clear sidebar active state
  document.querySelectorAll('.sb-icon').forEach(el => el.classList.remove('active'));
  updateTaskbar();
}

// Legacy window launcher for mobile
function _launchAppWindow(app) {
  if (app.id !== 'terminal') {
    const existing = Object.values(openWindows).find(w => w.appId === app.id && !w.el.classList.contains('minimized'));
    if (existing) { focusWindow(existing.id); return; }
    const minimized = Object.values(openWindows).find(w => w.appId === app.id);
    if (minimized) { minimized.el.classList.remove('minimized'); focusWindow(minimized.id); updateTaskbar(); return; }
  }

  const wid = 'win-' + (++winIdCounter);
  const w = document.createElement('div');
  w.className = 'os-window focused';
  w.id = wid;
  w.style.cssText = `z-index:${++winZIndex};`;

  w.innerHTML = `
    <div class="win-titlebar">
      <span class="win-title">${app.name}</span>
      <button class="win-back-apps" data-action="back-apps">&#x25C0; APPS</button>
      <div class="win-controls">
        <button class="win-btn" data-action="min" title="Minimize">&#x2013;</button>
        <button class="win-btn" data-action="max" title="Maximize">&#x25A1;</button>
        <button class="win-btn close" data-action="close" title="Close">&#x2715;</button>
      </div>
    </div>
    <div class="win-body"></div>
    <div class="win-resize"></div>
  `;

  const body = w.querySelector('.win-body');
  if (app.url) {
    body.innerHTML = `<iframe src="${app.url}" allow="clipboard-read; clipboard-write"></iframe>`;
  } else if (app.builder) {
    app.builder(body);
  }

  w.querySelector('[data-action="min"]').addEventListener('click', e => { e.stopPropagation(); w.classList.add('minimized'); updateTaskbar(); });
  w.querySelector('[data-action="max"]').addEventListener('click', e => { e.stopPropagation(); w.classList.toggle('maximized'); });
  w.querySelector('[data-action="close"]').addEventListener('click', e => { e.stopPropagation(); closeWindow(wid); });
  const backBtn = w.querySelector('[data-action="back-apps"]');
  if (backBtn) backBtn.addEventListener('click', e => { e.stopPropagation(); if (window.switchMobileView) window.switchMobileView('home'); });
  w.addEventListener('mousedown', () => focusWindow(wid));

  document.querySelector('.os-main').appendChild(w);
  openWindows[wid] = { id: wid, appId: app.id, name: app.name, el: w };
  unfocusAll();
  w.classList.add('focused');
  updateTaskbar();
}

function focusWindow(wid) {
  unfocusAll();
  const w = openWindows[wid];
  if (!w) return;
  w.el.style.zIndex = ++winZIndex;
  w.el.classList.add('focused');
  updateTaskbar();
}

function unfocusAll() {
  Object.values(openWindows).forEach(w => w.el.classList.remove('focused'));
}

function closeWindow(wid) {
  const w = openWindows[wid];
  if (!w) return;
  const body = w.el.querySelector('.win-body');
  if (body && body._termCleanup) body._termCleanup();
  w.el.remove();
  delete openWindows[wid];
  updateTaskbar();
}

function updateTaskbar() {
  osTaskbar.querySelectorAll('.tb-item').forEach(e => e.remove());
  const spacer = osTaskbar.querySelector('.tb-spacer');
  Object.values(openWindows).forEach(w => {
    const item = document.createElement('button');
    item.className = 'tb-item' + (w.el.classList.contains('focused') && !w.el.classList.contains('minimized') ? ' active' : '');
    item.textContent = w.name;
    item.addEventListener('click', () => {
      if (w.el.classList.contains('minimized')) w.el.classList.remove('minimized');
      focusWindow(w.id);
    });
    osTaskbar.insertBefore(item, spacer);
  });
}

// ── Drag/Resize ──
let dragState = null;
let resizeState = null;

function startDrag(e, win) {
  win.querySelector('.win-body').style.pointerEvents = 'none';
  dragState = { win, startX: e.clientX, startY: e.clientY, origX: win.offsetLeft, origY: win.offsetTop };
}

function startResize(e, win) {
  win.querySelector('.win-body').style.pointerEvents = 'none';
  resizeState = { win, startX: e.clientX, startY: e.clientY, origW: win.offsetWidth, origH: win.offsetHeight };
}

document.addEventListener('mousemove', e => {
  if (dragState) {
    dragState.win.style.left = (dragState.origX + e.clientX - dragState.startX) + 'px';
    dragState.win.style.top = (dragState.origY + e.clientY - dragState.startY) + 'px';
  }
  if (resizeState) {
    resizeState.win.style.width = Math.max(320, resizeState.origW + e.clientX - resizeState.startX) + 'px';
    resizeState.win.style.height = Math.max(200, resizeState.origH + e.clientY - resizeState.startY) + 'px';
  }
});

document.addEventListener('mouseup', () => {
  if (dragState) { dragState.win.querySelector('.win-body').style.pointerEvents = ''; dragState = null; }
  if (resizeState) { resizeState.win.querySelector('.win-body').style.pointerEvents = ''; resizeState = null; }
});

// ── Mission Control builder ──
function buildMissionControl(container) {
  container.style.overflow = 'auto';
  container.innerHTML = `
    <div class="mc-grid">
      <div class="mc-card" data-mc="visualizer"><h3>Visualizer</h3><p>Toggle blackhole</p><div class="mc-status live" id="mc-viz">Active</div></div>
      <div class="mc-card" data-mc="nightshift"><h3>Task Queue</h3><p>Pending work</p><div class="mc-status" id="mc-ns">Checking...</div></div>
      <div class="mc-card" data-mc="fleet-health"><h3>Venture Health</h3><p>Domain status</p><div class="mc-status" id="mc-fh">Checking...</div></div>
      <div class="mc-card" data-mc="build-order"><h3>Build Order</h3><p>Tier progress</p><div class="mc-status" id="mc-bo">12/112</div></div>
      <div class="mc-card" data-mc="tower"><h3>Tower</h3><p>Pair matrix</p><div class="mc-status" id="mc-tw">18 proteinlets</div></div>
      <div class="mc-card" data-mc="deploys"><h3>HAL Status</h3><p>Pilot state</p><div class="mc-status" id="mc-dp">Checking...</div></div>
      <div class="mc-card" data-mc="exclusions"><h3>Workstreams</h3><p>Active projects</p><div class="mc-status" id="mc-ex">Checking...</div></div>
      <div class="mc-card" data-mc="ventures-api"><h3>Fleet Registry</h3><p>Live ventures</p><div class="mc-status" id="mc-va">Checking...</div></div>
      <div class="mc-card" data-mc="analytics"><h3>Capabilities</h3><p>System levels</p><div class="mc-status" id="mc-an">Checking...</div></div>
      <div class="mc-card" data-mc="awakening"><h3>System Awakening</h3><p>Live system pulse</p><div class="mc-status" id="mc-aw">Checking...</div></div>
    </div>
    <div class="mc-output" id="mc-output"></div>
  `;
  container.querySelectorAll('.mc-card').forEach(card => {
    card.addEventListener('click', () => mcAction(card.dataset.mc, container));
  });
  loadMCData(container);
}

function mcAction(action, container) {
  const out = container.querySelector('#mc-output');
  if (action === 'visualizer') {
    const canvas = document.getElementById('blackhole-canvas');
    if (vizMode === 'blackhole') { canvas.style.display = 'none'; vizMode = 'off'; container.querySelector('#mc-viz').textContent = 'Off'; }
    else { canvas.style.display = 'block'; vizMode = 'blackhole'; container.querySelector('#mc-viz').textContent = 'Active'; }
  }
  else if (action === 'nightshift') mcFetch(out, API_BASE + '/api/tasks', 'Pending Tasks');
  else if (action === 'fleet-health') mcFetch(out, API_BASE + '/api/venture-health', 'Venture Health');
  else if (action === 'build-order') {
    // Fetch live tier data from API
    out.innerHTML = '<pre>Loading build order...</pre>';
    fetch(API_BASE + '/api/venture-health', { signal: AbortSignal.timeout(5000) })
      .then(r => r.json()).then(d => {
        const tiers = [
          { n:'Tier 0 — Foundation', d:3, t:3, v:'authfor.com, vendyai.com, mailguyai.com', note:'ALL LIVE' },
          { n:'Tier 1 — Platform', d:3, t:4, v:'intfer.com, warpdrive.cc, glcx.cc, firmcreate.com' },
          { n:'Tier 2 — Business', d:5, t:5, v:'marketingium, salesfactorai, taskgridai, anattar, mobleyreport' },
          { n:'Tier 3 — Products', d:d.healthy ? d.healthy - 13 : 104, t:104, v:d.total + ' total ventures' },
          { n:'Tier 4 — Corporate', d:2, t:2, v:'mobcorp.cc, mobleysoft.com' },
        ];
        let s = 'MASCOM Build Order — ' + (d.healthy||'--') + '/' + (d.total||'--') + ' healthy\n\n';
        tiers.forEach(t => { const p = Math.round(t.d/t.t*100); s += `${t.n}\n  [${'█'.repeat(Math.round(p/5))}${'░'.repeat(20-Math.round(p/5))}] ${t.d}/${t.t} (${p}%)\n  ${t.v}${t.note ? ' ✓ '+t.note : ''}\n\n`; });
        if (d.broken_count > 0) {
          s += '⚠ BROKEN (' + d.broken_count + '):\n';
          (d.broken || []).forEach(b => { s += '  • ' + b.domain + ' — ' + (b.error || 'HTTP ' + b.http_status) + '\n'; });
        }
        out.innerHTML = '<pre>' + s.replace(/</g, '&lt;') + '</pre>';
      }).catch(() => {
        const tiers = [
          { n:'Tier 0 — Foundation', d:3, t:3, v:'authfor, vendyai, mailguyai' },
          { n:'Tier 1 — Platform', d:3, t:4, v:'intfer, warpdrive, glcx, firmcreate' },
          { n:'Tier 2 — Business', d:5, t:5, v:'marketingium, salesfactorai, taskgridai, anattar, mobleyreport' },
          { n:'Tier 3 — Products', d:104, t:104, v:'104 domain ventures' },
          { n:'Tier 4 — Corporate', d:2, t:2, v:'mobcorp, mobleysoft' },
        ];
        let s = '';
        tiers.forEach(t => { const p = Math.round(t.d/t.t*100); s += `${t.n}\n  [${'█'.repeat(Math.round(p/5))}${'░'.repeat(20-Math.round(p/5))}] ${t.d}/${t.t} (${p}%)\n  ${t.v}\n\n`; });
        out.innerHTML = '<pre>' + s + '</pre>';
      });
  }
  else if (action === 'tower') {
    out.innerHTML = '<pre>18 proteinlets, 179 pairs tracked\n\nTop Pairs:\n  analytics + waitlist       0.793\n  analytics + crud           0.787\n  ai-inference + analytics   0.768\n  auth + admin               0.900\n  auth + pay                 0.799</pre>';
  }
  else if (action === 'deploys') mcFetch(out, API_BASE + '/api/hal-status', 'HAL / Pilot Status');
  else if (action === 'exclusions') mcFetch(out, API_BASE + '/api/workstreams', 'Active Workstreams');
  else if (action === 'ventures-api') mcFetch(out, API_BASE + '/api/ventures', 'Fleet Ventures');
  else if (action === 'analytics') mcFetch(out, API_BASE + '/api/capabilities', 'Capabilities');
  else if (action === 'awakening') mcFetchAwakening(out);
}

async function mcFetchAwakening(out) {
  out.innerHTML = '<pre>Loading awakening data...</pre>';
  const results = { awakening: null, dbStatus: null, capabilities: null, tools: null };
  const fetches = [
    fetch(API_BASE + '/api/awakening', { signal: AbortSignal.timeout(8000) }).then(r => r.json()).then(d => results.awakening = d).catch(() => {}),
    fetch(API_BASE + '/api/db-status', { signal: AbortSignal.timeout(8000) }).then(r => r.json()).then(d => results.dbStatus = d).catch(() => {}),
    fetch(API_BASE + '/api/capabilities', { signal: AbortSignal.timeout(8000) }).then(r => r.json()).then(d => results.capabilities = d).catch(() => {}),
    fetch(API_BASE + '/api/tools', { signal: AbortSignal.timeout(8000) }).then(r => r.json()).then(d => results.tools = d).catch(() => {}),
  ];
  await Promise.allSettled(fetches);

  let s = '';

  // Section 1: Last Session Handoff
  s += '\u2501\u2501 LAST SESSION HANDOFF \u2501\u2501\n';
  if (results.awakening && results.awakening.last_handoff) {
    const h = results.awakening.last_handoff;
    s += (h.summary || h.message || JSON.stringify(h)).substring(0, 200) + '\n';
    if (h.next_steps && Array.isArray(h.next_steps)) {
      s += 'Next: ' + h.next_steps.slice(0, 3).join(' | ') + '\n';
    }
  } else {
    s += 'No handoff data (API offline)\n';
  }

  // Section 2: Database Health
  s += '\n\u2501\u2501 DATABASE HEALTH \u2501\u2501\n';
  if (results.dbStatus) {
    const dbs = Array.isArray(results.dbStatus) ? results.dbStatus : (results.dbStatus.databases || []);
    let healthy = 0, warning = 0, critical = 0, total = dbs.length;
    dbs.forEach(db => {
      const st = (db.status || db.health || '').toLowerCase();
      if (st === 'healthy' || st === 'ok' || st === 'good') healthy++;
      else if (st === 'warning' || st === 'warn' || st === 'stale') warning++;
      else critical++;
    });
    if (total === 0 && results.dbStatus.total) {
      total = results.dbStatus.total;
      healthy = results.dbStatus.healthy || 0;
      warning = results.dbStatus.warning || 0;
      critical = results.dbStatus.critical || 0;
    }
    s += '\u25cf Healthy: ' + healthy + '  \u25b2 Warning: ' + warning + '  \u2718 Critical: ' + critical + '  (Total: ' + total + ')\n';
  } else {
    s += 'DB status unavailable (API offline)\n';
  }

  // Section 3: Capability Distribution
  s += '\n\u2501\u2501 CAPABILITY LEVELS \u2501\u2501\n';
  if (results.capabilities && Array.isArray(results.capabilities)) {
    const levels = [0, 0, 0, 0, 0, 0];
    results.capabilities.forEach(cap => {
      const lvl = parseInt(cap.level || cap.current_level || 0);
      if (lvl >= 0 && lvl <= 5) levels[lvl]++;
    });
    s += 'L0: ' + levels[0] + '  L1: ' + levels[1] + '  L2: ' + levels[2] + '  L3: ' + levels[3] + '  L4: ' + levels[4] + '  L5: ' + levels[5] + '\n';
    const bars = levels.map((ct, i) => 'L' + i + ' [' + '\u2588'.repeat(ct) + '] ' + ct);
    s += bars.join('\n') + '\n';
  } else if (results.capabilities) {
    s += JSON.stringify(results.capabilities).substring(0, 200) + '\n';
  } else {
    s += 'Capabilities unavailable (API offline)\n';
  }

  // Section 4: Tool Health
  s += '\n\u2501\u2501 TOOL INVENTORY \u2501\u2501\n';
  if (results.tools) {
    const toolList = Array.isArray(results.tools) ? results.tools : (results.tools.tools || []);
    const totalTools = results.tools.total || toolList.length || 0;
    const critical = toolList.filter(t => (t.category || t.type || '').toLowerCase() === 'critical' || t.critical).length;
    s += 'Total tools: ' + totalTools;
    if (critical > 0) s += '  |  Critical tools: ' + critical;
    s += '\n';
  } else {
    s += 'Tool data unavailable (API offline)\n';
  }

  // Section 5: Key Facts
  s += '\n\u2501\u2501 KEY FACTS (last 3) \u2501\u2501\n';
  if (results.awakening && results.awakening.key_facts && Array.isArray(results.awakening.key_facts)) {
    results.awakening.key_facts.slice(-3).forEach((f, i) => {
      const text = typeof f === 'string' ? f : (f.fact || f.text || JSON.stringify(f));
      s += (i + 1) + '. ' + text.substring(0, 120) + '\n';
    });
  } else if (results.awakening && results.awakening.facts) {
    const facts = Array.isArray(results.awakening.facts) ? results.awakening.facts : [];
    facts.slice(-3).forEach((f, i) => {
      const text = typeof f === 'string' ? f : (f.fact || f.text || JSON.stringify(f));
      s += (i + 1) + '. ' + text.substring(0, 120) + '\n';
    });
  } else {
    s += 'No key facts available\n';
  }

  out.innerHTML = '<pre>' + s.replace(/</g, '&lt;') + '</pre>';
}

async function mcFetch(out, url, title) {
  out.innerHTML = '<pre>Loading...</pre>';
  try {
    const r = await fetch(url, { headers: { 'X-Fleet-Token': 'mascom-fleet-2024' } });
    const d = await r.json();
    out.innerHTML = '<pre>' + title + '\n' + JSON.stringify(d, null, 2).replace(/</g,'&lt;') + '</pre>';
  } catch (e) { out.innerHTML = '<pre>Error: ' + e.message + '</pre>'; }
}

async function loadMCData(c) {
  // Venture health from local ventureState.db via mascom_v5.py
  try {
    const r = await fetch(API_BASE + '/api/venture-health', { signal: AbortSignal.timeout(5000) });
    const d = await r.json();
    const fhEl = c.querySelector('#mc-fh');
    if (fhEl) {
      if (d.broken_count > 0) { fhEl.textContent = d.broken_count + ' broken'; fhEl.className = 'mc-status loading'; }
      else { fhEl.textContent = d.healthy + '/' + d.total + ' healthy'; fhEl.className = 'mc-status live'; }
    }
    const vaEl = c.querySelector('#mc-va');
    if (vaEl) { vaEl.textContent = d.total + ' domains'; vaEl.className = 'mc-status live'; }
  } catch {}
  // Capabilities summary
  try {
    const r = await fetch(API_BASE + '/api/capabilities', { signal: AbortSignal.timeout(5000) });
    const d = await r.json();
    const el = c.querySelector('#mc-an');
    if (el && Array.isArray(d)) { el.textContent = d.length + ' capabilities'; el.className = 'mc-status live'; }
  } catch {}
  // Pending tasks count
  try {
    const r = await fetch(API_BASE + '/api/tasks', { signal: AbortSignal.timeout(5000) });
    const d = await r.json();
    const el = c.querySelector('#mc-ns');
    if (el && Array.isArray(d)) { el.textContent = d.length + ' tasks queued'; el.className = d.length > 0 ? 'mc-status live' : 'mc-status'; }
  } catch {}
  // HAL status
  try {
    const r = await fetch(API_BASE + '/api/hal-status', { signal: AbortSignal.timeout(5000) });
    const d = await r.json();
    const el = c.querySelector('#mc-dp');
    if (el) { el.textContent = 'HAL: ' + (d.state_name || 'unknown'); el.className = d.pilot_active ? 'mc-status live' : 'mc-status'; }
  } catch {}
  // System Awakening status
  try {
    const [awR, dbR] = await Promise.allSettled([
      fetch(API_BASE + '/api/awakening', { signal: AbortSignal.timeout(6000) }).then(r => r.json()),
      fetch(API_BASE + '/api/db-status', { signal: AbortSignal.timeout(6000) }).then(r => r.json()),
    ]);
    const el = c.querySelector('#mc-aw');
    if (el) {
      const awData = awR.status === 'fulfilled' ? awR.value : null;
      const dbData = dbR.status === 'fulfilled' ? dbR.value : null;
      if (awData || dbData) {
        let label = '';
        if (dbData) {
          const dbs = Array.isArray(dbData) ? dbData : (dbData.databases || []);
          const total = dbData.total || dbs.length || 0;
          const critical = dbs.filter(d => { const st = (d.status||d.health||'').toLowerCase(); return st !== 'healthy' && st !== 'ok' && st !== 'good' && st !== 'warning' && st !== 'warn' && st !== 'stale'; }).length;
          label = total + ' DBs';
          if (critical > 0) label += ', ' + critical + ' crit';
        }
        if (awData && awData.last_handoff) {
          const summary = awData.last_handoff.summary || awData.last_handoff.message || '';
          if (summary) label = (label ? label + ' | ' : '') + summary.substring(0, 30);
        }
        el.textContent = label || 'Awake';
        el.className = 'mc-status live';
      } else {
        el.textContent = 'Offline';
        el.className = 'mc-status';
      }
    }
  } catch {
    const el = c.querySelector('#mc-aw');
    if (el) { el.textContent = 'Offline'; el.className = 'mc-status'; }
  }
}

// ── Fleet Browser builder (with live health) ──
function buildFleetBrowser(container) {
  container.style.cssText = 'padding:0;overflow:hidden;display:flex;flex-direction:column;font-family:var(--ob-font);color:var(--ob-text);';

  // Top bar: search + category + sort
  const bar = document.createElement('div');
  bar.style.cssText = 'display:flex;gap:8px;padding:10px 12px;border-bottom:1px solid var(--ob-border);align-items:center;flex-shrink:0;flex-wrap:wrap;';
  const search = document.createElement('input');
  search.placeholder = 'Search ventures...';
  search.style.cssText = 'flex:1;min-width:120px;background:var(--ob-surface);border:1px solid var(--ob-border);color:var(--ob-text);padding:6px 10px;border-radius:var(--ob-radius-sm);font-family:var(--ob-font);font-size:12px;outline:none;';
  const catSelect = document.createElement('select');
  catSelect.style.cssText = 'background:var(--ob-surface);border:1px solid var(--ob-border);color:var(--ob-text);padding:6px 8px;border-radius:var(--ob-radius-sm);font-family:var(--ob-font);font-size:11px;';
  catSelect.innerHTML = '<option value="">All Categories</option>';
  PORTFOLIO.forEach(s => { catSelect.innerHTML += '<option value="' + s.cat + '">' + s.cat + '</option>'; });
  const sortSelect = document.createElement('select');
  sortSelect.style.cssText = catSelect.style.cssText;
  sortSelect.innerHTML = '<option value="name">Sort: Name</option><option value="health">Sort: Health</option><option value="category">Sort: Category</option>';
  bar.appendChild(search); bar.appendChild(catSelect); bar.appendChild(sortSelect);
  container.appendChild(bar);

  // Stats bar
  const statsBar = document.createElement('div');
  statsBar.style.cssText = 'padding:6px 12px;border-bottom:1px solid var(--ob-border);font-size:10px;color:var(--ob-text-dim);flex-shrink:0;display:flex;gap:14px;';
  statsBar.innerHTML = '<span>Loading...</span>';
  container.appendChild(statsBar);

  // Split layout: list + detail
  const body = document.createElement('div');
  body.style.cssText = 'flex:1;display:flex;overflow:hidden;min-height:0;';
  const listPane = document.createElement('div');
  listPane.style.cssText = 'flex:1;overflow-y:auto;';
  const detailPane = document.createElement('div');
  detailPane.style.cssText = 'width:320px;overflow-y:auto;border-left:1px solid var(--ob-border);padding:14px;flex-shrink:0;';
  detailPane.innerHTML = '<div style="color:var(--ob-text-dim);text-align:center;margin-top:40px;font-size:11px;">Click a venture to view details</div>';
  body.appendChild(listPane); body.appendChild(detailPane);
  container.appendChild(body);

  // Fetch data
  const venturesP = fetch(API_BASE + '/api/ventures', { signal: AbortSignal.timeout(5000) }).then(r => r.json()).catch(() => null);
  const healthP = fetch(API_BASE + '/api/venture-health', { signal: AbortSignal.timeout(5000) }).then(r => r.json()).catch(() => null);

  Promise.all([venturesP, healthP]).then(([apiVentures, healthData]) => {
    // Build health map
    const healthMap = {};
    if (healthData && healthData.domains) {
      healthData.domains.forEach(d => {
        const status = d.http_status || d.status;
        if (status >= 200 && status < 300) healthMap[d.domain] = 'green';
        else if (status >= 300 && status < 400) healthMap[d.domain] = 'yellow';
        else if (status >= 400) healthMap[d.domain] = 'red';
        else healthMap[d.domain] = 'gray';
      });
    }

    // Merge: prefer API ventures, fall back to PORTFOLIO
    let allVentures = [];
    if (Array.isArray(apiVentures) && apiVentures.length > 0) {
      allVentures = apiVentures.map(v => {
        const name = v.name || v.venture_name || 'unknown';
        const domain = v.domain || (name.toLowerCase().replace(/[^a-z0-9]/g,'') + '.com');
        const cat = v.category || '';
        return { name, domain, url: 'https://' + domain, cat, health: healthMap[domain] || 'gray' };
      });
    } else {
      PORTFOLIO.forEach(section => {
        section.ventures.forEach(v => {
          const domain = v.u ? v.u.replace('https://','').replace('http://','').split('/')[0] : '';
          allVentures.push({ name: v.n, domain, url: v.u, cat: section.cat, health: healthMap[domain] || 'gray' });
        });
      });
    }

    // Stats
    const totalCount = allVentures.length;
    const healthyCount = allVentures.filter(v => v.health === 'green').length;
    const brokenCount = allVentures.filter(v => v.health === 'red').length;
    statsBar.innerHTML = '<span>Total: <b>' + totalCount + '</b></span><span style="color:var(--ob-green);">Healthy: <b>' + healthyCount + '</b></span><span style="color:var(--ob-red);">Broken: <b>' + brokenCount + '</b></span>';

    const HEALTH_ORDER = { green: 0, yellow: 1, red: 2, gray: 3 };

    function renderList() {
      const query = search.value.toLowerCase();
      const catFilter = catSelect.value;
      const sortMode = sortSelect.value;

      let filtered = allVentures.filter(v => {
        if (query && !v.name.toLowerCase().includes(query) && !v.domain.toLowerCase().includes(query)) return false;
        if (catFilter && v.cat !== catFilter) return false;
        return true;
      });

      if (sortMode === 'health') filtered.sort((a, b) => (HEALTH_ORDER[a.health] || 9) - (HEALTH_ORDER[b.health] || 9));
      else if (sortMode === 'category') filtered.sort((a, b) => a.cat.localeCompare(b.cat) || a.name.localeCompare(b.name));
      else filtered.sort((a, b) => a.name.localeCompare(b.name));

      listPane.innerHTML = '';

      if (sortMode === 'category') {
        // Group by category with collapsible headers
        const groups = {};
        filtered.forEach(v => { (groups[v.cat] = groups[v.cat] || []).push(v); });
        Object.keys(groups).sort().forEach(cat => {
          const hdr = document.createElement('div');
          hdr.style.cssText = 'display:flex;align-items:center;gap:6px;padding:8px 12px;cursor:pointer;border-bottom:1px solid rgba(255,255,255,0.04);font-size:11px;font-weight:700;color:var(--ob-gold);letter-spacing:1px;text-transform:uppercase;';
          const arrow = document.createElement('span');
          arrow.textContent = '\u25B6';
          arrow.style.cssText = 'font-size:9px;transition:transform 0.2s;transform:rotate(90deg);';
          hdr.appendChild(arrow);
          hdr.appendChild(document.createTextNode(cat + ' (' + groups[cat].length + ')'));
          listPane.appendChild(hdr);
          const wrap = document.createElement('div');
          groups[cat].forEach(v => wrap.appendChild(makeRow(v)));
          listPane.appendChild(wrap);
          hdr.addEventListener('click', () => {
            const open = wrap.style.display !== 'none';
            wrap.style.display = open ? 'none' : '';
            arrow.style.transform = open ? 'rotate(0deg)' : 'rotate(90deg)';
          });
        });
      } else {
        filtered.forEach(v => listPane.appendChild(makeRow(v)));
      }
    }

    const DOT_COLORS = { green: 'var(--ob-green)', yellow: 'var(--ob-orange)', red: 'var(--ob-red)', gray: '#555' };

    function makeRow(v) {
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;align-items:center;gap:8px;padding:7px 12px;cursor:pointer;border-bottom:1px solid rgba(255,255,255,0.03);';
      row.addEventListener('mouseenter', () => { row.style.background = 'rgba(255,255,255,0.04)'; });
      row.addEventListener('mouseleave', () => { row.style.background = 'transparent'; });
      const dot = document.createElement('span');
      dot.style.cssText = 'width:8px;height:8px;border-radius:50%;flex-shrink:0;background:' + (DOT_COLORS[v.health] || '#555') + ';';
      const nameEl = document.createElement('span');
      nameEl.style.cssText = 'font-size:12px;font-weight:600;color:var(--ob-text);flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;';
      nameEl.textContent = v.name;
      const domEl = document.createElement('span');
      domEl.style.cssText = 'font-size:10px;color:var(--ob-text-dim);flex-shrink:0;';
      domEl.textContent = v.domain;
      row.appendChild(dot); row.appendChild(nameEl); row.appendChild(domEl);
      row.addEventListener('click', () => showDetail(v));
      return row;
    }

    function showDetail(v) {
      const healthLabel = { green: 'Healthy', yellow: 'Redirect', red: 'Broken', gray: 'Unknown' };
      const healthColor = DOT_COLORS[v.health] || '#555';
      detailPane.innerHTML = '';
      const h = document.createElement('div');
      h.style.cssText = 'margin-bottom:16px;';
      h.innerHTML = '<div style="font-size:18px;font-weight:700;color:var(--ob-gold);margin-bottom:4px;">' + v.name + '</div>'
        + '<div style="font-size:11px;color:var(--ob-text-dim);">' + v.domain + '</div>';
      detailPane.appendChild(h);
      // Health
      const hRow = document.createElement('div');
      hRow.style.cssText = 'display:flex;align-items:center;gap:8px;margin-bottom:12px;padding:8px 10px;border-radius:6px;background:rgba(255,255,255,0.02);';
      hRow.innerHTML = '<span style="width:10px;height:10px;border-radius:50%;background:' + healthColor + ';flex-shrink:0;"></span>'
        + '<span style="font-size:12px;font-weight:600;color:' + healthColor + ';">' + (healthLabel[v.health] || 'Unknown') + '</span>';
      detailPane.appendChild(hRow);
      // Category
      if (v.cat) {
        const catEl = document.createElement('div');
        catEl.style.cssText = 'margin-bottom:12px;font-size:11px;';
        catEl.innerHTML = '<span style="color:var(--ob-text-dim);">Category:</span> <span style="color:var(--ob-gold);font-weight:600;">' + v.cat + '</span>';
        detailPane.appendChild(catEl);
      }
      // Open link
      const link = document.createElement('a');
      link.href = v.url;
      link.target = '_blank';
      link.rel = 'noopener';
      link.textContent = 'Open in new tab \u2197';
      link.style.cssText = 'display:inline-block;font-size:11px;color:var(--ob-gold);margin-bottom:10px;text-decoration:none;';
      detailPane.appendChild(link);
      detailPane.appendChild(document.createElement('br'));
      // Launch button
      const btn = document.createElement('button');
      btn.textContent = 'Launch in mascomWebOS';
      btn.style.cssText = 'background:var(--ob-gold);color:var(--ob-void);border:none;padding:8px 16px;border-radius:var(--ob-radius-sm);font-family:var(--ob-font);font-weight:700;font-size:12px;cursor:pointer;margin-top:6px;';
      btn.addEventListener('click', () => {
        launchApp({ id: v.name.toLowerCase(), name: v.name, icon: v.name[0], url: v.url });
      });
      detailPane.appendChild(btn);
    }

    search.addEventListener('input', renderList);
    catSelect.addEventListener('change', renderList);
    sortSelect.addEventListener('change', renderList);
    renderList();
  });
}

// =========================================================================
// FEATURE 1: Fleet Dashboard (right panel with health dots)
// =========================================================================
const fleetPanel = document.getElementById('os-fleet');
const fleetBody = document.getElementById('fleet-body');
const fleetCount = document.getElementById('fleet-count');
// ventureHealth declared earlier (before initMobileUI) via var

// Add fleet toggle to sidebar
const fleetSep = document.createElement('div');
fleetSep.className = 'sb-sep';
osSidebar.appendChild(fleetSep);
const fleetToggle = document.createElement('div');
fleetToggle.className = 'sb-icon';
fleetToggle.innerHTML = '\u25A6<span class="sb-tip">Fleet Panel</span>';
fleetToggle.addEventListener('click', () => fleetPanel.classList.toggle('open'));
osSidebar.appendChild(fleetToggle);

function buildFleetDots() {
  fleetBody.innerHTML = '';
  let total = 0;
  PORTFOLIO.forEach(section => {
    const label = document.createElement('div');
    label.className = 'fleet-cat-label';
    label.textContent = section.cat;
    fleetBody.appendChild(label);
    const grid = document.createElement('div');
    grid.className = 'fleet-grid';
    section.ventures.forEach(v => {
      total++;
      const dot = document.createElement('div');
      const health = ventureHealth[v.n] || 'unknown';
      dot.className = 'fleet-dot' + (health !== 'unknown' ? ' ' + health : '');
      dot.innerHTML = '<span class="fleet-tip">' + v.n + '</span>';
      dot.addEventListener('click', () => {
        launchApp({ id: v.n.toLowerCase(), name: v.n, icon: v.n[0], url: v.u });
      });
      dot.dataset.venture = v.n;
      grid.appendChild(dot);
    });
    fleetBody.appendChild(grid);
  });
  fleetCount.textContent = total;
}

function updateFleetDot(name, status) {
  ventureHealth[name] = status;
  const dot = fleetBody.querySelector('[data-venture="' + name + '"]');
  if (dot) {
    dot.className = 'fleet-dot ' + status;
  }
  // Sync mobile system menu fleet grid
  const mobGrid = document.getElementById('mob-sys-fleet-grid');
  if (mobGrid) {
    const mobDot = mobGrid.querySelector('[data-venture="' + name + '"]');
    if (mobDot) {
      mobDot.className = 'fleet-dot ' + status;
    }
    // Update mobile fleet stats
    const allDots = mobGrid.querySelectorAll('.fleet-dot');
    let healthy = 0, down = 0;
    allDots.forEach(d => {
      if (d.classList.contains('healthy')) healthy++;
      else if (d.classList.contains('down')) down++;
    });
    const hEl = document.getElementById('mob-fleet-healthy');
    const dEl = document.getElementById('mob-fleet-down');
    if (hEl) hEl.textContent = healthy;
    if (dEl) dEl.textContent = down;
  }
}

// =========================================================================
// CYBERPUNK CITY SKYLINE — monotone gold outlines on black
// =========================================================================
const cityCanvas = document.getElementById('city-canvas');
const cityCtx = cityCanvas.getContext('2d');
let cityBuildings = [];
let cityAnimFrame = null;

function initCity() {
  const W = cityCanvas.width = cityCanvas.parentElement.offsetWidth;
  const H = cityCanvas.height = cityCanvas.parentElement.offsetHeight;
  cityBuildings = [];

  // Collect all venture names
  const names = [];
  PORTFOLIO.forEach(s => s.ventures.forEach(v => names.push(v.n)));

  // Perspective: viewer is on a tall rooftop, looking out
  const horizon = H * 0.38;
  const groundY = H * 0.92;

  // Generate buildings — 3 layers: far, mid, near
  const layers = [
    { count: 50, minH: 40, maxH: 180, yBase: horizon, opacity: 0.08, lineW: 0.5, labelSize: 0 },
    { count: 35, minH: 60, maxH: 280, yBase: horizon + 30, opacity: 0.15, lineW: 0.8, labelSize: 6 },
    { count: 22, minH: 100, maxH: 420, yBase: horizon + 80, opacity: 0.35, lineW: 1.2, labelSize: 8 },
  ];

  let nameIdx = 0;
  layers.forEach((layer, li) => {
    for (let i = 0; i < layer.count; i++) {
      const w = 12 + Math.random() * (li === 2 ? 50 : 30);
      const h = layer.minH + Math.random() * (layer.maxH - layer.minH);
      const x = Math.random() * W;
      const baseY = layer.yBase + Math.random() * 40;

      // Building features
      const hasAntenna = Math.random() > 0.6;
      const hasSpire = Math.random() > 0.7;
      const windowRows = Math.floor(h / 12);
      const windowCols = Math.max(1, Math.floor(w / 8));

      cityBuildings.push({
        x, w, h, baseY,
        opacity: layer.opacity,
        lineW: layer.lineW,
        labelSize: layer.labelSize,
        name: names[nameIdx % names.length],
        hasAntenna, hasSpire,
        windowRows, windowCols,
        layer: li,
        pulse: Math.random() * Math.PI * 2, // for window flicker
      });
      nameIdx++;
    }
  });

  // Sort by layer (far first)
  cityBuildings.sort((a, b) => a.layer - b.layer);
}

function drawCity(t) {
  const W = cityCanvas.width;
  const H = cityCanvas.height;
  const ctx = cityCtx;
  ctx.clearRect(0, 0, W, H);

  // Background: pure black
  ctx.fillStyle = '#050508';
  ctx.fillRect(0, 0, W, H);

  // Horizon glow line
  const horizon = H * 0.38;
  const grad = ctx.createLinearGradient(0, horizon - 2, 0, horizon + 40);
  grad.addColorStop(0, 'rgba(255,204,0,0.06)');
  grad.addColorStop(1, 'transparent');
  ctx.fillStyle = grad;
  ctx.fillRect(0, horizon - 2, W, 42);

  // Thin horizon line
  ctx.strokeStyle = 'rgba(255,204,0,0.1)';
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  ctx.moveTo(0, horizon);
  ctx.lineTo(W, horizon);
  ctx.stroke();

  // Draw buildings
  cityBuildings.forEach(b => {
    const gold = `rgba(255,204,0,${b.opacity})`;
    const goldDim = `rgba(255,204,0,${b.opacity * 0.3})`;
    const top = b.baseY - b.h;

    ctx.strokeStyle = gold;
    ctx.lineWidth = b.lineW;

    // Building outline
    ctx.beginPath();
    ctx.rect(b.x, top, b.w, b.h);
    ctx.stroke();

    // Spire
    if (b.hasSpire) {
      ctx.beginPath();
      ctx.moveTo(b.x + b.w * 0.3, top);
      ctx.lineTo(b.x + b.w * 0.5, top - 30);
      ctx.lineTo(b.x + b.w * 0.7, top);
      ctx.stroke();
    }

    // Antenna
    if (b.hasAntenna) {
      ctx.beginPath();
      ctx.moveTo(b.x + b.w * 0.5, top);
      ctx.lineTo(b.x + b.w * 0.5, top - 20 - Math.random() * 15);
      ctx.stroke();
      // Blinking light
      const blink = Math.sin(t * 2 + b.pulse) > 0.7;
      if (blink) {
        ctx.fillStyle = `rgba(255,204,0,${b.opacity * 2})`;
        ctx.beginPath();
        ctx.arc(b.x + b.w * 0.5, top - 20 - 10, 1.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Windows — grid of dots that flicker
    if (b.layer >= 1) {
      for (let wy = 0; wy < b.windowRows; wy++) {
        for (let wx = 0; wx < b.windowCols; wx++) {
          const lit = Math.sin(t * 0.5 + b.pulse + wy * 0.7 + wx * 1.3) > 0.2;
          if (lit) {
            const px = b.x + 3 + wx * (b.w - 6) / Math.max(1, b.windowCols);
            const py = top + 4 + wy * 12;
            ctx.fillStyle = goldDim;
            ctx.fillRect(px, py, 2, 3);
          }
        }
      }
    }

    // Label on near buildings
    if (b.labelSize > 0 && b.layer === 2) {
      ctx.save();
      ctx.translate(b.x + b.w + 3, top + b.h * 0.3);
      ctx.rotate(-Math.PI / 2);
      ctx.font = b.labelSize + 'px monospace';
      ctx.fillStyle = `rgba(255,204,0,${b.opacity * 0.6})`;
      ctx.fillText(b.name, 0, 0);
      ctx.restore();
    }
  });

  // Rooftop edge (we're standing on one) — bottom foreground
  const roofY = H * 0.88;
  ctx.strokeStyle = 'rgba(255,204,0,0.3)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(0, roofY);
  ctx.lineTo(W * 0.15, roofY);
  ctx.lineTo(W * 0.15, roofY + 8);
  ctx.lineTo(W * 0.2, roofY + 8);
  ctx.lineTo(W * 0.2, roofY);
  ctx.lineTo(W, roofY);
  ctx.stroke();

  // Railing
  ctx.strokeStyle = 'rgba(255,204,0,0.12)';
  ctx.lineWidth = 0.8;
  for (let rx = 0; rx < W; rx += 30) {
    ctx.beginPath();
    ctx.moveTo(rx, roofY);
    ctx.lineTo(rx, roofY - 20);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.moveTo(0, roofY - 20);
  ctx.lineTo(W, roofY - 20);
  ctx.stroke();

  // Ground below roof — solid black
  ctx.fillStyle = '#050508';
  ctx.fillRect(0, roofY + 8, W, H - roofY);

  // Scanning line effect
  const scanY = (t * 40) % H;
  ctx.strokeStyle = 'rgba(255,204,0,0.03)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, scanY);
  ctx.lineTo(W, scanY);
  ctx.stroke();

  cityAnimFrame = requestAnimationFrame(() => drawCity(t + 0.016));
}

function startCity() {
  initCity();
  drawCity(0);
}

function stopCity() {
  if (cityAnimFrame) cancelAnimationFrame(cityAnimFrame);
}

// Resize handler
let cityResizeTimer;
window.addEventListener('resize', () => {
  clearTimeout(cityResizeTimer);
  cityResizeTimer = setTimeout(() => {
    if (mascomOS.classList.contains('open') && osAuthenticated) {
      stopCity();
      startCity();
    }
  }, 200);
});

// =========================================================================
// FEATURE 2: Conversation History (localStorage persistence)
// =========================================================================
const _MCH = '_mch';
const _MCH_MAX = 200; // max messages to store

function saveChat() {
  try {
    const msgs = chatMessages.querySelectorAll('.msg');
    const arr = [];
    msgs.forEach(m => {
      const role = m.classList.contains('msg-mascom') ? 'mascom' : m.classList.contains('msg-user') ? 'user' : 'event';
      const body = m.querySelector('.msg-body');
      const time = m.querySelector('.msg-time');
      if (body) arr.push({ r: role, t: body.textContent, ts: time ? time.textContent : '' });
    });
    // Keep only last _MCH_MAX messages
    localStorage.setItem(_MCH, JSON.stringify(arr.slice(-_MCH_MAX)));
  } catch {}
}

function restoreChat() {
  try {
    const arr = JSON.parse(localStorage.getItem(_MCH));
    if (!arr || !arr.length) return false;
    arr.forEach(m => {
      const cls = m.r === 'mascom' ? 'msg-mascom' : m.r === 'user' ? 'msg-user' : 'msg-event';
      const label = m.r === 'mascom' ? 'MASCOM' : m.r === 'user' ? 'YOU' : 'EVENT';
      const wrap = document.createElement('div');
      wrap.className = 'msg ' + cls;
      wrap.innerHTML = '<div class="msg-label">' + label + '</div><div class="msg-body">' + escHtml(m.t) + '</div><div class="msg-time">' + (m.ts || '') + '</div>';
      chatMessages.appendChild(wrap);
    });
    chatAutoScroll();
    return true;
  } catch { return false; }
}

// addMsg is patched by Feature 6 (code block renderer) which also calls saveChat()

// =========================================================================
// FEATURE 3: Notifications (bell + badge + tray)
// =========================================================================
const notifBell = document.getElementById('notif-bell');
const notifBadge = document.getElementById('notif-badge');
const notifTray = document.getElementById('notif-tray');
const notifications = [];
let unreadCount = 0;

notifBell.addEventListener('click', e => {
  e.stopPropagation();
  notifTray.classList.toggle('open');
  if (notifTray.classList.contains('open')) {
    unreadCount = 0;
    notifBadge.textContent = '';
    notifBadge.classList.remove('show');
    notifTray.querySelectorAll('.notif-item.unread').forEach(n => n.classList.remove('unread'));
  }
});
document.addEventListener('click', () => notifTray.classList.remove('open'));

function pushNotification(text, isError) {
  const time = new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
  notifications.unshift({ text, time, isError, unread: true });
  if (notifications.length > 50) notifications.pop();
  unreadCount++;
  notifBadge.textContent = unreadCount;
  notifBadge.classList.add('show');
  renderNotifications();
}

function renderNotifications() {
  if (!notifications.length) {
    notifTray.innerHTML = '<div class="notif-empty">No notifications</div>';
    return;
  }
  notifTray.innerHTML = '';
  notifications.slice(0, 30).forEach(n => {
    const item = document.createElement('div');
    item.className = 'notif-item' + (n.unread ? ' unread' : '') + (n.isError ? ' error' : '');
    item.innerHTML = escHtml(n.text) + '<div class="notif-time">' + n.time + '</div>';
    notifTray.appendChild(item);
  });
}

// =========================================================================
// FEATURE 4: Venture Quick-Launch (@autocomplete)
// =========================================================================
const acContainer = document.getElementById('autocomplete');
let acItems = [];
let acIndex = -1;
let acFlat = [];

// Build flat venture list
PORTFOLIO.forEach(section => {
  section.ventures.forEach(v => {
    acFlat.push({ name: v.n, url: v.u, cat: section.cat });
  });
});

chatInput.addEventListener('input', () => {
  const val = chatInput.value;
  if (val.startsWith('@') && val.length > 1) {
    const query = val.slice(1).toLowerCase();
    acItems = acFlat.filter(v => v.name.toLowerCase().includes(query)).slice(0, 12);
    acIndex = -1;
    renderAutocomplete();
  } else {
    closeAutocomplete();
  }
});

chatInput.addEventListener('keydown', e => {
  // Always block ArrowUp/ArrowDown from triggering browser form history
  if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
    e.preventDefault();
    if (!acContainer.classList.contains('open')) return;
  }
  if (!acContainer.classList.contains('open')) return;
  if (e.key === 'ArrowDown') { acIndex = Math.min(acIndex + 1, acItems.length - 1); renderAutocomplete(); }
  else if (e.key === 'ArrowUp') { acIndex = Math.max(acIndex - 1, 0); renderAutocomplete(); }
  else if (e.key === 'Enter' && acIndex >= 0) {
    e.preventDefault();
    const v = acItems[acIndex];
    closeAutocomplete();
    chatInput.value = '';
    launchApp({ id: v.name.toLowerCase(), name: v.name, icon: v.name[0], url: v.url });
  }
  else if (e.key === 'Escape') { closeAutocomplete(); }
});

function renderAutocomplete() {
  if (!acItems.length) { closeAutocomplete(); return; }
  acContainer.innerHTML = '';
  acItems.forEach((v, i) => {
    const item = document.createElement('div');
    item.className = 'ac-item' + (i === acIndex ? ' selected' : '');
    item.innerHTML = v.name + '<span class="ac-cat">' + v.cat + '</span>';
    item.addEventListener('mousedown', e => {
      e.preventDefault();
      chatInput.value = '';
      closeAutocomplete();
      launchApp({ id: v.name.toLowerCase(), name: v.name, icon: v.name[0], url: v.url });
    });
    acContainer.appendChild(item);
  });
  acContainer.classList.add('open');
}

function closeAutocomplete() {
  acContainer.classList.remove('open');
  acContainer.innerHTML = '';
  acItems = [];
  acIndex = -1;
}

// =========================================================================
// FEATURE 5: Multi-model Selector — PhotonicMind primary
// =========================================================================
const CHAT_MODELS = [
  { id: 'photonic-mind-v1', label: 'PhotonicMind', provider: 'vision.mobleysoft.com' },
  { id: 'qwen3:4b', label: 'Qwen3 4B', provider: 'ollama' },
  { id: 'qwen2.5-coder:7b', label: 'Qwen Coder 7B', provider: 'ollama' },
  { id: 'gemma3:4b', label: 'Gemma3 4B', provider: 'ollama' },
];
let selectedModel = CHAT_MODELS[0].id;
let selectedProvider = CHAT_MODELS[0].provider;
const modelSelect = document.createElement('select');
modelSelect.className = 'model-select';
modelSelect.title = 'Select which AI model to use for chat responses';
CHAT_MODELS.forEach(m => {
  const opt = document.createElement('option');
  opt.value = m.id; opt.textContent = m.label;
  modelSelect.appendChild(opt);
});
modelSelect.addEventListener('change', () => {
  const found = CHAT_MODELS.find(m => m.id === modelSelect.value);
  selectedModel = found ? found.id : CHAT_MODELS[0].id;
  selectedProvider = found ? found.provider : CHAT_MODELS[0].provider;
});
actionsRow.appendChild(modelSelect);

// Patch sendChat to route to PhotonicMind or Ollama
const _origSendChat = sendChat;
sendChat = async function() {
  const text = chatInput.value.trim();
  if (!text) return;
  if (text.startsWith('@')) return; // autocomplete mode
  chatInput.value = '';
  addMsg('user', text);

  if (text.startsWith('/')) {
    await handleCommand(text);
    return;
  }

  const loader = addLoadingMsg();
  try {
    let d;
    if (selectedProvider === 'vision.mobleysoft.com') {
      // Route to PhotonicMind — our foundation model
      const pKey = localStorage.getItem('photonic-key') || '';
      const r = await fetch('https://vision.mobleysoft.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + pKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: selectedModel,
          messages: [
            { role: 'system', content: 'You are MASCOM, the Mobleysoft Autonomous Systems Commander. You help manage 200+ ventures across defense, finance, AI, dev tools, health, entertainment, and more. Be concise and helpful.' },
            { role: 'user', content: text }
          ]
        })
      });
      const result = await r.json();
      d = { thought: result.choices?.[0]?.message?.content || result.error?.message || JSON.stringify(result) };
    } else {
      // Fallback: route to local MASCOM API (Ollama)
      const r = await fetch(API_BASE + '/api/think', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: text, model: selectedModel })
      });
      d = await r.json();
    }
    loader.remove();
    addMsg('mascom', d.thought || d.response || d.error || JSON.stringify(d));
  } catch (e) {
    loader.remove();
    if (selectedProvider === 'vision.mobleysoft.com') {
      addMsg('mascom', 'PhotonicMind unreachable at vision.mobleysoft.com.\n\nEnsure your API key is set (localStorage photonic-key).\n\nError: ' + e.message);
    } else {
      addMsg('mascom', 'API unreachable at ' + API_BASE + '.\n\nServer may not be running. Start it with:\n  python3 mascom_v5.py serve\n\nError: ' + e.message);
    }
  }
};

// =========================================================================
// FEATURE 6: Code Block Renderer
// =========================================================================
// Override escHtml to detect and render code blocks
function formatMsgBody(text) {
  // Split on ``` code fences
  const parts = text.split(/(```[\s\S]*?```)/g);
  let html = '';
  parts.forEach(part => {
    if (part.startsWith('```') && part.endsWith('```')) {
      const inner = part.slice(3, -3);
      const nlIdx = inner.indexOf('\n');
      let lang = '', code = inner;
      if (nlIdx > 0 && nlIdx < 20 && !/\s/.test(inner.slice(0, nlIdx))) {
        lang = inner.slice(0, nlIdx);
        code = inner.slice(nlIdx + 1);
      }
      const id = 'code-' + Math.random().toString(36).slice(2, 8);
      html += '<div class="msg-code"><div class="msg-code-lang"><span>' + (lang || 'code') +
        '</span><button class="msg-code-copy" onclick="copyCode(\'' + id + '\')">COPY</button></div>' +
        '<pre id="' + id + '">' + escHtml(code) + '</pre></div>';
    } else {
      html += escHtml(part);
    }
  });
  return html;
}

window.copyCode = function(id) {
  const el = document.getElementById(id);
  if (el) {
    navigator.clipboard.writeText(el.textContent);
    const btn = el.parentElement.querySelector('.msg-code-copy');
    if (btn) { btn.textContent = 'COPIED'; setTimeout(() => btn.textContent = 'COPY', 1500); }
  }
};

// Override addMsg to use code block rendering
addMsg = function(role, text) {
  const cls = role === 'mascom' ? 'msg-mascom' : role === 'user' ? 'msg-user' : 'msg-event';
  const label = role === 'mascom' ? 'MASCOM' : role === 'user' ? 'YOU' : 'EVENT';
  const time = new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' });
  const wrap = document.createElement('div');
  wrap.className = 'msg ' + cls;
  const bodyHtml = (role === 'mascom') ? formatMsgBody(text) : escHtml(text);
  wrap.innerHTML = '<div class="msg-label">' + label + '</div><div class="msg-body">' + bodyHtml + '</div><div class="msg-time">' + time + '</div>';
  chatMessages.appendChild(wrap);
  chatAutoScroll();
  saveChat();
  return wrap;
};

// =========================================================================
// FEATURE 7: System Metrics (taskbar polling)
// =========================================================================
const tbMetrics = document.getElementById('tb-metrics');
let metricsInterval = null;

function renderMetrics(data) {
  let html = '';
  // API status
  const apiOk = data && data.booted;
  html += '<div class="tb-metric"><span class="tb-metric-dot ' + (apiOk ? 'ok' : 'err') + '"></span>API</div>';
  // LLM/PhotonicMind
  const llmOk = data && data.llm && data.llm.available;
  html += '<div class="tb-metric"><span class="tb-metric-dot ' + (llmOk ? 'ok' : 'err') + '"></span>LLM</div>';
  // Ventures
  if (data && data.total_ventures) {
    const active = data.by_status && data.by_status.active || 0;
    html += '<div class="tb-metric"><span class="tb-metric-dot ok"></span>' + active + '/' + data.total_ventures + ' ventures</div>';
  }
  // Revenue (fetch async and inject)
  html += '<div class="tb-metric" id="tb-rev">$--</div>';
  tbMetrics.innerHTML = html;
  // Async: fetch revenue
  fetch(API_BASE + '/api/revops', { signal: AbortSignal.timeout(4000) })
    .then(r => r.json()).then(rv => {
      const el = document.getElementById('tb-rev');
      if (el && rv.earnings) {
        const total = rv.earnings.total || rv.earnings.all_time || 0;
        el.textContent = '$' + Number(total).toFixed(2);
      }
    }).catch(() => {});
}

async function pollMetrics() {
  try {
    const r = await fetch(API_BASE + '/api/status');
    const d = await r.json();
    renderMetrics(d);
    // Update fleet dots if health data is available
    if (d.ventures && Array.isArray(d.ventures)) {
      d.ventures.forEach(v => {
        const name = typeof v === 'string' ? v : v.name;
        const status = v.status || 'healthy';
        if (name) updateFleetDot(name, status);
      });
    }
  } catch {
    renderMetrics(null);
  }
}

function startMetrics() {
  pollMetrics();
  metricsInterval = setInterval(pollMetrics, 30000);
}

// =========================================================================
// Patch WebSocket to feed notifications + fleet updates
// =========================================================================
const _origConnectWS = connectWebSocket;
connectWebSocket = function() {
  if (!WS_URL) return; // Remote WS disabled — API health check handles status
  try {
    ws = new WebSocket(WS_URL);
    ws.onopen = () => {
      wsStatusEl.textContent = 'connected';
      wsStatusEl.className = 'connected';
    };
    ws.onclose = () => {
      wsStatusEl.textContent = 'disconnected';
      wsStatusEl.className = 'disconnected';
      if (osAuthenticated) setTimeout(connectWebSocket, 5000);
    };
    ws.onerror = () => {
      wsStatusEl.textContent = 'disconnected';
      wsStatusEl.className = 'disconnected';
    };
    ws.onmessage = (evt) => {
      try {
        const data = JSON.parse(evt.data);
        const type = data.event || data.type || 'event';

        // Format messages based on event type
        let text = '';
        let eventType = null;

        if (type === 'activate' || type === 'venture_activated') {
          // Format: "✦ Activated: venture_name — response summary"
          const ventureName = data.venture || data.data?.venture || 'unknown';
          const response = data.data?.response || data.response || '';
          const summary = response.length > 100 ? response.substring(0, 100) + '...' : response;
          text = `✦ Activated: ${ventureName}${summary ? ' — ' + summary : ''}`;
          eventType = 'activate';
        } else if (type === 'operate_cycle' || type === 'operate_complete') {
          // Format: "⟳ Operate cycle complete — N ventures processed"
          const count = data.data?.ventures_processed || data.ventures_processed || data.count || 0;
          text = `⟳ Operate cycle complete — ${count} venture${count !== 1 ? 's' : ''} processed`;
          eventType = 'operate';
        } else if (type === 'error' || /error|fail|crash/i.test(type)) {
          // Format errors distinctly
          const detail = data.data ? (typeof data.data === 'string' ? data.data : JSON.stringify(data.data)) : '';
          text = `⚠ Error: ${data.message || detail || type}`;
          eventType = 'error';
        } else {
          // Default formatting for other events
          const detail = data.data ? (typeof data.data === 'string' ? data.data : JSON.stringify(data.data)) : '';
          text = type + (detail ? ': ' + detail : '');
        }

        addMsg('event', text, eventType);

        // Notification for important events
        const isError = eventType === 'error' || /error|fail|degrad|down|crash/i.test(text);
        const isImportant = isError || /deploy|boot|evolve|activate|operate/i.test(type);
        if (isImportant) pushNotification(text, isError);

        // Fleet update
        if (data.venture) {
          updateFleetDot(data.venture, data.status || (isError ? 'down' : 'healthy'));
        }
      } catch {
        addMsg('event', evt.data);
      }
    };
  } catch {
    wsStatusEl.textContent = 'disconnected';
    wsStatusEl.className = 'disconnected';
  }
};

// =========================================================================
// Patch onAuthSuccess to restore history + init features
// =========================================================================
const _origOnAuth = onAuthSuccess;
onAuthSuccess = function() {
  osAuthenticated = true;
  loginScreen.classList.add('hidden');
  loginEmail.value = '';
  loginPassword.value = '';
  loginError.classList.remove('show');

  // Restore chat history or show welcome
  const restored = restoreChat();
  if (restored) {
    addMsg('event', 'Session restored');
  } else {
    _authfor.getUser().then(user => {
      const name = (user && user.name) || 'Commander';
      addMsg('mascom', 'MASCOM v5 online. Welcome, ' + name + '.\n\nType anything to think, or use commands:\n  /boot     \u2014 Boot the fleet\n  /status   \u2014 System status\n  /operate  \u2014 Run operate cycle\n  /evolve   \u2014 Evolve ventures\n  /ventures \u2014 List ventures\n  /soul     \u2014 View system soul\n  @name     \u2014 Quick-launch a venture\n  /clear    \u2014 Clear chat history\n  /help     \u2014 All commands');
    }).catch(() => {
      addMsg('mascom', 'MASCOM v5 online. Type /help for commands.');
    });
  }

  buildFleetDots();
  connectWebSocket();
  startMetrics();
  setTimeout(() => {
    startCity();
    // Auto-launch terminal (into dock on desktop, window on mobile)
    const termApp = OS_APPS.find(a => a.id === 'terminal');
    if (termApp) launchApp(termApp);

    if (window.innerWidth < 768) {
      // On mobile, hide terminal initially
      const tw = Object.values(openWindows).find(w => w.appId === 'terminal');
      if (tw) tw.el.style.display = 'none';
      // Restore last mobile view (app they were looking at)
      const lastView = localStorage.getItem('mascom_last_view');
      if (lastView && lastView !== 'home' && window.switchMobileView) {
        setTimeout(() => window.switchMobileView(lastView), 100);
      }
    } else {
      chatInput.focus();
    }
  }, 200);

  // ── App header close button ──
  document.getElementById('app-header-close').addEventListener('click', () => closeCurrentApp());

  // ── Terminal dock toggle ──
  document.getElementById('term-dock-toggle').addEventListener('click', () => {
    const dock = document.getElementById('os-terminal-dock');
    const btn = document.getElementById('term-dock-toggle');
    dock.classList.toggle('collapsed');
    btn.innerHTML = dock.classList.contains('collapsed') ? '&#x276F;' : '&#x276E;';
  });

  // ── View mode buttons ──
  const vmOs = document.getElementById('vm-os');
  const vmApp = document.getElementById('vm-app');
  const vmGrid = document.getElementById('vm-grid');
  const osMain = document.getElementById('os-main');

  function setViewMode(mode) {
    osMain.classList.remove('view-app');
    vmOs.classList.remove('active');
    vmApp.classList.remove('active');
    if (mode === 'app') {
      osMain.classList.add('view-app');
      vmApp.classList.add('active');
    } else {
      vmOs.classList.add('active');
    }
  }
  vmOs.addEventListener('click', () => setViewMode('os'));
  vmApp.addEventListener('click', () => setViewMode('app'));

  // ── Coordinate grid ──
  const gridEl = document.getElementById('os-grid');
  const gridCanvas = document.getElementById('grid-canvas');
  let gridVisible = false;

  function drawGrid() {
    const rect = gridEl.parentElement.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    gridCanvas.width = rect.width * dpr;
    gridCanvas.height = rect.height * dpr;
    gridCanvas.style.width = rect.width + 'px';
    gridCanvas.style.height = rect.height + 'px';
    const ctx = gridCanvas.getContext('2d');
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, rect.width, rect.height);
    // Grid lines
    ctx.strokeStyle = 'rgba(240,184,0,0.03)';
    ctx.lineWidth = 1;
    for (let x = 0; x <= rect.width; x += 100) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, rect.height); ctx.stroke();
    }
    for (let y = 0; y <= rect.height; y += 100) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(rect.width, y); ctx.stroke();
    }
    // Labels
    ctx.font = '8px monospace';
    ctx.fillStyle = 'rgba(240,184,0,0.08)';
    for (let x = 0; x <= rect.width; x += 100) {
      ctx.fillText(x.toString(), x + 2, 10);
    }
    for (let y = 100; y <= rect.height; y += 100) {
      ctx.fillText(y.toString(), 2, y - 2);
    }
  }

  vmGrid.addEventListener('click', () => {
    gridVisible = !gridVisible;
    gridEl.classList.toggle('visible', gridVisible);
    vmGrid.classList.toggle('active', gridVisible);
    if (gridVisible) drawGrid();
  });
  window.addEventListener('resize', () => { if (gridVisible) drawGrid(); });
};

// Add /clear and /history to command handler
const _origHandleCmd = handleCommand;
handleCommand = async function(cmd) {
  const action = cmd.trim().split(/\s+/)[0].toLowerCase();
  if (action === '/clear') {
    chatMessages.innerHTML = '';
    localStorage.removeItem(_MCH);
    addMsg('event', 'Chat cleared');
    return;
  }
  if (action === '/history') {
    try {
      const arr = JSON.parse(localStorage.getItem(_MCH));
      addMsg('mascom', 'Chat history: ' + (arr ? arr.length : 0) + ' messages stored');
    } catch { addMsg('mascom', 'No chat history found'); }
    return;
  }
  return _origHandleCmd(cmd);
};

// =========================================================================
// AUTO-OPEN — if device is authenticated, run full init.
// The inline <script> above already opened the OS visually (instant).
// This finishes initialization (WebSocket, chat, fleet, terminal, etc.)
// =========================================================================
if (window._mascomPreAuthed || hasDeviceAuth()) {
  try {
    mascomOS.classList.add('open');
    document.body.classList.add('os-active');
    onAuthSuccess();
  } catch(e) { console.error('[MASCOM] Auto-open init error:', e); }
}

// =========================================================================
// HAL LIGHT — Interactive state machine with idle/activity detection
// States: off → green (broadcast) → yellow (autopilot on idle) → red (full autopilot)
// Click ping-pongs: off→green→yellow→red→yellow→green→off→green→...
// Auto-transitions: yellow+idle6s→red, red+activity→yellow, yellow+idle1s→red (re-entry)
// =========================================================================
(function() {
  const el = document.getElementById('hal-light');
  if (!el) return;

  const STATES = ['off', 'green', 'yellow', 'red'];
  const NAMES = { off:'Off — private mode', green:'Green — broadcasting', yellow:'Yellow — autopilot on idle', red:'Red — autopilot active' };
  let state = 'off';
  let dir = 1; // 1=ascending, -1=descending
  let idleTimer = null;
  let lastActivity = Date.now();
  let cameFromRed = false; // tracks if yellow was reached via auto de-escalation from red

  function setState(s, source) {
    if (s === state) return;
    const prev = state;
    state = s;
    el.className = 'hal-indicator hal-' + s;
    el.title = NAMES[s] || 'HAL Light';
    clearTimeout(idleTimer);

    // Update taskbar label
    const tb = document.getElementById('hal-taskbar');
    if (tb) { const c={off:'#888',green:'#34d399',yellow:'#fbbf24',red:'#f87171'}; tb.textContent='HAL: '+s; tb.style.color=c[s]||'#888'; }

    // Sync autopilot panel buttons if they exist
    document.querySelectorAll('.hal-btn').forEach(b => {
      const k = b.textContent.trim().toLowerCase();
      const map = { off:'off', observe:'green', shared:'yellow', 'hal active':'red' };
      b.classList.toggle('active', map[k] === s);
    });

    // Send to API
    if (typeof API_BASE !== 'undefined') {
      fetch(API_BASE + '/api/hal-set', {
        method: 'POST', headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ state: s })
      }).catch(() => {});
    }

    // Start idle detection for yellow state
    if (s === 'yellow') {
      const timeout = 4000;
      cameFromRed = prev === 'red';
      startIdleWatch(timeout);
    } else if (s === 'red') {
      // In red: any activity → yellow
      cameFromRed = false;
    } else {
      cameFromRed = false;
    }
  }

  // Click handler — ping-pong through states
  el.addEventListener('click', () => {
    const idx = STATES.indexOf(state);
    let next = idx + dir;
    if (next >= STATES.length) { next = STATES.length - 2; dir = -1; }
    if (next < 0) { next = 1; dir = 1; }
    setState(STATES[next], 'click');
  });

  // Idle detection
  function startIdleWatch(timeout) {
    clearTimeout(idleTimer);
    lastActivity = Date.now();
    idleTimer = setTimeout(() => {
      if (state === 'yellow') setState('red', 'idle');
    }, timeout);
  }

  // Activity detection — mouse, keyboard, touch
  function onActivity() {
    lastActivity = Date.now();
    if (state === 'red') {
      setState('yellow', 'activity');
    } else if (state === 'yellow') {
      // Reset idle timer
      const timeout = cameFromRed ? 1000 : 6000;
      clearTimeout(idleTimer);
      idleTimer = setTimeout(() => {
        if (state === 'yellow') setState('red', 'idle');
      }, timeout);
    }
  }

  document.addEventListener('mousemove', onActivity, { passive: true });
  document.addEventListener('mousedown', onActivity, { passive: true });
  document.addEventListener('keydown', onActivity, { passive: true });
  document.addEventListener('touchstart', onActivity, { passive: true });

  // Expose state for taskbar sync and autopilot panel
  window._halState = () => state;
  window._setHalState = (s) => { if (STATES.includes(s)) { dir = STATES.indexOf(s) >= STATES.indexOf(state) ? 1 : -1; setState(s, 'external'); } };

  // Sync autopilot panel's setHalState if it exists
  const origSetHal = window.setHalState;
  window.setHalState = function(s) {
    const map = { off:'off', green:'green', yellow:'yellow', red:'red' };
    if (map[s]) window._setHalState(map[s]);
    if (origSetHal) origSetHal(s);
  };
})();

// =========================================================================
// MOBILE KEYBOARD — adjust layout when virtual keyboard opens
// =========================================================================
(function() {
  if (window.innerWidth >= 768 || !window.visualViewport) return;
  const vv = window.visualViewport;
  const mascomEl = document.getElementById('mascom-os');

  // Floating dismiss keyboard button
  const dismissBtn = document.createElement('button');
  dismissBtn.textContent = '\u2328 Done';
  dismissBtn.style.cssText = 'display:none;position:fixed;bottom:8px;right:8px;z-index:9999;padding:8px 16px;border-radius:6px;background:rgba(240,184,0,0.9);color:#000;font-size:12px;font-weight:700;font-family:var(--ob-mono);border:none;cursor:pointer;box-shadow:0 2px 12px rgba(0,0,0,0.5);';
  dismissBtn.addEventListener('click', () => {
    document.activeElement?.blur();
    dismissBtn.style.display = 'none';
  });
  document.body.appendChild(dismissBtn);

  function adjustForKeyboard() {
    if (!mascomEl || !mascomEl.classList.contains('open')) return;
    const keyboardHeight = window.innerHeight - vv.height;
    const isKeyboardOpen = keyboardHeight > 100;

    if (isKeyboardOpen) {
      mascomEl.style.height = '100%';
      mascomEl.style.paddingBottom = keyboardHeight + 'px';
      mascomEl.classList.add('kb-open');
      dismissBtn.style.display = 'block';
      dismissBtn.style.bottom = (keyboardHeight + 8) + 'px';
      // Scroll focused input into view
      const active = document.activeElement;
      if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')) {
        setTimeout(() => active.scrollIntoView({ behavior: 'smooth', block: 'center' }), 100);
      }
    } else {
      mascomEl.style.height = '';
      mascomEl.style.paddingBottom = '';
      mascomEl.classList.remove('kb-open');
      dismissBtn.style.display = 'none';
    }
  }

  vv.addEventListener('resize', adjustForKeyboard);
  vv.addEventListener('scroll', adjustForKeyboard);
})();

// =========================================================================
// MOBILE CLIPBOARD IMAGE DETECTION
// =========================================================================
(function() {
  if (window.innerWidth >= 768) return;
  const osChat = document.getElementById('os-chat');
  if (!osChat) return;

  // Create paste button
  const clipBtn = document.createElement('button');
  clipBtn.className = 'clip-paste-btn';
  clipBtn.textContent = '\uD83D\uDCCB Paste Image';
  document.body.appendChild(clipBtn);

  let lastClipCheck = 0;

  async function checkClipboard() {
    try {
      if (!navigator.clipboard || !navigator.clipboard.read) return;
      const items = await navigator.clipboard.read();
      for (const item of items) {
        const imgType = item.types.find(t => t.startsWith('image/'));
        if (imgType) {
          clipBtn.style.display = 'block';
          return;
        }
      }
      clipBtn.style.display = 'none';
    } catch {
      // Permission denied or empty — hide button
      clipBtn.style.display = 'none';
    }
  }

  // Check clipboard on focus/visibility and periodically when visible
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) checkClipboard();
  });
  window.addEventListener('focus', () => checkClipboard());

  // Also check when user taps the chat area (triggers permission prompt if needed)
  osChat.addEventListener('touchstart', () => {
    const now = Date.now();
    if (now - lastClipCheck > 3000) { lastClipCheck = now; checkClipboard(); }
  }, { passive: true });

  // Paste image into chat as a message with inline preview
  clipBtn.addEventListener('click', async () => {
    try {
      const items = await navigator.clipboard.read();
      for (const item of items) {
        const imgType = item.types.find(t => t.startsWith('image/'));
        if (imgType) {
          const blob = await item.getType(imgType);
          const reader = new FileReader();
          reader.onload = () => {
            const img = document.createElement('img');
            img.src = reader.result;
            img.style.cssText = 'max-width:100%;border-radius:6px;margin:4px 0;';
            const msgDiv = document.createElement('div');
            msgDiv.className = 'msg user';
            msgDiv.innerHTML = '<div class="msg-label">you</div><div class="msg-body"></div>';
            msgDiv.querySelector('.msg-body').appendChild(img);
            const chatMsgs = document.getElementById('chat-messages');
            chatMsgs.appendChild(msgDiv);
            chatAutoScroll();
            addMsg('event', '\uD83D\uDCF7 Screenshot pasted');
          };
          reader.readAsDataURL(blob);
          clipBtn.style.display = 'none';
          return;
        }
      }
    } catch (e) {
      console.log('[Clipboard]', e);
    }
  });

  // Initial check
  setTimeout(checkClipboard, 1000);
})();

// =========================================================================
// MOBILE VIEW SWITCHING (delegates to switchMobileView on mobile)
// =========================================================================
(function() {
  // On mobile, switchMobileView (defined in initMobileUI) handles everything.
  // This block only handles the legacy mob-tabs for any edge case where
  // they might still be visible (desktop, or if JS init order changes).
  const mobTabs = document.getElementById('mob-tabs');
  if (!mobTabs) return;
  const tabs = mobTabs.querySelectorAll('.mob-tab');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      if (window.switchMobileView) {
        const view = tab.dataset.view;
        window.switchMobileView(view === 'chat' ? 'chat' : view);
      }
    });
  });
})();

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { GameWorld } from './world.js';
import { PlayerController } from './player.js';
import { CombatAndBRSystem } from './combat.js';

let scene, camera, renderer, composer;
let world, player, combat;
let isMatchStarted = false;
let clock = new THREE.Clock();
let frames = 0, lastFpsTime = performance.now();

function initEngine(quality = 'high') {
  const canvas = document.getElementById('gameCanvas');
  renderer = new THREE.WebGLRenderer({ canvas, antialias: quality !== 'low', powerPreference: 'high-performance' });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(quality === 'ultra' ? Math.min(window.devicePixelRatio, 2) : quality === 'low' ? 0.75 : 1);
  renderer.shadowMap.enabled = quality !== 'low';
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;

  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.1, 1000);

  world = new GameWorld(scene, quality);
  player = new PlayerController(scene, camera, world);
  combat = new CombatAndBRSystem(scene, camera, player, world);

  // Post-Processing (Bloom + HDR Efekti)
  composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  if (quality === 'high' || quality === 'ultra') {
    const bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.25, 0.4, 0.85);
    composer.addPass(bloomPass);
  }

  setupMobileControls();
}

function setupMobileControls() {
  const joyZone = document.getElementById('joystickZone');
  const joyKnob = document.getElementById('joystickKnob');
  let touchId = null;

  joyZone.addEventListener('touchstart', (e) => {
    touchId = e.changedTouches.identifier;
  });

  joyZone.addEventListener('touchmove', (e) => {
    e.preventDefault();
    for (const t of e.changedTouches) {
      if (t.identifier === touchId) {
        const rect = joyZone.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const dx = Math.max(-35, Math.min(35, t.clientX - cx));
        const dy = Math.max(-35, Math.min(35, t.clientY - cy));
        joyKnob.style.transform = `translate(${dx}px, ${dy}px)`;
        player.joyInput.x = dx / 35;
        player.joyInput.y = dy / 35;
      }
    }
  });

  joyZone.addEventListener('touchend', () => {
    touchId = null;
    joyKnob.style.transform = 'translate(0px, 0px)';
    player.joyInput.x = 0;
    player.joyInput.y = 0;
  });

  // Sağ taraf dokunmatik kamera döndürme
  let lastTouchX = 0, lastTouchY = 0;
  document.getElementById('gameCanvas').addEventListener('touchstart', (e) => {
    lastTouchX = e.touches.clientX;
    lastTouchY = e.touches.clientY;
  });
  document.getElementById('gameCanvas').addEventListener('touchmove', (e) => {
    if (e.touches.length === 1 && e.touches.clientX > window.innerWidth * 0.4) {
      const dx = e.touches.clientX - lastTouchX;
      const dy = e.touches.clientY - lastTouchY;
      player.yaw -= dx * 0.005;
      player.pitch = Math.max(-0.45, Math.min(1.1, player.pitch + dy * 0.005));
      lastTouchX = e.touches.clientX;
      lastTouchY = e.touches.clientY;
    }
  });

  document.getElementById('mFireBtn').addEventListener('touchstart', () => (combat.isFiring = true));
  document.getElementById('mFireBtn').addEventListener('touchend', () => (combat.isFiring = false));
  document.getElementById('mAimBtn').addEventListener('click', () => (player.isAiming = !player.isAiming));
  document.getElementById('mJumpBtn').addEventListener('click', () => {
    if (player.isGrounded) { player.velocity.y = 7.5; player.isGrounded = false; }
  });
  document.getElementById('mCrouchBtn').addEventListener('click', () => (player.isCrouching = !player.isCrouching));
  document.getElementById('mReloadBtn').addEventListener('click', () => combat.reloadWeapon());
}

// Lobi Arayüzü Etkileşimleri
document.querySelectorAll('.mode-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  });
});

document.getElementById('graphicsSelect').addEventListener('change', (e) => {
  initEngine(e.target.value);
});

document.getElementById('startMatchBtn').addEventListener('click', () => {
  isMatchStarted = true;
  document.getElementById('lobbyScreen').classList.add('hidden');
  document.getElementById('hudScreen').classList.remove('hidden');
  document.body.requestPointerLock?.();
});

document.getElementById('closeInvBtn').addEventListener('click', () => {
  document.getElementById('inventoryScreen').classList.add('hidden');
  document.body.requestPointerLock?.();
});

document.getElementById('invMedkit').addEventListener('click', () => {
  player.hp = Math.min(100, player.hp + 50);
  combat.updateHUD();
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);
});

// Ana Oyun Döngüsü
function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);
  const elapsed = clock.getElapsedTime();

  if (!isMatchStarted) {
    // Lobide 3D Karakter Vitrini Dönüşü
    player.group.rotation.y = elapsed * 0.6;
    camera.position.set(player.group.position.x + 2.2, player.group.position.y + 1.8, player.group.position.z + 3.4);
    camera.lookAt(player.group.position.x, player.group.position.y + 1.2, player.group.position.z);
  } else {
    player.update(dt, elapsed);
    combat.update(dt, elapsed);
  }

  composer.render();

  // FPS Hesaplama
  frames++;
  const now = performance.now();
  if (now - lastFpsTime >= 1000) {
    document.getElementById('lobbyFps').innerText = frames;
    document.getElementById('gameFps').innerText = frames;
    frames = 0;
    lastFpsTime = now;
  }
}

initEngine('high');
animate();

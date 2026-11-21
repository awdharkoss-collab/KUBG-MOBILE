class CombatAndBRSystem {
  constructor(scene, camera, player, world) {
    this.scene = scene;
    this.camera = camera;
    this.player = player;
    this.world = world;

    this.bullets = [];
    this.bots = [];
    this.kills = 0;
    this.totalDamage = 0;

    this.activeSlot = 1;
    this.weapons = {
      1: { name: 'M416 PİYADE', clip: 30, maxClip: 30, reserve: 180, dmg: 26, rate: 0.11, recoil: 0.015 },
      2: { name: 'KAR98K KESKİN', clip: 5, maxClip: 5, reserve: 40, dmg: 85, rate: 1.1, recoil: 0.06 }
    };
    this.lastShotTime = 0;
    this.isFiring = false;

    this.audioCtx = null;
    this.zoneRadius = 210;
    this.zoneTimer = 90;
    this.createBlueZone();
    this.spawnBots(19);
    this.setupCombatInputs();
  }

  playSound(type) {
    try {
      if (!this.audioCtx) this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      if (this.audioCtx.state === 'suspended') this.audioCtx.resume();
      const ctx = this.audioCtx;
      const now = ctx.currentTime;

      if (type === 'shoot') {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = this.activeSlot === 1 ? 'sawtooth' : 'square';
        osc.frequency.setValueAtTime(this.activeSlot === 1 ? 190 : 120, now);
        osc.frequency.exponentialRampToValueAtTime(28, now + 0.14);
        gain.gain.setValueAtTime(0.28, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.15);
      } else if (type === 'hit') {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(950, now);
        gain.gain.setValueAtTime(0.18, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.06);
      } else if (type === 'reload') {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(320, now);
        osc.frequency.setValueAtTime(520, now + 0.12);
        gain.gain.setValueAtTime(0.15, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.25);
      }
    } catch (e) {}
  }

  createBlueZone() {
    const geo = new THREE.CylinderGeometry(1, 1, 60, 64, 1, true);
    const mat = new THREE.MeshBasicMaterial({
      color: 0x0ea5e9,
      transparent: true,
      opacity: 0.25,
      side: THREE.DoubleSide,
      depthWrite: false
    });
    this.zoneMesh = new THREE.Mesh(geo, mat);
    this.zoneMesh.position.y = 20;
    this.zoneMesh.scale.set(this.zoneRadius, 1, this.zoneRadius);
    this.scene.add(this.zoneMesh);
  }

  spawnBots(count) {
    const enemySuit = new THREE.MeshStandardMaterial({ color: 0x5c2626, roughness: 0.8 });
    const vestMat = new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.5 });
    const headMat = new THREE.MeshStandardMaterial({ color: 0x27272a, roughness: 0.4 });

    for (let i = 0; i < count; i++) {
      const group = new THREE.Group();
      const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.2, 0.72, 12), enemySuit);
      torso.position.y = 1.18;
      torso.castShadow = true;

      const vest = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.22, 0.5, 12), vestMat);
      vest.position.y = 1.2;

      const head = new THREE.Mesh(new THREE.SphereGeometry(0.17, 14, 12), headMat);
      head.position.y = 1.72;

      const legs = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.14, 0.82, 10), enemySuit);
      legs.position.y = 0.42;

      group.add(torso, vest, head, legs);

      const angle = (i / count) * Math.PI * 2;
      const dist = 45 + Math.random() * 110;
      const bx = Math.cos(angle) * dist;
      const bz = Math.sin(angle) * dist;
      group.position.set(bx, this.world.getTerrainHeight(bx, bz), bz);

      this.scene.add(group);
      this.bots.push({
        mesh: group,
        hp: 100,
        alive: true,
        dir: Math.random() * Math.PI * 2,
        fireCooldown: Math.random() * 2
      });
    }
  }
  setupCombatInputs() {
    window.addEventListener('mousedown', (e) => {
      if (e.button === 0 && document.pointerLockElement === document.body) this.isFiring = true;
    });
    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) this.isFiring = false;
    });

    window.addEventListener('keydown', (e) => {
      if (e.code === 'Digit1') this.switchWeapon(1);
      if (e.code === 'Digit2') this.switchWeapon(2);
      if (e.code === 'KeyR') this.reloadWeapon();
      if (e.code === 'KeyE') this.handleInteraction();
      if (e.code === 'Tab') {
        e.preventDefault();
        const inv = document.getElementById('inventoryScreen');
        inv.classList.toggle('hidden');
        if (!inv.classList.contains('hidden')) document.exitPointerLock();
      }
    });
  }

  switchWeapon(slot) {
    this.activeSlot = slot;
    document.getElementById('slot1').classList.toggle('active', slot === 1);
    document.getElementById('slot2').classList.toggle('active', slot === 2);
    this.updateHUD();
  }

  reloadWeapon() {
    const w = this.weapons[this.activeSlot];
    const needed = w.maxClip - w.clip;
    if (needed > 0 && w.reserve > 0) {
      const take = Math.min(needed, w.reserve);
      w.clip += take;
      w.reserve -= take;
      this.playSound('reload');
      this.updateHUD();
    }
  }

  handleInteraction() {
    if (this.player.inVehicle) {
      this.player.inVehicle = null;
      this.player.group.position.x += 2.2;
      return;
    }

    for (const v of this.world.vehicles) {
      if (this.player.group.position.distanceTo(v.mesh.position) < 4.5) {
        this.player.inVehicle = v;
        return;
      }
    }

    for (const item of this.world.lootItems) {
      if (item.active && this.player.group.position.distanceTo(item.mesh.position) < 3.5) {
        item.active = false;
        item.mesh.visible = false;
        this.weapons.reserve += 60;
        this.weapons.reserve += 10;
        this.player.hp = Math.min(100, this.player.hp + 35);
        this.playSound('reload');
        this.updateHUD();
      }
    }
  }

  firePlayerWeapon(time) {
    const w = this.weapons[this.activeSlot];
    if (time - this.lastShotTime < w.rate || w.clip <= 0 || this.player.inVehicle) return;

    this.lastShotTime = time;
    w.clip--;
    this.player.muzzleFlash.intensity = 7;
    this.player.pitch += w.recoil;
    this.playSound('shoot');

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(new THREE.Vector2(0, 0), this.camera);

    const bulletGeo = new THREE.SphereGeometry(0.06, 6, 6);
    const bulletMat = new THREE.MeshBasicMaterial({ color: 0xfde047 });
    const bMesh = new THREE.Mesh(bulletGeo, bulletMat);

    const startPos = this.player.group.position.clone().add(new THREE.Vector3(0, 1.45, 0));
    bMesh.position.copy(startPos);
    this.scene.add(bMesh);

    this.bullets.push({
      mesh: bMesh,
      dir: raycaster.ray.direction.clone(),
      speed: 160,
      dmg: w.dmg,
      fromPlayer: true,
      life: 1.8
    });

    this.updateHUD();
  }

  update(dt, time) {
    if (this.isFiring && !this.player.isDead) this.firePlayerWeapon(time);

    this.zoneTimer = Math.max(0, this.zoneTimer - dt);
    if (this.zoneRadius > 25) {
      this.zoneRadius -= 1.2 * dt;
      this.zoneMesh.scale.set(this.zoneRadius, 1, this.zoneRadius);
    }

    const playerDist = Math.hypot(this.player.group.position.x, this.player.group.position.z);
    if (playerDist > this.zoneRadius && !this.player.isDead) {
      this.damagePlayer(4 * dt);
    }

    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];
      b.mesh.position.addScaledVector(b.dir, b.speed * dt);
      b.life -= dt;

      if (b.fromPlayer) {
        for (const bot of this.bots) {
          if (bot.alive && b.mesh.position.distanceTo(bot.mesh.position.clone().add(new THREE.Vector3(0, 1.1, 0))) < 0.85) {
            bot.hp -= b.dmg;
            this.totalDamage += b.dmg;
            this.playSound('hit');
            b.life = 0;
            if (bot.hp <= 0) {
              bot.alive = false;
              bot.mesh.rotation.x = Math.PI / 2;
              this.kills++;
              this.updateHUD();
            }
          }
        }
      } else if (!this.player.isDead && b.mesh.position.distanceTo(this.player.group.position.clone().add(new THREE.Vector3(0, 1.1, 0))) < 0.85) {
        this.damagePlayer(12);
        b.life = 0;
      }

      if (b.life <= 0) {
        this.scene.remove(b.mesh);
        this.bullets.splice(i, 1);
      }
    }

    for (const bot of this.bots) {
      if (!bot.alive) continue;
      const distToPlayer = bot.mesh.position.distanceTo(this.player.group.position);

      if (distToPlayer < 60 && !this.player.isDead) {
        bot.mesh.lookAt(this.player.group.position.x, bot.mesh.position.y, this.player.group.position.z);
        if (distToPlayer > 18) {
          bot.mesh.position.x += Math.sin(bot.mesh.rotation.y) * 3.8 * dt;
          bot.mesh.position.z += Math.cos(bot.mesh.rotation.y) * 3.8 * dt;
        }
        bot.fireCooldown -= dt;
        if (bot.fireCooldown <= 0) {
          bot.fireCooldown = 1.6 + Math.random();
          const dir = this.player.group.position.clone().sub(bot.mesh.position).normalize();
          const bMesh = new THREE.Mesh(new THREE.SphereGeometry(0.06), new THREE.MeshBasicMaterial({ color: 0xef4444 }));
          bMesh.position.copy(bot.mesh.position).add(new THREE.Vector3(0, 1.4, 0));
          this.scene.add(bMesh);
          this.bullets.push({ mesh: bMesh, dir, speed: 105, dmg: 12, fromPlayer: false, life: 1.5 });
        }
      } else {
        bot.mesh.position.x += Math.sin(bot.dir) * 2.5 * dt;
        bot.mesh.position.z += Math.cos(bot.dir) * 2.5 * dt;
        if (Math.random() < 0.01) bot.dir = Math.random() * Math.PI * 2;
      }
      bot.mesh.position.y = this.world.getTerrainHeight(bot.mesh.position.x, bot.mesh.position.z);
    }

    let canInteract = false;
    for (const v of this.world.vehicles) if (this.player.group.position.distanceTo(v.mesh.position) < 4.5) canInteract = true;
    for (const item of this.world.lootItems) if (item.active && this.player.group.position.distanceTo(item.mesh.position) < 3.5) canInteract = true;
    document.getElementById('interactPrompt').classList.toggle('hidden', !canInteract && !this.player.inVehicle);

    this.checkMatchStatus();
  }

  damagePlayer(amount) {
    if (this.player.armor > 0) {
      const absorbed = Math.min(this.player.armor, amount * 0.6);
      this.player.armor -= absorbed;
      this.player.hp -= (amount - absorbed);
    } else {
      this.player.hp -= amount;
    }
    if (this.player.hp <= 0) {
      this.player.hp = 0;
      this.player.isDead = true;
      document.exitPointerLock();
      document.getElementById('endTitle').innerText = 'ELENDİN!';
      document.getElementById('endSubtitle').innerText = 'Daha iyi şanslar Komutan';
      document.getElementById('endKills').innerText = this.kills;
      document.getElementById('endDamage').innerText = Math.round(this.totalDamage);
      document.getElementById('endScreen').classList.remove('hidden');
    }
    this.updateHUD();
  }

  checkMatchStatus() {
    const aliveBots = this.bots.filter(b => b.alive).length;
    document.getElementById('aliveCount').innerText = aliveBots + (this.player.isDead ? 0 : 1);
    const mins = Math.floor(this.zoneTimer / 60);
    const secs = Math.floor(this.zoneTimer % 60);
    document.getElementById('zoneTimer').innerText = `0${mins}:${secs < 10 ? '0' : ''}${secs}`;

    if (aliveBots === 0 && !this.player.isDead) {
      document.exitPointerLock();
      document.getElementById('endKills').innerText = this.kills;
      document.getElementById('endDamage').innerText = Math.round(this.totalDamage);
      document.getElementById('endScreen').classList.remove('hidden');
    }
  }

  updateHUD() {
    document.getElementById('hpValue').innerText = Math.ceil(this.player.hp);
    document.getElementById('armorValue').innerText = Math.ceil(this.player.armor);
    document.getElementById('hpFill').style.width = `${this.player.hp}%`;
    document.getElementById('armorFill').style.width = `${this.player.armor}%`;
    document.getElementById('killCount').innerText = this.kills;
    document.getElementById('ammoClip').innerText = this.weapons.clip;
    document.getElementById('ammoReserve').innerText = this.weapons.reserve;
    document.getElementById('sniperClip').innerText = this.weapons.clip;
    document.getElementById('sniperReserve').innerText = this.weapons.reserve;
  }
}

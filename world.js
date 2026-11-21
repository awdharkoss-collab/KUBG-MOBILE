class GameWorld {
  constructor(scene, quality = 'high') {
    this.scene = scene;
    this.quality = quality;
    this.colliders = [];
    this.lootItems = [];
    this.vehicles = [];

    this.textures = this.generatePBRTextures();
    this.setupLightingAndSky();
    this.createTerrainAndWater();
    this.buildMapStructures();
    this.spawnVehiclesAndLoot();
  }

  generatePBRTextures() {
    // Gerçekçi Toprak/Çimen Dokusu + Kabartma Haritası (Bump Map)
    const createNoiseTex = (c1, c2, scale = 4) => {
      const canvas = document.createElement('canvas');
      canvas.width = 256;
      canvas.height = 256;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = c1;
      ctx.fillRect(0, 0, 256, 256);

      for (let i = 0; i < 6000; i++) {
        ctx.fillStyle = Math.random() > 0.5 ? c2 : 'rgba(0,0,0,0.12)';
        ctx.fillRect(Math.random() * 256, Math.random() * 256, scale, scale);
      }
      const tex = new THREE.CanvasTexture(canvas);
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
      tex.repeat.set(32, 32);
      return tex;
    };

    const grassTex = createNoiseTex('#2d4224', '#3d5730', 3);
    const grassBump = createNoiseTex('#808080', '#ffffff', 2);
    const concreteTex = createNoiseTex('#7c8288', '#63686e', 3);
    concreteTex.repeat.set(4, 4);

    return { grassTex, grassBump, concreteTex };
  }

  setupLightingAndSky() {
    this.scene.fog = new THREE.FogExp2(0x9cb8cf, 0.0028);

    // Gerçekçi Gökyüzü Kubbesi (Sky Dome)
    const skyCanvas = document.createElement('canvas');
    skyCanvas.width = 512;
    skyCanvas.height = 256;
    const sctx = skyCanvas.getContext('2d');
    const grad = sctx.createLinearGradient(0, 0, 0, 256);
    grad.addColorStop(0, '#1e3a5f');
    grad.addColorStop(0.55, '#6895bd');
    grad.addColorStop(1, '#c8d9e6');
    sctx.fillStyle = grad;
    sctx.fillRect(0, 0, 512, 256);

    // Yumuşak Bulut Katmanı
    sctx.fillStyle = 'rgba(255, 255, 255, 0.22)';
    for (let i = 0; i < 65; i++) {
      sctx.beginPath();
      sctx.ellipse(Math.random() * 512, 60 + Math.random() * 90, 25 + Math.random() * 45, 8 + Math.random() * 14, 0, 0, Math.PI * 2);
      sctx.fill();
    }
    const skyTex = new THREE.CanvasTexture(skyCanvas);
    const skyDome = new THREE.Mesh(
      new THREE.SphereGeometry(650, 32, 20),
      new THREE.MeshBasicMaterial({ map: skyTex, side: THREE.BackSide, fog: false })
    );
    this.scene.add(skyDome);

    // Üç Noktalı Atmosferik Aydınlatma
    const hemiLight = new THREE.HemisphereLight(0xe0f2fe, 0x3b4234, 0.75);
    this.scene.add(hemiLight);

    this.sunLight = new THREE.DirectionalLight(0xfff0d4, 2.4);
    this.sunLight.position.set(130, 170, 95);
    this.sunLight.castShadow = this.quality !== 'low';

    const shadowRes = this.quality === 'ultra' ? 2048 : 1024;
    this.sunLight.shadow.mapSize.set(shadowRes, shadowRes);
    this.sunLight.shadow.camera.near = 10;
    this.sunLight.shadow.camera.far = 450;
    const d = 160;
    this.sunLight.shadow.camera.left = -d;
    this.sunLight.shadow.camera.right = d;
    this.sunLight.shadow.camera.top = d;
    this.sunLight.shadow.camera.bottom = -d;
    this.sunLight.shadow.bias = -0.0005;
    this.scene.add(this.sunLight);
  }
  getTerrainHeight(x, z) {
    const dist = Math.sqrt(x * x + z * z);
    if (dist > 220) return -3.5;
    let h = Math.sin(x * 0.018) * Math.cos(z * 0.018) * 7.5;
    h += Math.sin(x * 0.05 + z * 0.035) * 2.4;
    if (dist < 45) h *= 0.22;
    if (dist > 175) h -= (dist - 175) * 0.18;
    return h;
  }

  createTerrainAndWater() {
    const geo = new THREE.PlaneGeometry(520, 520, 140, 140);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;
    const colors = [];

    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const y = this.getTerrainHeight(x, z);
      pos.setY(i, y);

      if (y < 0.45) colors.push(0.85, 0.78, 0.58);
      else if (y > 6.2) colors.push(0.55, 0.55, 0.52);
      else colors.push(0.95, 1.0, 0.90);
    }
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geo.computeVertexNormals();

    const mat = new THREE.MeshStandardMaterial({
      map: this.textures.grassTex,
      bumpMap: this.textures.grassBump,
      bumpScale: 0.25,
      vertexColors: true,
      roughness: 0.9,
      metalness: 0.02
    });
    const terrain = new THREE.Mesh(geo, mat);
    terrain.receiveShadow = true;
    this.scene.add(terrain);

    // Gerçekçi Yansımalı Deniz Suyu
    const waterGeo = new THREE.PlaneGeometry(1400, 1400);
    waterGeo.rotateX(-Math.PI / 2);
    const waterMat = new THREE.MeshStandardMaterial({
      color: 0x0a3d52,
      bumpMap: this.textures.grassBump,
      bumpScale: 0.08,
      roughness: 0.12,
      metalness: 0.85,
      transparent: true,
      opacity: 0.9
    });
    this.water = new THREE.Mesh(waterGeo, waterMat);
    this.water.position.y = -0.3;
    this.scene.add(this.water);

    // Asfalt Ana Yol
    const roadMat = new THREE.MeshStandardMaterial({ color: 0x26292e, roughness: 0.85, bumpMap: this.textures.grassBump, bumpScale: 0.05 });
    const road = new THREE.Mesh(new THREE.PlaneGeometry(7.5, 280), roadMat);
    road.rotation.x = -Math.PI / 2;
    road.position.set(8, 0.12, 0);
    road.receiveShadow = true;
    this.scene.add(road);
  }

  buildMapStructures() {
    const wallMat = new THREE.MeshStandardMaterial({
      map: this.textures.concreteTex,
      bumpMap: this.textures.grassBump,
      bumpScale: 0.12,
      roughness: 0.8
    });
    const militaryMat = new THREE.MeshStandardMaterial({
      color: 0x4b5548,
      map: this.textures.concreteTex,
      roughness: 0.85
    });
    const roofMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.5, metalness: 0.4 });

    const locations = [
      { x: 0, z: 0, w: 14, d: 14, h: 5.2, mat: wallMat },
      { x: 26, z: -18, w: 12, d: 16, h: 5.2, mat: wallMat },
      { x: -26, z: 20, w: 16, d: 12, h: 5.2, mat: militaryMat },
      { x: -65, z: -55, w: 18, d: 14, h: 5.8, mat: militaryMat },
      { x: 70, z: 60, w: 14, d: 14, h: 5.2, mat: wallMat }
    ];

    locations.forEach(b => this.createEnterableBuilding(b.x, b.z, b.w, b.d, b.h, b.mat, roofMat));

    // Çok Katmanlı Gerçekçi Çam Ağaçları
    const treeCount = this.quality === 'low' ? 140 : 320;
    const trunkGeo = new THREE.CylinderGeometry(0.28, 0.48, 4.5, 8);
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x3b281c, roughness: 0.95 });
    const leavesGeo1 = new THREE.ConeGeometry(2.8, 4.8, 9);
    const leavesGeo2 = new THREE.ConeGeometry(2.1, 4.2, 9);
    const leavesMat = new THREE.MeshStandardMaterial({ color: 0x1b331b, roughness: 0.88 });

    const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, treeCount);
    const leavesBottom = new THREE.InstancedMesh(leavesGeo1, leavesMat, treeCount);
    const leavesTop = new THREE.InstancedMesh(leavesGeo2, leavesMat, treeCount);
    trunks.castShadow = this.quality !== 'low';
    leavesBottom.castShadow = this.quality !== 'low';
    leavesTop.castShadow = this.quality !== 'low';

    const dummy = new THREE.Object3D();
    let idx = 0;
    for (let i = 0; i < treeCount * 2 && idx < treeCount; i++) {
      const rx = (Math.random() - 0.5) * 350;
      const rz = (Math.random() - 0.5) * 350;
      const ry = this.getTerrainHeight(rx, rz);
      if (ry > 0.8 && Math.hypot(rx, rz) > 35 && Math.abs(rx - 8) > 6) {
        const s = 0.85 + Math.random() * 0.65;
        dummy.scale.setScalar(s);

        dummy.position.set(rx, ry + 2.2 * s, rz);
        dummy.updateMatrix();
        trunks.setMatrixAt(idx, dummy.matrix);

        dummy.position.set(rx, ry + 5.2 * s, rz);
        dummy.updateMatrix();
        leavesBottom.setMatrixAt(idx, dummy.matrix);

        dummy.position.set(rx, ry + 7.6 * s, rz);
        dummy.updateMatrix();
        leavesTop.setMatrixAt(idx, dummy.matrix);

        this.colliders.push({ x: rx, z: rz, r: 0.55 });
        idx++;
      }
    }
    this.scene.add(trunks, leavesBottom, leavesTop);

    // Doğal Kayalıklar (Siper Alanları)
    const rockGeo = new THREE.DodecahedronGeometry(1.8, 1);
    const rockMat = new THREE.MeshStandardMaterial({ color: 0x57534e, roughness: 0.92, bumpMap: this.textures.grassBump, bumpScale: 0.3 });
    for (let i = 0; i < 45; i++) {
      const rx = (Math.random() - 0.5) * 260;
      const rz = (Math.random() - 0.5) * 260;
      const ry = this.getTerrainHeight(rx, rz);
      if (ry > 0.5 && Math.hypot(rx, rz) > 25) {
        const rock = new THREE.Mesh(rockGeo, rockMat);
        rock.position.set(rx, ry + 0.8, rz);
        rock.rotation.set(Math.random(), Math.random(), Math.random());
        rock.scale.set(0.8 + Math.random() * 1.4, 0.7 + Math.random(), 0.8 + Math.random() * 1.4);
        rock.castShadow = true;
        rock.receiveShadow = true;
        this.scene.add(rock);
        this.colliders.push({ x: rx, z: rz, r: 1.6 });
      }
    }
  }

  createEnterableBuilding(cx, cz, w, d, h, wallMat, roofMat) {
    const y = this.getTerrainHeight(cx, cz);
    const t = 0.45;
    const doorW = 2.6;

    const addWall = (x, z, bw, bd) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(bw, h, bd), wallMat);
      m.position.set(x, y + h / 2, z);
      m.castShadow = true;
      m.receiveShadow = true;
      this.scene.add(m);
      this.colliders.push({ minX: x - bw / 2, maxX: x + bw / 2, minZ: z - bd / 2, maxZ: z + bd / 2, isBox: true });
    };

    addWall(cx, cz - d / 2, w, t);
    addWall(cx - w / 2, cz, t, d);
    addWall(cx + w / 2, cz, t, d);
    const sideW = (w - doorW) / 2;
    addWall(cx - doorW / 2 - sideW / 2, cz + d / 2, sideW, t);
    addWall(cx + doorW / 2 + sideW / 2, cz + d / 2, sideW, t);

    // Zemin Betonu ve Çatı
    const floor = new THREE.Mesh(new THREE.BoxGeometry(w, 0.2, d), roofMat);
    floor.position.set(cx, y + 0.1, cz);
    floor.receiveShadow = true;
    this.scene.add(floor);

    const roof = new THREE.Mesh(new THREE.BoxGeometry(w + 0.8, 0.4, d + 0.8), roofMat);
    roof.position.set(cx, y + h + 0.2, cz);
    roof.castShadow = true;
    this.scene.add(roof);
  }

  spawnVehiclesAndLoot() {
    const carGroup = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(2.4, 1.0, 4.6),
      new THREE.MeshStandardMaterial({ color: 0x2f3e2e, roughness: 0.35, metalness: 0.65 })
    );
    body.position.y = 0.9;
    body.castShadow = true;
    const cabin = new THREE.Mesh(
      new THREE.BoxGeometry(2.1, 0.85, 2.4),
      new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.15, metalness: 0.85 })
    );
    cabin.position.set(0, 1.75, -0.3);

    // 4 Gerçekçi Tekerlek
    const wheelGeo = new THREE.CylinderGeometry(0.45, 0.45, 0.35, 16);
    wheelGeo.rotateZ(Math.PI / 2);
    const wheelMat = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.85 });
    [[-1.2, 1.4], [1.2, 1.4], [-1.2, -1.4], [1.2, -1.4]].forEach(([wx, wz]) => {
      const w = new THREE.Mesh(wheelGeo, wheelMat);
      w.position.set(wx, 0.45, wz);
      carGroup.add(w);
    });

    carGroup.add(body, cabin);
    const vx = 12, vz = 14;
    carGroup.position.set(vx, this.getTerrainHeight(vx, vz), vz);
    this.scene.add(carGroup);
    this.vehicles.push({ mesh: carGroup, speed: 0, driver: null });

    // Askeri Mühimmat Sandıkları
    const lootGeo = new THREE.BoxGeometry(0.9, 0.55, 0.65);
    const lootMat = new THREE.MeshStandardMaterial({ color: 0xd97706, emissive: 0x451a03, roughness: 0.4, metalness: 0.3 });
    const spots = [
      { x: 0, z: 0 },
      { x: 26, z: -18 },
      { x: -26, z: 20 },
      { x: -65, z: -55 },
      { x: 15, z: -10 }
    ];
    spots.forEach((pos) => {
      const box = new THREE.Mesh(lootGeo, lootMat);
      box.position.set(pos.x, this.getTerrainHeight(pos.x, pos.z) + 0.35, pos.z);
      box.castShadow = true;
      this.scene.add(box);
      this.lootItems.push({ mesh: box, active: true });
    });
  }
}

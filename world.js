class GameWorld {
  constructor(scene, quality = 'high') {
    this.scene = scene;
    this.quality = quality;
    this.colliders = [];
    this.lootItems = [];
    this.vehicles = [];
    
    this.setupLighting();
    this.createTerrainAndWater();
    this.buildMapStructures();
    this.spawnVehiclesAndLoot();
  }

  setupLighting() {
    this.scene.background = new THREE.Color(0x87a8c9);
    this.scene.fog = new THREE.FogExp2(0x87a8c9, 0.0022);

    const hemiLight = new THREE.HemisphereLight(0xdbeafe, 0x3f4e3c, 0.85);
    this.scene.add(hemiLight);

    this.sunLight = new THREE.DirectionalLight(0xfff1d6, 2.2);
    this.sunLight.position.set(120, 180, 90);
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
    let h = Math.sin(x * 0.018) * Math.cos(z * 0.018) * 6.5;
    h += Math.sin(x * 0.045 + z * 0.03) * 2.2;
    if (dist < 45) h *= 0.25;
    if (dist > 175) h -= (dist - 175) * 0.18;
    return h;
  }

  createTerrainAndWater() {
    const geo = new THREE.PlaneGeometry(520, 520, 128, 128);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;
    const colors = [];

    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const y = this.getTerrainHeight(x, z);
      pos.setY(i, y);

      if (y < 0.4) colors.push(0.76, 0.70, 0.50);
      else if (y > 5.5) colors.push(0.38, 0.40, 0.36);
      else colors.push(0.24, 0.36, 0.20);
    }
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geo.computeVertexNormals();

    const mat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.88,
      metalness: 0.05
    });
    const terrain = new THREE.Mesh(geo, mat);
    terrain.receiveShadow = true;
    this.scene.add(terrain);

    const waterGeo = new THREE.PlaneGeometry(1200, 1200);
    waterGeo.rotateX(-Math.PI / 2);
    const waterMat = new THREE.MeshStandardMaterial({
      color: 0x0e4d64,
      roughness: 0.15,
      metalness: 0.75,
      transparent: true,
      opacity: 0.88
    });
    this.water = new THREE.Mesh(waterGeo, waterMat);
    this.water.position.y = -0.3;
    this.scene.add(this.water);
  }
  buildMapStructures() {
    const wallMat = new THREE.MeshStandardMaterial({ color: 0x9ca3af, roughness: 0.75 });
    const militaryMat = new THREE.MeshStandardMaterial({ color: 0x4b5548, roughness: 0.8 });
    const roofMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.6, metalness: 0.3 });

    const locations = [
      { x: 0, z: 0, w: 14, d: 14, h: 5, mat: wallMat },
      { x: 24, z: -18, w: 12, d: 16, h: 5, mat: wallMat },
      { x: -26, z: 20, w: 16, d: 12, h: 5, mat: militaryMat },
      { x: -65, z: -55, w: 18, d: 14, h: 5.5, mat: militaryMat },
      { x: 70, z: 60, w: 14, d: 14, h: 5, mat: wallMat }
    ];

    locations.forEach(b => this.createEnterableBuilding(b.x, b.z, b.w, b.d, b.h, b.mat, roofMat));

    const treeCount = this.quality === 'low' ? 120 : 280;
    const trunkGeo = new THREE.CylinderGeometry(0.35, 0.5, 4, 6);
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x4a3525, roughness: 0.9 });
    const leavesGeo = new THREE.ConeGeometry(2.6, 6.5, 7);
    const leavesMat = new THREE.MeshStandardMaterial({ color: 0x1e3a1e, roughness: 0.85 });

    const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, treeCount);
    const leaves = new THREE.InstancedMesh(leavesGeo, leavesMat, treeCount);
    trunks.castShadow = this.quality !== 'low';
    leaves.castShadow = this.quality !== 'low';

    const dummy = new THREE.Object3D();
    let idx = 0;
    for (let i = 0; i < treeCount * 2 && idx < treeCount; i++) {
      const rx = (Math.random() - 0.5) * 340;
      const rz = (Math.random() - 0.5) * 340;
      const ry = this.getTerrainHeight(rx, rz);
      if (ry > 0.8 && Math.hypot(rx, rz) > 35) {
        dummy.position.set(rx, ry + 2, rz);
        dummy.scale.setScalar(0.8 + Math.random() * 0.6);
        dummy.updateMatrix();
        trunks.setMatrixAt(idx, dummy.matrix);

        dummy.position.set(rx, ry + 6.2, rz);
        dummy.updateMatrix();
        leaves.setMatrixAt(idx, dummy.matrix);
        this.colliders.push({ x: rx, z: rz, r: 0.6 });
        idx++;
      }
    }
    this.scene.add(trunks, leaves);
  }

  createEnterableBuilding(cx, cz, w, d, h, wallMat, roofMat) {
    const y = this.getTerrainHeight(cx, cz);
    const t = 0.4;
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

    const roof = new THREE.Mesh(new THREE.BoxGeometry(w + 0.8, 0.4, d + 0.8), roofMat);
    roof.position.set(cx, y + h + 0.2, cz);
    roof.castShadow = true;
    this.scene.add(roof);
  }

  spawnVehiclesAndLoot() {
    const carGroup = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(2.4, 1.1, 4.6),
      new THREE.MeshStandardMaterial({ color: 0x3b4d3b, roughness: 0.4, metalness: 0.6 })
    );
    body.position.y = 0.9;
    body.castShadow = true;
    const cabin = new THREE.Mesh(
      new THREE.BoxGeometry(2.1, 0.9, 2.4),
      new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.2, metalness: 0.8 })
    );
    cabin.position.set(0, 1.8, -0.3);
    carGroup.add(body, cabin);

    const vx = 12, vz = 14;
    carGroup.position.set(vx, this.getTerrainHeight(vx, vz), vz);
    this.scene.add(carGroup);
    this.vehicles.push({ mesh: carGroup, speed: 0, driver: null });

    const lootGeo = new THREE.BoxGeometry(0.8, 0.5, 0.8);
    const lootMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, emissive: 0x78350f, roughness: 0.3 });
    const spots = [
      { x: 0, z: 0 },
      { x: 24, z: -18 },
      { x: -26, z: 20 },
      { x: -65, z: -55 },
      { x: 15, z: -10 }
    ];
    spots.forEach((pos) => {
      const box = new THREE.Mesh(lootGeo, lootMat);
      box.position.set(pos.x, this.getTerrainHeight(pos.x, pos.z) + 0.35, pos.z);
      this.scene.add(box);
      this.lootItems.push({ mesh: box, active: true });
    });
  }
}

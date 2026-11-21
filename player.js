class PlayerController {
  constructor(scene, camera, world) {
    this.scene = scene;
    this.camera = camera;
    this.world = world;

    this.hp = 100;
    this.armor = 100;
    this.isDead = false;
    this.inVehicle = null;

    this.velocity = new THREE.Vector3();
    this.isGrounded = false;
    this.isCrouching = false;
    this.isAiming = false;
    this.isSprinting = false;

    this.yaw = 0;
    this.pitch = 0.25;
    this.camDist = 4.2;

    this.keys = {};
    this.joyInput = { x: 0, y: 0 };

    this.buildCharacterMesh();
    this.setupControls();
  }

  buildCharacterMesh() {
    this.group = new THREE.Group();
    this.group.position.set(0, 5, 16);

    const camoMat = new THREE.MeshStandardMaterial({ color: 0x364532, roughness: 0.85, metalness: 0.05 });
    const vestMat = new THREE.MeshStandardMaterial({ color: 0x1c222b, roughness: 0.55, metalness: 0.35 });
    const skinMat = new THREE.MeshStandardMaterial({ color: 0xd69e76, roughness: 0.65 });
    const bootMat = new THREE.MeshStandardMaterial({ color: 0x111317, roughness: 0.7, metalness: 0.2 });
    const metalMat = new THREE.MeshStandardMaterial({ color: 0x181c22, roughness: 0.25, metalness: 0.9 });

    // Anatomik Gövde ve Çelik Yelek
    this.torso = new THREE.Group();
    this.torso.position.y = 1.22;

    const chest = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.20, 0.68, 16), camoMat);
    chest.scale.set(1.25, 1, 0.78);
    chest.castShadow = true;

    const armorPlate = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.22, 0.52, 16), vestMat);
    armorPlate.scale.set(1.28, 1, 0.86);
    armorPlate.position.y = 0.04;

    // Taktik Sırt Çantası
    const backpack = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.48, 0.22), vestMat);
    backpack.position.set(0, 0.04, -0.22);
    backpack.castShadow = true;

    this.torso.add(chest, armorPlate, backpack);

    // Yuvarlak Kafa, Kask ve Taktik Vizör
    this.head = new THREE.Group();
    this.head.position.y = 0.52;

    const skull = new THREE.Mesh(new THREE.SphereGeometry(0.16, 18, 16), skinMat);
    const helmet = new THREE.Mesh(
      new THREE.SphereGeometry(0.185, 18, 14, 0, Math.PI * 2, 0, Math.PI * 0.62),
      vestMat
    );
    helmet.position.y = 0.02;

    const visor = new THREE.Mesh(
      new THREE.CylinderGeometry(0.175, 0.175, 0.07, 16, 1, false, -0.9, 1.8),
      new THREE.MeshStandardMaterial({ color: 0x0ea5e9, roughness: 0.1, metalness: 0.9 })
    );
    visor.position.set(0, 0.03, 0.02);

    this.head.add(skull, helmet, visor);
    this.torso.add(this.head);

    // Omuz ve Kollar (Silindirik Eklemler)
    this.leftArm = new THREE.Group();
    this.leftArm.position.set(-0.34, 0.24, 0.05);
    const lArmMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.06, 0.56, 12), camoMat);
    lArmMesh.position.y = -0.24;
    const lGlove = new THREE.Mesh(new THREE.SphereGeometry(0.065, 10, 10), bootMat);
    lGlove.position.y = -0.54;
    this.leftArm.add(lArmMesh, lGlove);
    this.leftArm.rotation.set(-0.85, 0, -0.25);

    this.rightArm = new THREE.Group();
    this.rightArm.position.set(0.34, 0.24, 0.05);
    const rArmMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.06, 0.56, 12), camoMat);
    rArmMesh.position.y = -0.24;
    const rGlove = new THREE.Mesh(new THREE.SphereGeometry(0.065, 10, 10), bootMat);
    rGlove.position.y = -0.54;
    this.rightArm.add(rArmMesh, rGlove);
    this.rightArm.rotation.x = -1.15;

    // Detaylı M416 Piyade Tüfeği + 8x Dürbün + Susturucu
    this.gunGroup = new THREE.Group();
    const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.11, 0.48), metalMat);
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.42, 10), metalMat);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.02, 0.42);

    const silencer = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, 0.18, 12), bootMat);
    silencer.rotation.x = Math.PI / 2;
    silencer.position.set(0, 0.02, 0.66);

    const mag = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.18, 0.09), bootMat);
    mag.position.set(0, -0.11, 0.08);
    mag.rotation.x = 0.2;

    const scope = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.24, 12), bootMat);
    scope.rotation.x = Math.PI / 2;
    scope.position.set(0, 0.09, -0.02);

    this.muzzleFlash = new THREE.PointLight(0xffaa00, 0, 9);
    this.muzzleFlash.position.set(0, 0.04, 0.8);

    this.gunGroup.add(receiver, barrel, silencer, mag, scope, this.muzzleFlash);
    this.gunGroup.position.set(0, -0.52, 0.22);
    this.gunGroup.rotation.x = 1.15;
    this.rightArm.add(this.gunGroup);

    this.torso.add(this.leftArm, this.rightArm);

    // Silindirik Bacaklar ve Askeri Botlar
    this.leftLeg = new THREE.Group();
    this.leftLeg.position.set(-0.15, 0.86, 0);
    const lLegMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.075, 0.76, 12), camoMat);
    lLegMesh.position.y = -0.38;
    lLegMesh.castShadow = true;
    const lBoot = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, 0.26), bootMat);
    lBoot.position.set(0, -0.78, 0.04);
    this.leftLeg.add(lLegMesh, lBoot);

    this.rightLeg = new THREE.Group();
    this.rightLeg.position.set(0.15, 0.86, 0);
    const rLegMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.075, 0.76, 12), camoMat);
    rLegMesh.position.y = -0.38;
    rLegMesh.castShadow = true;
    const rBoot = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, 0.26), bootMat);
    rBoot.position.set(0, -0.78, 0.04);
    this.rightLeg.add(rLegMesh, rBoot);

    this.group.add(this.torso, this.leftLeg, this.rightLeg);
    this.scene.add(this.group);
  }
  setupControls() {
    window.addEventListener('keydown', (e) => {
      this.keys[e.code] = true;
      if (e.code === 'KeyC') this.isCrouching = !this.isCrouching;
      if (e.code === 'Space' && this.isGrounded && !this.inVehicle) {
        this.velocity.y = 7.5;
        this.isGrounded = false;
      }
    });
    window.addEventListener('keyup', (e) => (this.keys[e.code] = false));

    document.addEventListener('mousemove', (e) => {
      if (document.pointerLockElement === document.body) {
        this.yaw -= e.movementX * 0.0025;
        this.pitch = Math.max(-0.45, Math.min(1.1, this.pitch + e.movementY * 0.0025));
      }
    });

    window.addEventListener('mousedown', (e) => {
      if (e.button === 2) this.isAiming = true;
    });
    window.addEventListener('mouseup', (e) => {
      if (e.button === 2) this.isAiming = false;
    });
    window.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  checkWallCollision(nextX, nextZ) {
    const r = 0.45;
    for (const c of this.world.colliders) {
      if (c.isBox) {
        if (nextX + r > c.minX && nextX - r < c.maxX && nextZ + r > c.minZ && nextZ - r < c.maxZ) {
          return true;
        }
      } else if (Math.hypot(nextX - c.x, nextZ - c.z) < r + c.r) {
        return true;
      }
    }
    return false;
  }

  update(dt, time) {
    if (this.isDead) return;

    if (this.inVehicle) {
      const car = this.inVehicle;
      if (this.keys['KeyW'] || this.joyInput.y < -0.2) car.speed = Math.min(28, car.speed + 18 * dt);
      else if (this.keys['KeyS'] || this.joyInput.y > 0.2) car.speed = Math.max(-10, car.speed - 20 * dt);
      else car.speed *= 0.96;

      if (Math.abs(car.speed) > 0.5) {
        const turn = (this.keys['KeyA'] || this.joyInput.x < -0.2 ? 1 : 0) - (this.keys['KeyD'] || this.joyInput.x > 0.2 ? 1 : 0);
        car.mesh.rotation.y += turn * 2.1 * dt * Math.sign(car.speed);
      }

      car.mesh.position.x += Math.sin(car.mesh.rotation.y) * car.speed * dt;
      car.mesh.position.z += Math.cos(car.mesh.rotation.y) * car.speed * dt;
      car.mesh.position.y = this.world.getTerrainHeight(car.mesh.position.x, car.mesh.position.z);

      this.group.position.copy(car.mesh.position);
      this.group.visible = false;
      this.updateCamera(dt, true);
      return;
    }

    this.group.visible = true;

    let moveF = (this.keys['KeyW'] ? 1 : 0) - (this.keys['KeyS'] ? 1 : 0) - this.joyInput.y;
    let moveR = (this.keys['KeyD'] ? 1 : 0) - (this.keys['KeyA'] ? 1 : 0) + this.joyInput.x;
    const isMoving = Math.hypot(moveF, moveR) > 0.1;

    this.isSprinting = this.keys['ShiftLeft'] && moveF > 0 && !this.isCrouching && !this.isAiming;
    const speed = this.isCrouching ? 3.2 : this.isSprinting ? 10.5 : 6.2;

    if (isMoving) {
      const moveAngle = Math.atan2(moveR, moveF) + this.yaw;
      const vx = Math.sin(moveAngle) * speed;
      const vz = Math.cos(moveAngle) * speed;

      const nextX = this.group.position.x + vx * dt;
      const nextZ = this.group.position.z + vz * dt;

      if (!this.checkWallCollision(nextX, this.group.position.z)) this.group.position.x = nextX;
      if (!this.checkWallCollision(this.group.position.x, nextZ)) this.group.position.z = nextZ;

      const targetRot = this.isAiming ? this.yaw + Math.PI : moveAngle;
      this.group.rotation.y = THREE.MathUtils.lerp(this.group.rotation.y, targetRot, 12 * dt);
    } else if (this.isAiming) {
      this.group.rotation.y = this.yaw + Math.PI;
    }

    this.velocity.y -= 19.8 * dt;
    this.group.position.y += this.velocity.y * dt;
    const groundY = this.world.getTerrainHeight(this.group.position.x, this.group.position.z);

    if (this.group.position.y <= groundY) {
      this.group.position.y = groundY;
      this.velocity.y = 0;
      this.isGrounded = true;
    }

    // Doğal Yürüyüş / Depar ve Gövde Salınımı Animasyonu
    const animSpeed = this.isSprinting ? 14 : 9;
    if (isMoving && this.isGrounded) {
      this.leftLeg.rotation.x = Math.sin(time * animSpeed) * 0.65;
      this.rightLeg.rotation.x = -Math.sin(time * animSpeed) * 0.65;
      this.torso.position.y = (this.isCrouching ? 0.92 : 1.22) + Math.abs(Math.cos(time * animSpeed)) * 0.05;
      this.torso.rotation.z = Math.sin(time * animSpeed) * 0.04;
    } else {
      this.leftLeg.rotation.x = THREE.MathUtils.lerp(this.leftLeg.rotation.x, 0, 10 * dt);
      this.rightLeg.rotation.x = THREE.MathUtils.lerp(this.rightLeg.rotation.x, 0, 10 * dt);
      const targetTorsoY = this.isCrouching ? 0.92 : 1.22;
      this.torso.position.y = THREE.MathUtils.lerp(this.torso.position.y, targetTorsoY, 10 * dt);
      this.torso.rotation.z = THREE.MathUtils.lerp(this.torso.rotation.z, 0, 10 * dt);
    }

    this.muzzleFlash.intensity = THREE.MathUtils.lerp(this.muzzleFlash.intensity, 0, 25 * dt);
    this.updateCamera(dt, false);
  }

  updateCamera(dt, inCar) {
    const targetDist = inCar ? 7.5 : this.isAiming ? 1.85 : 3.9;
    this.camDist = THREE.MathUtils.lerp(this.camDist, targetDist, 10 * dt);

    const shoulderOffset = inCar ? 0 : this.isAiming ? 0.68 : 0.45;
    const heightOffset = inCar ? 2.4 : this.isCrouching ? 1.2 : 1.62;

    const focusPoint = new THREE.Vector3(
      this.group.position.x - Math.cos(this.yaw) * shoulderOffset,
      this.group.position.y + heightOffset,
      this.group.position.z + Math.sin(this.yaw) * shoulderOffset
    );

    const camX = focusPoint.x + Math.sin(this.yaw) * Math.cos(this.pitch) * this.camDist;
    const camY = Math.max(
      this.world.getTerrainHeight(focusPoint.x, focusPoint.z) + 0.5,
      focusPoint.y + Math.sin(this.pitch) * this.camDist
    );
    const camZ = focusPoint.z + Math.cos(this.yaw) * Math.cos(this.pitch) * this.camDist;

    this.camera.position.set(camX, camY, camZ);
    this.camera.lookAt(focusPoint);
  }
}

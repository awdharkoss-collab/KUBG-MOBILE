import * as THREE from 'three';

export class PlayerController {
  constructor(scene, camera, world) {
    this.scene = scene;
    this.camera = camera;
    this.world = world;

    this.hp = 100;
    this.armor = 100;
    this.isDead = false;
    this.inVehicle = null;

    // Hareket ve Fizik Değişkenleri
    this.velocity = new THREE.Vector3();
    this.isGrounded = false;
    this.isCrouching = false;
    this.isAiming = false;
    this.isSprinting = false;

    // TPS Kamera Açıları
    this.yaw = 0;
    this.pitch = 0.25;
    this.camDist = 4.2;

    // Giriş Kontrolleri
    this.keys = {};
    this.joyInput = { x: 0, y: 0 };

    this.buildCharacterMesh();
    this.setupControls();
  }

  buildCharacterMesh() {
    this.group = new THREE.Group();
    this.group.position.set(0, 5, 16);

    const suitMat = new THREE.MeshStandardMaterial({ color: 0x2f3e2e, roughness: 0.75 });
    const vestMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.5, metalness: 0.3 });
    const skinMat = new THREE.MeshStandardMaterial({ color: 0xd9a077, roughness: 0.6 });
    const helmetMat = new THREE.MeshStandardMaterial({ color: 0x1f2937, roughness: 0.35, metalness: 0.5 });

    // Gövde ve Çelik Yelek
    this.torso = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.85, 0.35), suitMat);
    this.torso.position.y = 1.25;
    this.torso.castShadow = true;

    const vest = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.65, 0.42), vestMat);
    vest.position.y = 0.05;
    this.torso.add(vest);

    // Kafa ve Seviye 3 Kask
    this.head = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.38, 0.36), skinMat);
    this.head.position.y = 0.65;
    const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.24, 16, 12), helmetMat);
    helmet.position.y = 0.06;
    this.head.add(helmet);
    this.torso.add(this.head);

    // Kollar ve 3D Tüfek
    this.leftArm = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.7, 0.2), suitMat);
    this.leftArm.position.set(-0.45, 0.05, 0.15);
    this.leftArm.rotation.x = -0.8;

    this.rightArm = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.7, 0.2), suitMat);
    this.rightArm.position.set(0.45, 0.05, 0.2);
    this.rightArm.rotation.x = -1.1;

    // 3D M416 / Keskin Nişancı Silah Modeli
    this.gunGroup = new THREE.Group();
    const gunBody = new THREE.Mesh(
      new THREE.BoxGeometry(0.1, 0.14, 0.85),
      new THREE.MeshStandardMaterial({ color: 0x111827, metalness: 0.85, roughness: 0.25 })
    );
    const scope = new THREE.Mesh(
      new THREE.CylinderGeometry(0.035, 0.035, 0.25, 10),
      new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.9, roughness: 0.2 })
    );
    scope.rotation.x = Math.PI / 2;
    scope.position.set(0, 0.1, -0.05);

    this.muzzleFlash = new THREE.PointLight(0xffaa00, 0, 8);
    this.muzzleFlash.position.set(0, 0.05, 0.6);

    this.gunGroup.add(gunBody, scope, this.muzzleFlash);
    this.gunGroup.position.set(0, -0.35, 0.35);
    this.gunGroup.rotation.x = 1.1;
    this.rightArm.add(this.gunGroup);

    this.torso.add(this.leftArm, this.rightArm);

    // Bacaklar
    this.leftLeg = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.85, 0.24), suitMat);
    this.leftLeg.position.set(-0.18, 0.42, 0);
    this.leftLeg.castShadow = true;

    this.rightLeg = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.85, 0.24), suitMat);
    this.rightLeg.position.set(0.18, 0.42, 0);
    this.rightLeg.castShadow = true;

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

    // Fare ile 360° TPS Kamera ve Sağ Tık Nişan
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

    // Araç Sürüş Modu
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

    // Yürüme / Koşma Yönü
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

    // Yerçekimi ve Zemin Teması
    this.velocity.y -= 19.8 * dt;
    this.group.position.y += this.velocity.y * dt;
    const groundY = this.world.getTerrainHeight(this.group.position.x, this.group.position.z);

    if (this.group.position.y <= groundY) {
      this.group.position.y = groundY;
      this.velocity.y = 0;
      this.isGrounded = true;
    }

    // İskelet / Uzuv Animasyonları
    const animSpeed = this.isSprinting ? 14 : 9;
    if (isMoving && this.isGrounded) {
      this.leftLeg.rotation.x = Math.sin(time * animSpeed) * 0.65;
      this.rightLeg.rotation.x = -Math.sin(time * animSpeed) * 0.65;
    } else {
      this.leftLeg.rotation.x = THREE.MathUtils.lerp(this.leftLeg.rotation.x, 0, 10 * dt);
      this.rightLeg.rotation.x = THREE.MathUtils.lerp(this.rightLeg.rotation.x, 0, 10 * dt);
    }

    // Eğilme (Crouch) Animasyonu
    const targetTorsoY = this.isCrouching ? 0.9 : 1.25;
    this.torso.position.y = THREE.MathUtils.lerp(this.torso.position.y, targetTorsoY, 10 * dt);
    this.muzzleFlash.intensity = THREE.MathUtils.lerp(this.muzzleFlash.intensity, 0, 25 * dt);

    this.updateCamera(dt, false);
  }

  updateCamera(dt, inCar) {
    const targetDist = inCar ? 7.5 : this.isAiming ? 2.1 : 4.2;
    this.camDist = THREE.MathUtils.lerp(this.camDist, targetDist, 10 * dt);

    const shoulderOffset = inCar ? 0 : this.isAiming ? 0.75 : 0.45;
    const heightOffset = inCar ? 2.4 : this.isCrouching ? 1.25 : 1.65;

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

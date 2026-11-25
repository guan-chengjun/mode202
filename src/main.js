import './style.css';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

/* ------------------------------------------------------------------ */
/* 基础参数：尺寸按“米”的视觉比例配置，重点保证阵列清晰、性能流畅        */
/* ------------------------------------------------------------------ */

const MODEL_BASE = `${import.meta.env.BASE_URL}models/`;

const TOWER_HEIGHT = 16;
const RECEIVER_Y = 16.35;

const BASE_SCALE = 0.85;
const BASE_HEIGHT = 0.25 * BASE_SCALE; // ground-base.glb 原始厚度为 0.25
const STAND_HEIGHT = 1.38;
const PIVOT_Y = BASE_HEIGHT + STAND_HEIGHT * 0.98;
const MIRROR_WIDTH = 2.7;

// 三圈径向阵列，共 54 台定日镜
const RING_LAYOUT = [
  { radius: 15, count: 12, offset: 0 },
  { radius: 22, count: 18, offset: Math.PI / 18 },
  { radius: 29, count: 24, offset: 0 },
];

const HELIOSTAT_POSITIONS = RING_LAYOUT.flatMap((ring) =>
  Array.from({ length: ring.count }, (_, i) => {
    const angle = (i / ring.count) * Math.PI * 2 + ring.offset;
    return new THREE.Vector3(
      Math.sin(angle) * ring.radius,
      0,
      Math.cos(angle) * ring.radius,
    );
  }),
);

const SPEEDS = [0.5, 1, 2, 4];

const createDefaultSimulation = () => ({
  running: true,
  speedIndex: 1,
  speed: 1,
  azimuth: -0.65,
  elevation: THREE.MathUtils.degToRad(55),
});

const sim = createDefaultSimulation();

/* ------------------------------------------------------------------ */
/* Three.js 场景、相机、渲染器                                          */
/* ------------------------------------------------------------------ */

const app = document.querySelector('#app');

const scene = new THREE.Scene();
const skyColor = new THREE.Color(0xdde6ee);
scene.background = skyColor;
scene.fog = new THREE.Fog(skyColor, 92, 205);

const camera = new THREE.PerspectiveCamera(
  48,
  window.innerWidth / window.innerHeight,
  0.1,
  300,
);
camera.position.set(47, 35, 56);

const renderer = new THREE.WebGLRenderer({
  antialias: true,
  powerPreference: 'high-performance',
});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.96;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
app.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 6.6, 0);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.minDistance = 12;
controls.maxDistance = 115;
controls.maxPolarAngle = Math.PI * 0.49;
controls.update();

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
});

/* ------------------------------------------------------------------ */
/* 灯光、平整地面、虚拟太阳和塔顶吸热器                                  */
/* ------------------------------------------------------------------ */

scene.add(new THREE.AmbientLight(0xffffff, 0.56));

const sunLight = new THREE.DirectionalLight(0xfff0cc, 2.15);
sunLight.castShadow = true;
sunLight.shadow.mapSize.set(2048, 2048);
sunLight.shadow.camera.left = -42;
sunLight.shadow.camera.right = 42;
sunLight.shadow.camera.top = 42;
sunLight.shadow.camera.bottom = -42;
sunLight.shadow.camera.near = 1;
sunLight.shadow.camera.far = 160;
sunLight.shadow.bias = -0.00035;
sunLight.shadow.normalBias = 0.035;
scene.add(sunLight);
scene.add(sunLight.target);

const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(180, 180),
  new THREE.MeshStandardMaterial({
    color: 0xb8af99,
    roughness: 0.97,
    metalness: 0,
  }),
);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

// 虚拟太阳仅作为位置指示，不引入物理引擎或光线追踪
const sunMesh = new THREE.Mesh(
  new THREE.SphereGeometry(2.3, 24, 16),
  new THREE.MeshBasicMaterial({ color: 0xffc857, fog: false }),
);
scene.add(sunMesh);

const receiverTarget = new THREE.Object3D();
receiverTarget.position.set(0, RECEIVER_Y, 0);
scene.add(receiverTarget);

const receiverMaterial = new THREE.MeshStandardMaterial({
  color: 0x6f4b35,
  metalness: 0.38,
  roughness: 0.42,
  emissive: 0xff8a1e,
  emissiveIntensity: 0.22,
});

const receiverMesh = new THREE.Mesh(
  new THREE.CylinderGeometry(0.82, 0.98, 1.75, 20),
  receiverMaterial,
);
receiverMesh.position.y = RECEIVER_Y;
receiverMesh.castShadow = true;
receiverMesh.receiveShadow = true;
scene.add(receiverMesh);

// 细环标出“塔顶目标区域”，不是能量分布仿真
const targetRing = new THREE.Mesh(
  new THREE.TorusGeometry(1.12, 0.055, 8, 36),
  new THREE.MeshStandardMaterial({
    color: 0xffd27a,
    emissive: 0xff9d2e,
    emissiveIntensity: 0.7,
    roughness: 0.35,
  }),
);
targetRing.rotation.x = Math.PI / 2;
targetRing.position.y = RECEIVER_Y;
scene.add(targetRing);

/* ------------------------------------------------------------------ */
/* GLB 模板与工具函数                                                   */
/* ------------------------------------------------------------------ */

const loader = new GLTFLoader();

const mirrorFaceMaterial = new THREE.MeshStandardMaterial({
  color: 0xbdd9ea,
  metalness: 0.58,
  roughness: 0.1,
  side: THREE.DoubleSide,
  emissive: 0x17344a,
  emissiveIntensity: 0.1,
});

const mirrorFrameMaterial = new THREE.MeshStandardMaterial({
  color: 0x59636f,
  metalness: 0.68,
  roughness: 0.34,
});

function setShadows(root) {
  root.traverse((object) => {
    if (object.isMesh) {
      object.castShadow = true;
      object.receiveShadow = true;
    }
  });
}

/** 等比缩放模型到指定高度，并把包围盒底面移动到父节点 y=0。 */
function normalizeFeet(object, targetHeight) {
  object.scale.setScalar(1);
  object.position.set(0, 0, 0);
  object.updateMatrixWorld(true);

  const box = new THREE.Box3().setFromObject(object);
  const height = Math.max(box.max.y - box.min.y, 1e-6);
  object.scale.setScalar(targetHeight / height);

  object.updateMatrixWorld(true);
  box.setFromObject(object);
  object.position.y -= box.min.y;
}

/** 把竖向镜面 GLB 转成横向定日镜面板，并替换为银蓝镜面/金属边框材质。 */
function prepareMirrorTemplate(mirrorScene) {
  const mirror = mirrorScene;
  mirror.rotation.set(0, 0, Math.PI / 2);
  mirror.position.set(0, 0, 0);
  mirror.scale.setScalar(1);
  mirror.updateMatrixWorld(true);

  const box = new THREE.Box3().setFromObject(mirror);
  const width = Math.max(box.max.x - box.min.x, 1e-6);
  mirror.scale.setScalar(MIRROR_WIDTH / width);

  mirror.updateMatrixWorld(true);
  box.setFromObject(mirror);
  const center = box.getCenter(new THREE.Vector3());
  mirror.position.sub(center);

  mirror.traverse((object) => {
    if (!object.isMesh) return;

    object.castShadow = true;
    object.receiveShadow = true;

    // GLTFLoader 会把两个 primitive 拆成独立 Mesh；按源材质名替换。
    // 0=phong2SG 为镜面，1=lambert8SG 为棕色镜框。
    const materialName = object.material?.name ?? '';
    if (materialName === 'phong2SG') {
      object.material = mirrorFaceMaterial;
    } else if (materialName === 'lambert8SG') {
      object.material = mirrorFrameMaterial;
    } else if (Array.isArray(object.material) && object.material.length >= 2) {
      object.material[0] = mirrorFaceMaterial;
      object.material[1] = mirrorFrameMaterial;
    }
  });

  return mirror;
}

/* ------------------------------------------------------------------ */
/* 镜场与反射线                                                         */
/* ------------------------------------------------------------------ */

let heliostats = [];
let rayGeometry = null;
let rayPositions = null;
let rays = null;

function buildHeliostatField(standTemplate, mirrorTemplate, baseTemplate) {
  heliostats = [];

  rayPositions = new Float32Array(HELIOSTAT_POSITIONS.length * 2 * 3);
  rayGeometry = new THREE.BufferGeometry();
  rayGeometry.setAttribute(
    'position',
    new THREE.BufferAttribute(rayPositions, 3).setUsage(THREE.DynamicDrawUsage),
  );

  const rayMaterial = new THREE.LineBasicMaterial({
    color: 0xf0a12b,
    transparent: true,
    opacity: 0.72,
    depthWrite: false,
  });

  rays = new THREE.LineSegments(rayGeometry, rayMaterial);
  rays.frustumCulled = false; // 端点每帧刷新，避免初始包围盒造成误裁剪
  scene.add(rays);

  HELIOSTAT_POSITIONS.forEach((position) => {
    const root = new THREE.Group();
    root.position.copy(position);

    // 每台镜子的地面底座 GLB
    const base = baseTemplate.clone(true);
    base.scale.setScalar(BASE_SCALE);
    root.add(base);

    // 定日镜支架 GLB
    const standAnchor = new THREE.Group();
    standAnchor.position.y = BASE_HEIGHT;
    const stand = standTemplate.clone(true);
    standAnchor.add(stand);
    root.add(standAnchor);

    // 方位角组：绕 Y 轴；俯仰组：绕局部 X 轴
    const yawGroup = new THREE.Group();
    yawGroup.position.y = PIVOT_Y;
    root.add(yawGroup);

    const pitchGroup = new THREE.Group();
    yawGroup.add(pitchGroup);

    const mirror = mirrorTemplate.clone(true);
    pitchGroup.add(mirror);

    // 反射线起点，略位于镜面之前
    const aimPoint = new THREE.Object3D();
    aimPoint.position.set(0, 0, 0.08);
    pitchGroup.add(aimPoint);

    scene.add(root);
    heliostats.push({ root, yawGroup, pitchGroup, aimPoint });
  });
}

/* ------------------------------------------------------------------ */
/* 太阳方向与定日镜姿态解算                                              */
/* ------------------------------------------------------------------ */

const sunDirection = new THREE.Vector3();
const pivotPosition = new THREE.Vector3();
const targetPosition = new THREE.Vector3();
const toTarget = new THREE.Vector3();
const halfVector = new THREE.Vector3();
const lineStart = new THREE.Vector3();

function updateSun() {
  const horizontal = Math.cos(sim.elevation);

  // az=0 时太阳位于 +Z；方位角缓慢环绕，便于观察塔四周镜场协同
  sunDirection
    .set(
      Math.sin(sim.azimuth) * horizontal,
      Math.sin(sim.elevation),
      Math.cos(sim.azimuth) * horizontal,
    )
    .normalize();

  sunMesh.position.copy(sunDirection).multiplyScalar(96);
  sunLight.position.copy(sunDirection).multiplyScalar(76);
  sunLight.target.position.set(0, 0, 0);
}

/**
 * 定日镜法线 = normalize(指向太阳向量 + 指向吸热器向量)。
 * 这是几何反射角平分线，不做能量或光斑计算。
 */
function updateHeliostats() {
  if (!rayGeometry) return;

  receiverTarget.getWorldPosition(targetPosition);

  heliostats.forEach((heliostat, index) => {
    heliostat.pitchGroup.getWorldPosition(pivotPosition);

    toTarget.copy(targetPosition).sub(pivotPosition).normalize();
    halfVector.copy(sunDirection).add(toTarget);

    if (halfVector.lengthSq() < 1e-8) {
      halfVector.set(0, 1, 0);
    } else {
      halfVector.normalize();
    }

    // 由法线水平投影求方位角，再由垂直分量求俯仰角
    heliostat.yawGroup.rotation.y = Math.atan2(halfVector.x, halfVector.z);
    const horizontalMagnitude = Math.hypot(halfVector.x, halfVector.z);
    heliostat.pitchGroup.rotation.x = -Math.atan2(
      halfVector.y,
      horizontalMagnitude,
    );

    // 刷新反射线：镜面中心 -> 塔顶目标
    heliostat.aimPoint.getWorldPosition(lineStart);

    const vertex = index * 6;
    rayPositions[vertex + 0] = lineStart.x;
    rayPositions[vertex + 1] = lineStart.y;
    rayPositions[vertex + 2] = lineStart.z;
    rayPositions[vertex + 3] = targetPosition.x;
    rayPositions[vertex + 4] = targetPosition.y;
    rayPositions[vertex + 5] = targetPosition.z;
  });

  rayGeometry.attributes.position.needsUpdate = true;
}

/* ------------------------------------------------------------------ */
/* UI 控制                                                              */
/* ------------------------------------------------------------------ */

const toggleButton = document.querySelector('#toggleBtn');
const resetButton = document.querySelector('#resetBtn');
const speedButton = document.querySelector('#speedBtn');
const elevationSlider = document.querySelector('#elevationSlider');
const elevationValue = document.querySelector('#elevationValue');
const loading = document.querySelector('#loading');

function syncUI() {
  toggleButton.textContent = sim.running ? '暂停追踪' : '开始追踪';
  speedButton.textContent = `太阳速度：${sim.speed}×`;
  elevationSlider.value = String(
    Math.round(THREE.MathUtils.radToDeg(sim.elevation)),
  );
  elevationValue.textContent = `${elevationSlider.value}°`;
}

toggleButton.addEventListener('click', () => {
  sim.running = !sim.running;
  syncUI();
});

speedButton.addEventListener('click', () => {
  sim.speedIndex = (sim.speedIndex + 1) % SPEEDS.length;
  sim.speed = SPEEDS[sim.speedIndex];
  syncUI();
});

// 明确的太阳位置预设：方位角 + 高度角。切换后立即重算一次镜场姿态。
const SUN_PRESETS = {
  morning: { azimuth: -1.25, elevation: THREE.MathUtils.degToRad(28) },
  noon: { azimuth: 0, elevation: THREE.MathUtils.degToRad(72) },
  dusk: { azimuth: 1.25, elevation: THREE.MathUtils.degToRad(24) },
};

document.querySelectorAll('[data-sun-preset]').forEach((button) => {
  button.addEventListener('click', () => {
    const preset = SUN_PRESETS[button.dataset.sunPreset];
    if (!preset) return;

    sim.azimuth = preset.azimuth;
    sim.elevation = preset.elevation;

    syncUI();
    updateSun();
    updateHeliostats();
  });
});

elevationSlider.addEventListener('input', () => {
  const degrees = Number(elevationSlider.value);
  sim.elevation = THREE.MathUtils.degToRad(degrees);
  elevationValue.textContent = `${degrees}°`;

  updateSun();

  // 暂停自动运行时，手动高度角仍立即重算几何对准关系
  if (!sim.running) updateHeliostats();
});

resetButton.addEventListener('click', () => {
  Object.assign(sim, createDefaultSimulation());

  camera.position.set(47, 35, 56);
  controls.target.set(0, 6.6, 0);
  controls.update();

  syncUI();
  updateSun();
  updateHeliostats();
});

/* ------------------------------------------------------------------ */
/* 启动：加载四个外部 GLB，全部完成后隐藏 Loading 并启动帧循环            */
/* ------------------------------------------------------------------ */

async function main() {
  const [standGltf, mirrorGltf, towerGltf, baseGltf] = await Promise.all([
    loader.loadAsync(`${MODEL_BASE}heliostat-stand.glb`),
    loader.loadAsync(`${MODEL_BASE}mirror-panel.glb`),
    loader.loadAsync(`${MODEL_BASE}receiver-tower.glb`),
    loader.loadAsync(`${MODEL_BASE}ground-base.glb`),
  ]);

  // 支架模板：低面数三脚架/云台支架，原点落到脚底
  const standTemplate = standGltf.scene;
  normalizeFeet(standTemplate, STAND_HEIGHT);
  setShadows(standTemplate);

  // 镜面模板：横向面板，材质替换为反光银色
  const mirrorTemplate = prepareMirrorTemplate(mirrorGltf.scene);
  setShadows(mirrorTemplate);

  // 中心吸热塔 GLB
  const tower = towerGltf.scene;
  normalizeFeet(tower, TOWER_HEIGHT);
  setShadows(tower);
  scene.add(tower);

  // 地面底座 GLB：中心放大一块，镜场中每台再克隆使用
  const baseTemplate = baseGltf.scene;
  setShadows(baseTemplate);
  baseTemplate.traverse((object) => {
    if (!object.isMesh) return;
    const materials = Array.isArray(object.material)
      ? object.material
      : [object.material];
    materials.forEach((material) => {
      if (material?.color) material.color.set(0xc6bfad);
      if (material && 'roughness' in material) material.roughness = 0.94;
    });
  });

  const centralBase = baseTemplate.clone(true);
  centralBase.scale.set(4.2, 1.35, 4.2);
  scene.add(centralBase);

  buildHeliostatField(standTemplate, mirrorTemplate, baseTemplate);

  syncUI();
  updateSun();
  updateHeliostats();

  loading.classList.add('hidden');

  const clock = new THREE.Clock();

  function animate() {
    requestAnimationFrame(animate);

    const delta = Math.min(clock.getDelta(), 0.05);

    if (sim.running) {
      // 1× 时约 4.8 分钟环绕一周，表现缓慢移动的虚拟太阳
      sim.azimuth += delta * 0.022 * sim.speed;
      updateSun();
      updateHeliostats();
    }

    controls.update();
    renderer.render(scene, camera);
  }

  animate();
}

main().catch((error) => {
  console.error(error);
  loading.innerHTML =
    '<div class="loading-card">GLB 模型加载失败，请通过 npm run dev 或本地服务器访问。</div>';
});

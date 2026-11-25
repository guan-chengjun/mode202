# 塔式太阳能定日镜场 3D 仿真

基于 **Three.js + GLTFLoader + OrbitControls** 的新能源设备原理可视化：多台定日镜组成环形镜场，实时跟随虚拟太阳的方位角/高度角调整每块镜面的方位与俯仰，将反射几何光路汇聚到中心吸热塔顶部。

只做几何层面的聚光关系示意：**不包含物理引擎、光线追踪、光学效率或光斑能量分布计算**。

![status](https://img.shields.io/badge/three.js-GLTF-000?logo=threedotjs) ![license](https://img.shields.io/badge/code-MIT-green)

## 功能

- 三圈环形阵列共 **54 台定日镜**，环绕中心吸热塔布置。
- 虚拟太阳随时间缓慢移动，每台镜子在每一帧独立解算姿态并协同对准塔顶。
- 镜面按“入射方向 + 指向吸热器方向”的角平分线实时计算法线，再分解为 **方位角（Y 轴）+ 俯仰角（X 轴）**。
- 细线条实时绘制每块镜面中心到塔顶目标区域的反射光路，随姿态同步刷新。
- 控制：
  - **暂停追踪 / 开始追踪**：暂停后太阳位置固定，便于观察聚光状态；暂停时仍可手动调高度角并立即重算。
  - **重置镜场**：恢复默认太阳、速度、高度角与相机视角。
  - **太阳速度**：在 `0.5× / 1× / 2× / 4×` 间循环。
  - **晨光 / 正午 / 黄昏**：快速切换太阳方位与高度。
  - **太阳高度角滑杆**：`15°–80°` 手动调整。
- OrbitControls：左键旋转、滚轮缩放、右键平移。
- 环境光 + 平行光（跟随太阳方向）、PCF 柔和阴影、轻微雾效。
- UI 仅保留必要控制，无复杂数据面板。

## 快速运行

需要 Node.js 18+（开发验证使用 Node 22）。

```bash
# 1. 安装依赖（仅 three 运行依赖，vite 为开发/构建依赖）
npm install

# 2. 本地开发（默认 http://localhost:5173）
npm run dev

# 3. 生产构建与本地预览
npm run build
npm run preview
```

> 说明：模型通过 `GLTFLoader` 以外部 `.glb` 文件加载，需要经 HTTP 服务访问，
> 不建议直接双击 `index.html`（`file://` 下模块与模型请求会被浏览器拦截）。

## 目录结构

```
mode202/
├─ index.html               # 页面骨架与简洁控制条
├─ package.json
├─ public/
│  └─ models/
│     ├─ heliostat-stand.glb   # 定日镜支架（CC0，约 648 三角形）
│     ├─ mirror-panel.glb      # 镜面/镜框（CC-BY 3.0，约 52 三角形）
│     ├─ receiver-tower.glb    # 中心桁架塔（CC0，约 25k 三角形，仅 1 座）
│     ├─ ground-base.glb       # 地面/混凝土底座（CC0，约 188 三角形）
│     └─ CREDITS.md            # 模型来源与署名
└─ src/
   ├─ main.js               # 场景、GLB 加载、姿态解算、光路与交互
   └─ style.css             # 控制条与布局样式
```

## 对准原理（几何示意）

对每台定日镜，设：

- `S`：由镜面指向太阳的单位向量；
- `T`：由镜面中心指向塔顶吸热器的单位向量；
- `N`：镜面法线。

根据反射定律，法线取入射与反射方向的角平分线：

```text
N = normalize(S + T)
```

再将法线分解到双轴云台节点：

```text
yaw   = atan2(N.x, N.z)                 // 方位角，绕 Y
pitch = -atan2(N.y, hypot(N.x, N.z))    // 俯仰角，绕局部 X
```

节点层级为 `root → yawGroup(方位) → pitchGroup(俯仰) → mirror`，
因此写入的旋转角与真实双轴定日镜的两个转动轴一一对应。反射线段每帧从镜面实际世界坐标连到塔顶目标。

## 性能

- 镜面、支架、底座均为低面数模型，通过 `clone(true)` 复用模板与几何体/材质。
- 54 台镜子的镜面 + 支架 + 底座合计约 5 万三角形；中心塔约 2.5 万三角形且仅一座。
- 所有反射线合并到同一个 `THREE.LineSegments` 与同一个动态 `BufferGeometry`，每帧只更新一个缓冲。
- 像素比限制为 2，阴影贴图 2048，大面积地面/镜场共用材质。

## 模型来源与许可

GLB 均下载自 Poly Pizza / Grab3D 的低面数资源，完整署名见
[`public/models/CREDITS.md`](public/models/CREDITS.md)：

- `heliostat-stand.glb` — *Tripod* by Quaternius，CC0 1.0，<https://poly.pizza/m/sVTKUSz3m2>
- `mirror-panel.glb` — *Mirror* by Poly by Google，CC-BY 3.0，<https://poly.pizza/m/cjvm-bUFBAW>
- `receiver-tower.glb` — *Power Line Tower* by Grab3D，CC0 1.0，<https://grab3d.com/models/city/power-line-tower/>
- `ground-base.glb` — *Prototype Thin Platform* by Grab3D，CC0 1.0，<https://grab3d.com/models/buildings/proto-thin-platform/>

代码部分可按 MIT 许可自由使用；第三方模型仍遵循其各自许可（CC-BY 模型需保留署名）。

# 资源来源

## 当前秋季首页

母场景及建模源在 `design/garden-release/`（继承 `design/sunny-garden/`）：两层临水主楼、单层长厅、连续屋顶接缝、真实露台与柱网、重建近景枫树、下凹池底。完整成片为 `beauty.png`，固定相机源为 `garden-master.blend`。

网页资源在 `site/assets/models/garden-final/`。建筑使用母场景求值后的真实几何，光照与材质来自固定视角烘焙；植被使用全分辨率可见性及深度表面，水纹轻微实时变化。网页不对烘焙结果再次调色或动态布光。

木材、石材、白墙、陶瓦与配景叶片使用 CC0 来源，详见 `site/assets/models/garden-final/CREDITS.md`。两张用户参考照片仅保留于本地设计目录，没有进入网页材质。

新增台阶石花槽、岸边和廊边低矮植物、细石座灯柱为原创程序建模。模型保留全部三角面与 Float32 顶点精度，以 Meshopt 压缩；光照图为无损 WebP。Meshoptimizer 1.2.0 使用 MIT 许可，解码器与许可文件保存在 assets/vendor/。

截图、同视角差异及交互验证见 `design/garden-release/web-transfer/`。

## 历史四季场景

以下记录适用于保留的旧版春、夏、冬场景及此前资源，不描述当前秋季烘焙场景。

四栋楼阁沿用本项目原创 Blender 程序建模，源代码为 tools/build_architecture.py。本轮继续修改这些模型，增加檐口、窗格、倒角、顶点环境遮蔽，剔除固定视角不可见的左侧窗格及后栏杆。

九张 512×512 WebP 瓦、木、灰泥细节贴图由 tools/build_textures.py 原创程序生成，含颜色、粗糙度和法线；没有外部照片、生成式图片或 HDRI。石材共享细微矿物噪声，雪层保留独立材质。纹理保留基材颜色，仅提供细节。

Three.js 0.180.0、GLTFLoader、DRACOLoader、Reflector、BufferGeometryUtils 沿用官方发行包（MIT）；Draco 解码资源来自同一个 Three.js 官方包，Draco 本体为 Google 开源项目（Apache-2.0）。本地原始供应商文件保留，首页通过 esbuild 0.28.2（MIT）合并压缩。

植物、地面细节、廊道、桥和水面沿用 environment.js 原创程序生成。叶片和落叶实例化；固定视角倒影由本地场景一次渲染，水纹实时变化。

模型与性能统计见 design/rework/REPORT.md 和 resource-audit.json。所有尺寸与耗时均以实际产物和测量记录为准。

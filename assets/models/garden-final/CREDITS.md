# Blender 母场景第三方资产

本版使用 Blender 母场景中的以下 CC0 材质和扫描石块。网页保留建筑几何，并使用固定相机烘焙光照；原始 PBR 纹理保存在设计源目录。

| 资产 | 来源 | 在母场景中的用途与处理 |
|---|---|---|
| White Oak Veneer · 4K color / normal / roughness | https://polyhaven.com/a/white_oak_veneer | 无拼缝木纹；色彩调成深栗木/朱漆，木材法线强度克制，漆层独立调节粗糙度与涂层。 |
| Wood Floor · 4K color / normal / roughness | https://polyhaven.com/a/wood_floor | 已用于近亭地板，按深木地板调色；不用于梁柱。 |
| Beige Wall 001 · 4K color / normal / roughness | https://polyhaven.com/a/beige_wall_001 | 暖灰白粉墙，细颗粒；按约3m尺度映射。 |
| Rock 01 · 4K color / normal / roughness | https://polyhaven.com/a/rock_01 | 整块台阶、台基与铺地石；不包含现代拼缝图案。 |
| GlazedTerracotta001 · 4K PBR | https://ambientcg.com/view?id=GlazedTerracotta001 | 陶质表面源；转灰青色，压低颜色斑驳与法线强度，增加粗糙度；中国瓦件形状由建筑几何单独表达。 |
| Metal046A · 4K PBR | https://ambientcg.com/view?id=Metal046A | 铜色小门件/灯具；减轻粗糙表面起伏。 |
| LeafSet027 · 4K PBR + opacity + scattering | https://ambientcg.com/view?id=LeafSet027 | 实拍宽叶枫图集，用于背景和配景秋树；前景鸡爪槭保留更细裂叶形。`uv-regions.json` 由实际透明遮罩计算每片叶的边界并留1.5%余量，避免图集空白缩小有效叶面积；原图未改写。 |
| Rock 07 · Blender 模型 + 4K PBR | https://polyhaven.com/a/rock_07 | 扫描石块，局部布置在种植和池岸交界，旋转与缩放；不是铺满全场。 |

许可：
- Poly Haven：https://polyhaven.com/license
- ambientCG：https://docs.ambientcg.com/license/

采用记录与参考板中的“未采用候选”分开。下载不代表已经视觉通过；以实际 Blender 成片为准。

本轮太阳与环境光使用 Blender Nishita 天空和方向日光。近景枫树主枝、递归细枝及小叶为程序建模。用户提供的两张参考照片仅在本地参考板使用，不进入网页材质或发布资源。

台阶花槽、地被植物和细灯柱为本项目原创建模。网页几何由 Meshoptimizer 1.2.0 无损编码，MIT 许可见 `../../vendor/LICENSE-meshoptimizer.md`。

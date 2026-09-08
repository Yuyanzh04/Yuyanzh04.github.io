# 张语嫣 · 四季庭院

https://yuyanzh04.github.io/

纯静态 GitHub Pages 个人主页。首页使用 Three.js 与四个原创 Blender GLB，内容页保留个人资料、研究方向和《构建之法》讨论。

## 修改

场景与样式位于 assets/。个人资料、讨论原稿和构建脚本位于 source/。

重建内容页面：

```sh
python -m pip install -r source/requirements.txt
python source/build.py
cp source/site/*.html .
cp source/site/posts/discussion.html posts/discussion.html
```

重建建筑：`blender --background --python source/tools/build_architecture.py`，然后把 source/site/assets/models/*.glb 复制到 assets/models/。Blender 仅用于制作资产，网站运行无需后端。

本地预览：`python -m http.server 8765 --bind 127.0.0.1`。用 ?season=spring、summer、autumn、winter 检查四季。资源来源与许可证见 ASSETS.md。

main 分支根目录由 GitHub Pages 发布。


## 当前秋季首页

秋季采用 Blender 成片的固定视角烘焙光影、真实建筑 GLB 和带深度的 2.5D 植被；水面保留微动。主场景模型约79MB，保留建筑细节。春、夏、冬继续使用原有季节场景。入口为 assets/js/garden.bundle.js，可编辑模块保留在同目录；更新模块后需重新打包。source 中的旧建筑生成脚本对应原有季节资产，不会生成新版秋季母场景。

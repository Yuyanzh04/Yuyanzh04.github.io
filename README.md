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

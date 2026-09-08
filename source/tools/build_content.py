"""Build the ordinary HTML pages for the garden homepage.

The Three.js landing page is maintained separately. This generator owns only
the readable content pages and their shared stylesheet.
"""

from __future__ import annotations

import argparse
import html
import json
import re
from pathlib import Path
from typing import Any

import mistune


def esc(value: Any) -> str:
    """Escape text for HTML text nodes and quoted attributes."""

    return html.escape(str(value), quote=True)


def render_page(title: str, description: str, body: str, *, depth: str = "") -> str:
    """Return a complete HTML document for one content page."""

    nav = f"""<nav class=\"site-nav\" aria-label=\"主导航\">
  <a class=\"site-mark\" href=\"{depth}index.html\">张语嫣 <span>Yuyan Zhang</span></a>
  <div class=\"nav-links\">
    <a href=\"{depth}index.html\">首页 <small>Home</small></a>
    <a href=\"{depth}about.html\">关于 <small>About</small></a>
    <a href=\"{depth}research.html\">研究 <small>Research</small></a>
    <a href=\"{depth}writing.html\">写作 <small>Writing</small></a>
    <a href=\"{depth}projects.html\">项目 <small>Projects</small></a>
  </div>
</nav>"""
    return f"""<!doctype html>
<html lang=\"zh-CN\">
<head>
  <meta charset=\"utf-8\">
  <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">
  <meta name=\"description\" content=\"{esc(description)}\">
  <title>{esc(title)}</title>
  <link rel=\"stylesheet\" href=\"{depth}assets/pages.css?v=1\">
</head>
<body>
  <main class=\"page-shell\">
    {nav}
    {body}
  </main>
</body>
</html>
"""


def page_header(chinese: str, english: str, intro: str = "") -> str:
    intro_html = f"\n<p class=\"page-intro\">{esc(intro)}</p>" if intro else ""
    return f"""<header class=\"page-header\">
  <p class=\"eyebrow\">{esc(english)}</p>
  <h1>{esc(chinese)}</h1>{intro_html}
</header>"""


def build_content(root: Path, output: Path | None = None) -> Path:
    """Build content pages from ``root/profile.json`` and ``root/content``.

    By default pages are written to ``root/site``. ``output`` is useful for an
    isolated build or a preview directory and leaves the source tree alone.
    """

    root = Path(root).expanduser().resolve()
    output_dir = (Path(output).expanduser() if output else root / "site").resolve()
    profile = json.loads((root / "profile.json").read_text(encoding="utf-8"))
    discussion = (root / "content" / "discussion.md").read_text(encoding="utf-8")

    output_dir.mkdir(parents=True, exist_ok=True)
    (output_dir / "posts").mkdir(parents=True, exist_ok=True)
    (output_dir / "assets").mkdir(parents=True, exist_ok=True)

    name = profile["name"]
    english_name = profile["english_name"]
    description = profile["intro"]
    affiliation_url = "https://saids.ustc.edu.cn/15407/list.htm"

    about_body = page_header("关于", "About") + f"""
<section class=\"reading-column\" aria-label=\"个人信息\">
  <p class=\"lead\">{esc(name)} <span class=\"latin\">{esc(english_name)}</span></p>
  <dl class=\"profile-list\">
    <div><dt>身份</dt><dd>{esc(profile['stage'])}</dd></div>
    <div><dt>单位</dt><dd>中国科学技术大学 · <a href=\"{esc(affiliation_url)}\">人工智能与数据科学学院</a></dd></div>
    <div><dt>所在位置</dt><dd>{esc(profile['location'])}</dd></div>
  </dl>
  <div class=\"link-row\" aria-label=\"公开链接\">
    <a class=\"text-link\" href=\"{esc(profile['github'])}\">GitHub <span>↗</span></a>
    <a class=\"text-link\" href=\"{esc(profile['academic_profile'])}\">个人介绍 <span>↗</span></a>
  </div>
</section>"""

    research_body = page_header(
        "研究方向",
        "Research",
        "Agent4Science · Computational Immunology · Protein Language Models",
    ) + """
<section class=\"reading-column\" aria-label=\"研究方向列表\">
  <ul class=\"topic-list\">
    <li><span class=\"topic-index\">01</span><span><strong>Agent4Science</strong><small>Agent4Science</small></span></li>
    <li><span class=\"topic-index\">02</span><span><strong>计算免疫学</strong><small>Computational Immunology</small></span></li>
    <li><span class=\"topic-index\">03</span><span><strong>蛋白质语言模型</strong><small>Protein Language Models</small></span></li>
  </ul>
</section>"""

    writing_body = page_header("写作", "Writing", "文章目录") + """
<section class=\"reading-column\" aria-label=\"文章目录\">
  <ol class=\"article-list\">
    <li>
      <a href=\"posts/discussion.html\"><span>《构建之法》阅读问题与讨论</span><small>Reading questions &amp; discussion</small></a>
      <em>讨论草稿 · 2026-09-05</em>
    </li>
  </ol>
</section>"""

    projects_body = page_header("项目", "Projects") + """
<section class=\"reading-column\" aria-label=\"公开项目\">
  <p class=\"empty-state\">暂无公开项目。</p>
</section>"""

    render = mistune.create_markdown(escape=True, plugins=["table"])
    # The source heading stays in Markdown. The page header supplies the title,
    # so remove only that first level-one heading before rendering.
    discussion_body = page_header(
        "《构建之法》阅读问题与讨论",
        "Discussion",
        "讨论草稿 · 2026-09-05",
    )
    source_without_title = re.sub(r"^#\s+.*(?:\r?\n|$)", "", discussion, count=1)
    discussion_body += f"\n<article class=\"reading-column article\">\n{render(source_without_title)}\n</article>"

    pages = {
        "about.html": render_page(f"关于 · {name}", description, about_body),
        "research.html": render_page(f"研究方向 · {name}", description, research_body),
        "writing.html": render_page(f"写作 · {name}", description, writing_body),
        "projects.html": render_page(f"项目 · {name}", description, projects_body),
        "posts/discussion.html": render_page(
            f"《构建之法》阅读问题与讨论 · {name}",
            description,
            discussion_body,
            depth="../",
        ),
    }
    for relative_path, content in pages.items():
        target = output_dir / relative_path
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(content, encoding="utf-8")

    (output_dir / ".nojekyll").touch()
    return output_dir


def main() -> None:
    parser = argparse.ArgumentParser(description="Build garden content pages")
    parser.add_argument(
        "--root",
        type=Path,
        default=Path(__file__).resolve().parents[1],
        help="project root containing profile.json and content/ (default: this project)",
    )
    parser.add_argument(
        "--output",
        type=Path,
        help="optional output directory instead of ROOT/site",
    )
    args = parser.parse_args()
    print(f"Built content pages in {build_content(args.root, args.output)}")


if __name__ == "__main__":
    main()

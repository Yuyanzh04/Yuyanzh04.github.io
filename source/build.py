"""Build the existing static site: garden entry, reading pages, and original post."""
from pathlib import Path
import shutil
from tools.build_content import build_content
ROOT = Path(__file__).resolve().parent
if __name__ == '__main__':
    build_content(ROOT)
    shutil.copy2(ROOT / 'tools/home.html', ROOT / 'site/index.html')
    (ROOT / 'site/.nojekyll').touch()
    print('Built garden homepage, four content pages and original discussion.')

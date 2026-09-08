"""Check real static artifacts and report size, link, GLB primitives/materials."""
import json
import struct
from pathlib import Path
from html.parser import HTMLParser
from urllib.parse import urlsplit, unquote
ROOT=Path(__file__).resolve().parents[1]
SITE=ROOT/'site'
class Links(HTMLParser):
    def __init__(self): super().__init__();self.links=[]
    def handle_starttag(self,tag,attrs):
        for key,value in attrs:
            if key in ('href','src') and value:self.links.append(value)
errors=[]
for path in SITE.rglob('*.html'):
    parser=Links();parser.feed(path.read_text())
    for link in parser.links:
        url=urlsplit(link)
        if url.scheme or url.netloc or not url.path:continue
        if not (path.parent/unquote(url.path)).exists():errors.append((str(path),link))
assert not errors,errors
for name in ['about','research','writing','projects']:assert (SITE/f'{name}.html').exists()
post=(SITE/'posts/discussion.html').read_text()
assert '人工审查能否继续' in post and '3100 Opinions' in post
models=[]
for path in (SITE/'assets/models').glob('*.glb'):
    raw=path.read_bytes();assert raw[:4]==b'glTF'
    size,kind=struct.unpack('<II',raw[12:20]);j=json.loads(raw[20:20+size])
    triangles=sum(j['accessors'][p['indices']]['count']//3 for m in j['meshes'] for p in m['primitives'])
    models.append({'file':path.name,'bytes':len(raw),'triangles':triangles,'primitives':sum(len(m['primitives']) for m in j['meshes']),'materials':len(j.get('materials',[]))})
print(json.dumps({'html_pages':len(list(SITE.rglob('*.html'))),'link_errors':errors,'models':models,'site_bytes':sum(f.stat().st_size for f in SITE.rglob('*') if f.is_file())},ensure_ascii=False,indent=2))

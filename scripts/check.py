"""Small structural check for a no-build static site.

Verifies that every local asset referenced by index.html exists, that the
social preview image is light enough for crawlers, and that the page has the
metadata a link preview needs.
"""

import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
HTML = os.path.join(ROOT, "index.html")

errors = []


def read(path):
    with open(path, encoding="utf-8") as fh:
        return fh.read()


html = read(HTML)

refs = re.findall(r'(?:src|href)="([^"]+)"', html)
for ref in refs:
    if ref.startswith(("data:", "http://", "https://", "#", "mailto:")):
        continue
    local = ref.split("?")[0].split("#")[0]
    if local in ("", "./"):
        continue
    path = os.path.join(ROOT, local)
    if not os.path.isfile(path):
        errors.append(f"missing asset: {local}")

og = os.path.join(ROOT, "assets", "og.jpg")
if not os.path.isfile(og):
    errors.append("missing social image: assets/og.jpg")
elif os.path.getsize(og) > 300 * 1024:
    errors.append(f"assets/og.jpg is {os.path.getsize(og) // 1024} KB, keep it under 300 KB")

for needle in ('property="og:image"', 'name="description"', 'name="viewport"'):
    if needle not in html:
        errors.append(f"index.html has no {needle}")

if errors:
    print("\n".join(errors))
    sys.exit(1)

print(f"ok: {len(refs)} references checked")

from pathlib import Path
import zipfile
root = Path(__file__).resolve().parent.parent
out = root / 'dist' / 'todoist-better-extension.zip'
out.parent.mkdir(parents=True, exist_ok=True)
if out.exists():
    out.unlink()
paths = [
    'manifest.json', 'background.js', 'popup.html', 'popup.js', 'popup.css',
    'options.html', 'options.js', 'options.css'
]
with zipfile.ZipFile(out, 'w', compression=zipfile.ZIP_DEFLATED) as zf:
    for rel in paths:
        zf.write(root / rel, rel)
    for file in sorted((root / 'icons').glob('*')):
        zf.write(file, file.relative_to(root))
print(out)

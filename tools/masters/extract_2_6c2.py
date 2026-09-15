"""Verify and extract the supplied archive without overwriting any file."""
import hashlib
from pathlib import Path
import zipfile

ROOT = Path(__file__).resolve().parents[2]
EXPECTED = {
    'neighborhood-day-expanded-v2.png': '4514294d1c9c692e3671b46314be55c8af77ff11c4243ac6464f42d347fdac29',
    'vehicle-road-guide-v1.jpeg': 'b7f178fc331c4d53ffc1251b71e57a71a0f4839c93d9432b3f1cf5206e693a74',
}
archive = ROOT / 'lot-2.6c2-inputs.zip'
assert hashlib.sha256(archive.read_bytes()).hexdigest() == 'ae408b3bbc2efd4433b7d3d52ac564f9c03eace923e189ae3c385fcca83e21ba'
destination = ROOT / 'references/lot-2.6c2'
with zipfile.ZipFile(archive) as source:
    files = {Path(n).name: source.read(n) for n in source.namelist() if not n.endswith('/')}
    assert set(files) == set(EXPECTED) | {'README-2.6C.2.txt'}
    for name, digest in EXPECTED.items():
        assert hashlib.sha256(files[name]).hexdigest() == digest, name
    assert not any((destination / name).exists() for name in files), 'Refusing overwrite'
    destination.mkdir(parents=True, exist_ok=True)
    for name, data in files.items():
        with (destination / name).open('xb') as output:
            output.write(data)
        print(hashlib.sha256(data).hexdigest(), name)

"""Strict ZIP/PNG validation and one-row edge padding; no resampling or Blender."""
import argparse, hashlib, json, pathlib, struct, zipfile, zlib

def chunk(kind, data):
    return struct.pack('>I', len(data))+kind+data+struct.pack('>I',zlib.crc32(kind+data)&0xffffffff)

def inspect(raw):
    assert raw[:8] == b'\x89PNG\r\n\x1a\n', 'PNG signature'
    pos=8; chunks=[]
    while pos<len(raw):
        size=struct.unpack('>I',raw[pos:pos+4])[0]; kind=raw[pos+4:pos+8]; data=raw[pos+8:pos+8+size]
        assert len(data)==size and zlib.crc32(kind+data)&0xffffffff==struct.unpack('>I',raw[pos+8+size:pos+12+size])[0], 'PNG CRC'
        chunks.append((kind,data)); pos+=size+12
    assert chunks[-1][0]==b'IEND' and pos==len(raw)
    w,h,depth,color,compression,filtering,interlace=struct.unpack('>IIBBBBB',chunks[0][1])
    assert depth==8 and color in (2,6) and interlace==0
    scan=zlib.decompress(b''.join(d for k,d in chunks if k==b'IDAT')); bpp=3 if color==2 else 4; stride=w*bpp
    assert len(scan)==h*(stride+1)
    rows=[]; prev=bytearray(stride)
    for y in range(h):
        f=scan[y*(stride+1)]; row=bytearray(scan[y*(stride+1)+1:(y+1)*(stride+1)]); assert f<=4
        for x in range(stride):
            a=row[x-bpp] if x>=bpp else 0; b=prev[x]; c=prev[x-bpp] if x>=bpp else 0
            p=a+b-c; ds=[abs(p-a),abs(p-b),abs(p-c)]; paeth=[a,b,c][ds.index(min(ds))]
            row[x]=(row[x]+[0,a,b,(a+b)//2,paeth][f])&255
        rows.append(bytes(row)); prev=row
    return w,h,chunks,rows

def extract(archive, target):
    target.mkdir(parents=True,exist_ok=True); entries={}
    with zipfile.ZipFile(archive) as pack:
        expected=[f'neighborhood-{m}-master-v1.png' for m in ('day','dusk','night')]
        assert sorted(pack.namelist())==sorted(expected) and pack.testzip() is None
        for mood,name in zip(('day','dusk','night'),expected):
            raw=pack.read(name); w,h,chunks,rows=inspect(raw); original=hashlib.sha256(raw).hexdigest()
            assert w==853 and h in (1843,1844)
            if h==1843:
                header=struct.pack('>II',w,1844)+chunks[0][1][8:]
                raw=raw[:8]+chunk(b'IHDR',header)+chunk(b'IDAT',zlib.compress(b''.join(b'\0'+r for r in rows+[rows[-1]]),9))+chunk(b'IEND',b'')
            (target/name).write_bytes(raw)
            entries[mood]={'image':str(target/name),'width':853,'height':1844,'sourceHeight':h,'bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest(),'sourceSha256':original,'normalization':'duplicate last row' if h==1843 else 'none'}
    manifest={'version':1,'mapId':'REFERENCE_QUARTER_V1','width':853,'height':1844,'images':entries,'transition':'gradual tint and short crossfade, 1 business minute at end of each transition interval'}
    (target/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
    print(json.dumps(manifest,indent=2))
if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('archive');p.add_argument('--output',default='assets/art-v2/masters');a=p.parse_args();extract(a.archive,pathlib.Path(a.output))

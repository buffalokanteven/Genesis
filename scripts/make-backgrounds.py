#!/usr/bin/env python3
"""Genera fondos cuadrados (2000x2000) con la paleta STILL para fotos de producto.
Sin dependencias: codifica PNG a mano."""
import zlib, struct, math

SIZE = 2000

def png(path, W, H, buf):
    def chunk(typ, data):
        c = typ + data
        return struct.pack(">I", len(data)) + c + struct.pack(">I", zlib.crc32(c) & 0xffffffff)
    stride = W * 3
    raw = bytearray()
    for y in range(H):
        raw.append(0)
        raw.extend(buf[y*stride:(y+1)*stride])
    out = (b"\x89PNG\r\n\x1a\n"
           + chunk(b"IHDR", struct.pack(">IIBBBBB", W, H, 8, 2, 0, 0, 0))
           + chunk(b"IDAT", zlib.compress(bytes(raw), 9))
           + chunk(b"IEND", b""))
    open(path, "wb").write(out)
    print("OK ->", path, f"{len(out)//1024} KB")

def make(path, base, center, edge_dark=0.06, glowx=0.5, glowy=0.42):
    """base: color de fondo; center: color del brillo central suave."""
    W = H = SIZE
    buf = bytearray(W*H*3)
    i = 0
    for y in range(H):
        v = y/(H-1)
        for x in range(W):
            u = x/(W-1)
            dx = u-glowx; dy = v-glowy
            d = math.sqrt(dx*dx+dy*dy)
            glow = max(0.0, 1.0-d/0.85); glow *= glow  # brillo suave al centro
            r = base[0]+(center[0]-base[0])*glow
            g = base[1]+(center[1]-base[1])*glow
            b = base[2]+(center[2]-base[2])*glow
            # viñeta muy sutil en las esquinas
            cxv = u-0.5; cyv = v-0.5
            dd = math.sqrt(cxv*cxv+cyv*cyv)
            vig = 1.0 - edge_dark*min(1.0, dd/0.75)
            r*=vig; g*=vig; b*=vig
            buf[i]=int(max(0,min(255,r))); buf[i+1]=int(max(0,min(255,g))); buf[i+2]=int(max(0,min(255,b)))
            i += 3
    png(path, W, H, buf)

# 1) Crema (principal, recomendado)
make("public/img/bg-cream.png",  base=(244,239,231), center=(252,249,244))
# 2) Arena suave
make("public/img/bg-sand.png",   base=(232,221,206), center=(242,234,222))
# 3) Piedra/greige
make("public/img/bg-stone.png",  base=(222,214,201), center=(235,229,218))

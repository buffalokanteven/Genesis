#!/usr/bin/env python3
"""Genera el fondo hero de STILL (degradado océano) como PNG, sin texto.
Sin dependencias externas: codifica el PNG a mano (zlib + struct)."""
import zlib, struct, math

W, H = 2200, 1200

# Paleta (misma vibe del prototipo)
TOP = (60, 90, 104)     # teal claro arriba-derecha
BOT = (26, 47, 50)      # teal-verde profundo abajo
HL  = (96, 126, 136)    # brillo suave (glow)
HLX, HLY = 0.64, 0.28   # posición del brillo

buf = bytearray(W * H * 3)
i = 0
for y in range(H):
    v = y / (H - 1)
    for x in range(W):
        u = x / (W - 1)
        # degradado diagonal base
        t = u * 0.30 + v * 0.70
        r = TOP[0] + (BOT[0] - TOP[0]) * t
        g = TOP[1] + (BOT[1] - TOP[1]) * t
        b = TOP[2] + (BOT[2] - TOP[2]) * t
        # brillo radial suave
        dx = u - HLX; dy = v - HLY
        d = math.sqrt(dx * dx + dy * dy)
        glow = max(0.0, 1.0 - d / 0.80)
        glow *= glow
        r += (HL[0] - r) * glow * 0.55
        g += (HL[1] - g) * glow * 0.55
        b += (HL[2] - b) * glow * 0.55
        # viñeta (oscurece esquinas)
        cx = u - 0.5; cy = v - 0.5
        dd = math.sqrt(cx * cx + cy * cy)
        vig = 1.0 - 0.24 * min(1.0, dd / 0.85)
        r *= vig; g *= vig; b *= vig
        buf[i]   = int(max(0, min(255, r)))
        buf[i+1] = int(max(0, min(255, g)))
        buf[i+2] = int(max(0, min(255, b)))
        i += 3

def png_chunk(typ, data):
    c = typ + data
    return struct.pack(">I", len(data)) + c + struct.pack(">I", zlib.crc32(c) & 0xffffffff)

stride = W * 3
raw = bytearray()
for y in range(H):
    raw.append(0)  # filtro None por scanline
    raw.extend(buf[y * stride:(y + 1) * stride])

out = (b"\x89PNG\r\n\x1a\n"
       + png_chunk(b"IHDR", struct.pack(">IIBBBBB", W, H, 8, 2, 0, 0, 0))
       + png_chunk(b"IDAT", zlib.compress(bytes(raw), 9))
       + png_chunk(b"IEND", b""))

with open("public/img/hero-still.png", "wb") as f:
    f.write(out)
print("OK -> public/img/hero-still.png", f"{W}x{H}", f"{len(out)//1024} KB")

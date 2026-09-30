import zlib
import struct
import math

def create_png(width, height, filename):
    # Generates a smooth, luxurious purple-gold branded badge PNG
    raw_rows = []
    
    # Theme colors: deep purple bg #2e1065, border #7c3aed, gold accent #f59e0b, center book/star
    cx = width / 2.0
    cy = height / 2.0
    radius = width * 0.44

    for y in range(height):
        row = [0] # filter type None
        for x in range(width):
            dx = (x - cx)
            dy = (y - cy)
            dist = math.sqrt(dx*dx + dy*dy)
            
            # Rounded squircle / circular badge
            if dist <= radius:
                # Gradient factor from top-left to bottom-right
                t = (x + y) / (width + height)
                
                # Check for border
                if dist > radius - max(3, width * 0.03):
                    # Accent gold/purple border
                    r, g, b, a = 192, 132, 252, 255
                elif dist < width * 0.18:
                    # Central glowing gold emblem
                    r, g, b, a = 245, 158, 11, 255
                else:
                    # Deep luxury gradient: #2e1065 to #4c1d95
                    r = int(35 + t * 45)
                    g = int(12 + t * 25)
                    b = int(85 + t * 75)
                    a = 255
            else:
                # Transparent outside circle
                r, g, b, a = 0, 0, 0, 0
                
            row.extend([r, g, b, a])
        raw_rows.append(bytes(row))
        
    raw_data = b"".join(raw_rows)
    compressed = zlib.compress(raw_data, 9)
    
    def chunk(tag, data):
        length = struct.pack("!I", len(data))
        crc = struct.pack("!I", zlib.crc32(tag + data) & 0xffffffff)
        return length + tag + data + crc

    png_header = b"\x89PNG\r\n\x1a\n"
    ihdr = chunk(b"IHDR", struct.pack("!IIBBBBB", width, height, 8, 6, 0, 0, 0))
    idat = chunk(b"IDAT", compressed)
    iend = chunk(b"IEND", b"")
    
    with open(filename, "wb") as f:
        f.write(png_header + ihdr + idat + iend)

create_png(192, 192, "public/pwa-192x192.png")
create_png(512, 512, "public/pwa-512x512.png")
create_png(180, 180, "public/apple-touch-icon.png")
create_png(64, 64, "public/favicon.ico")
print("Icons generated successfully!")

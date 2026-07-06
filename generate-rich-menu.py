from PIL import Image, ImageDraw, ImageFont
import math

W = 2500
H = 1686
ROW_H = H // 2
COL_W = W // 3

# Colors
BG = "#070d1a"
CARD_TOP_START = "#1e3a8a"
CARD_TOP_END = "#5B6FF0"
TASKS_BG_START = "#0f766e"
TASKS_BG_END = "#14b8a6"
REMIND_BG_START = "#b45309"
REMIND_BG_END = "#f59e0b"
SETTINGS_BG_START = "#334155"
SETTINGS_BG_END = "#64748b"
TEXT = "#FFFFFF"
SHADOW = "#000000"

img = Image.new("RGB", (W, H), BG)
draw = ImageDraw.Draw(img)

def hex_to_rgb(hex_color):
    hex_color = hex_color.lstrip('#')
    return tuple(int(hex_color[i:i+2], 16) for i in (0, 2, 4))

def rgb_to_hex(rgb):
    return '#{:02x}{:02x}{:02x}'.format(*rgb)

def gradient(draw, x1, y1, x2, y2, start_hex, end_hex, steps=120):
    s = hex_to_rgb(start_hex)
    e = hex_to_rgb(end_hex)
    for i in range(steps):
        ratio = i / steps
        c = tuple(int(s[j] + (e[j] - s[j]) * ratio) for j in range(3))
        y = y1 + (y2 - y1) * i // steps
        y_next = y1 + (y2 - y1) * (i + 1) // steps
        draw.rectangle([x1, y, x2, y_next], fill=rgb_to_hex(c))

# Background gradients
gradient(draw, 0, 0, W, ROW_H, CARD_TOP_START, CARD_TOP_END)
gradient(draw, 0, ROW_H, COL_W, H, TASKS_BG_START, TASKS_BG_END)
gradient(draw, COL_W, ROW_H, COL_W * 2, H, REMIND_BG_START, REMIND_BG_END)
gradient(draw, COL_W * 2, ROW_H, W, H, SETTINGS_BG_START, SETTINGS_BG_END)

# White dividers
draw.line([(0, ROW_H), (W, ROW_H)], fill="#ffffff", width=10)
draw.line([(COL_W, ROW_H), (COL_W, H)], fill="#ffffff", width=10)
draw.line([(COL_W * 2, ROW_H), (COL_W * 2, H)], fill="#ffffff", width=10)

# Fonts
try:
    font_title = ImageFont.truetype("/System/Library/Fonts/SFCompact.ttf", 130)
    font_subtitle = ImageFont.truetype("/System/Library/Fonts/SFCompact.ttf", 60)
    font_label = ImageFont.truetype("/System/Library/Fonts/SFCompact.ttf", 90)
except:
    font_title = ImageFont.load_default()
    font_subtitle = font_title
    font_label = font_title

def text_size(draw, text, font):
    bbox = draw.textbbox((0, 0), text, font=font)
    return bbox[2] - bbox[0], bbox[3] - bbox[1]

def draw_text_shadow(draw, text, x, y, font, fill, shadow_color="#000000", offset=5):
    draw.text((x + offset, y + offset), text, font=font, fill=shadow_color)
    draw.text((x, y), text, font=font, fill=fill)

# === Top: Morning Briefing ===
cx = W // 2
cy = ROW_H // 2 - 60
r = 100
# Rays
for angle in range(0, 360, 45):
    rad = math.radians(angle)
    x1 = cx + math.cos(rad) * (r + 20)
    y1 = cy + math.sin(rad) * (r + 20)
    x2 = cx + math.cos(rad) * (r + 85)
    y2 = cy + math.sin(rad) * (r + 85)
    draw.line([(x1, y1), (x2, y2)], fill="#FFD700", width=28)
    draw.ellipse([x2 - 14, y2 - 14, x2 + 14, y2 + 14], fill="#FFD700")
# Sun body
draw.ellipse([cx - r, cy - r, cx + r, cy + r], fill="#FFD700")
# Face
eye_r = 14
left_eye_cx = cx - 30
right_eye_cx = cx + 30
eye_cy = cy - 5
draw.ellipse([left_eye_cx - eye_r, eye_cy - eye_r, left_eye_cx + eye_r, eye_cy + eye_r], fill="#333333")
draw.ellipse([right_eye_cx - eye_r, eye_cy - eye_r, right_eye_cx + eye_r, eye_cy + eye_r], fill="#333333")
draw.arc([cx - 35, cy - 20, cx + 35, cy + 35], start=0, end=180, fill="#333333", width=12)

title = "MORNING BRIEFING"
tw, th = text_size(draw, title, font_title)
tx = (W - tw) // 2
ty = cy + r + 80
draw_text_shadow(draw, title, tx, ty, font_title, TEXT)

sub = "Tap for today"
sw, sh = text_size(draw, sub, font_subtitle)
sx = (W - sw) // 2
sy = ty + th + 25
draw_text_shadow(draw, sub, sx, sy, font_subtitle, TEXT)

# === Tasks icon ===
def draw_tasks_icon(draw, cx, cy, size):
    w = size
    h = size * 1.2
    x = cx - w // 2
    y = cy - h // 2
    # Clipboard board
    draw.rounded_rectangle([x, y + 30, x + w, y + h], radius=22, fill="#ffffff")
    # Clip
    draw.rounded_rectangle([x + w // 2 - 40, y, x + w // 2 + 40, y + 55], radius=14, fill="#ffffff")
    # Three checklist items with green checks
    item_h = 32
    gap = 38
    start_y = y + 75
    check_color = TASKS_BG_END
    for i in range(3):
        yy = start_y + i * (item_h + gap)
        # Checkbox
        draw.rounded_rectangle([x + 35, yy, x + 75, yy + item_h], radius=8, fill=check_color)
        # Line
        line_w = w - 130
        draw.rounded_rectangle([x + 95, yy + item_h // 2 - 6, x + 95 + line_w, yy + item_h // 2 + 6], radius=5, fill="#94a3b8")
        # White checkmark in box
        cy_chk = yy + item_h // 2
        draw.line([(x + 43, cy_chk - 2), (x + 55, cy_chk + 10)], fill="#ffffff", width=6)
        draw.line([(x + 55, cy_chk + 10), (x + 70, cy_chk - 10)], fill="#ffffff", width=6)

# === Bell icon ===
def draw_bell_icon(draw, cx, cy, size):
    r = size // 2
    # Main bell shape: filled semicircle with straight sides
    body_top = cy - r * 0.5
    body_bottom = cy + r * 0.7
    # Top dome
    draw.ellipse([cx - r * 0.8, body_top - r * 0.5, cx + r * 0.8, body_top + r * 0.5], fill="#ffffff")
    # Body rectangle
    draw.rectangle([cx - r * 0.8, body_top, cx + r * 0.8, body_bottom], fill="#ffffff")
    # Bottom rim
    draw.rounded_rectangle([cx - r * 0.85, body_bottom - 15, cx + r * 0.85, body_bottom + 15], radius=10, fill="#ffffff")
    # Clapper
    draw.ellipse([cx - r * 0.22, body_bottom + 5, cx + r * 0.22, body_bottom + r * 0.5], fill="#ffffff")
    # Top ring
    draw.rounded_rectangle([cx - r * 0.22, cy - r * 1.05, cx + r * 0.22, cy - r * 0.65], radius=10, fill="#ffffff")
    # Red notification badge
    badge_r = 38
    bx = cx + r * 0.45
    by = cy - r * 0.35
    draw.ellipse([bx - badge_r, by - badge_r, bx + badge_r, by + badge_r], fill="#ef4444", outline="#ffffff", width=6)

# === Settings icon ===
def draw_settings_icon(draw, cx, cy, size):
    r = size // 2
    teeth = 8
    for i in range(teeth):
        a1 = math.radians(i * 360 / teeth - 14)
        a2 = math.radians(i * 360 / teeth + 14)
        x_in1 = cx + math.cos(a1) * r * 0.55
        y_in1 = cy + math.sin(a1) * r * 0.55
        x_out1 = cx + math.cos(a1) * r * 1.05
        y_out1 = cy + math.sin(a1) * r * 1.05
        x_out2 = cx + math.cos(a2) * r * 1.05
        y_out2 = cy + math.sin(a2) * r * 1.05
        x_in2 = cx + math.cos(a2) * r * 0.55
        y_in2 = cy + math.sin(a2) * r * 0.55
        draw.polygon([(x_in1, y_in1), (x_out1, y_out1), (x_out2, y_out2), (x_in2, y_in2)], fill="#ffffff")
    draw.ellipse([cx - r * 0.5, cy - r * 0.5, cx + r * 0.5, cy + r * 0.5], fill=SETTINGS_BG_END)
    draw.ellipse([cx - r * 0.22, cy - r * 0.22, cx + r * 0.22, cy + r * 0.22], fill="#ffffff")

# === Bottom left: Tasks ===
bx = COL_W // 2
by = ROW_H + ROW_H // 2 - 10
draw_tasks_icon(draw, bx, by - 70, 170)
label = "TASKS"
lw, lh = text_size(draw, label, font_label)
draw_text_shadow(draw, label, bx - lw // 2, by + 100, font_label, TEXT)

# === Bottom middle: Remind ===
bx = COL_W + COL_W // 2
draw_bell_icon(draw, bx, by - 70, 170)
label = "REMIND"
lw, lh = text_size(draw, label, font_label)
draw_text_shadow(draw, label, bx - lw // 2, by + 100, font_label, TEXT)

# === Bottom right: Settings ===
bx = COL_W * 2 + COL_W // 2
draw_settings_icon(draw, bx, by - 70, 170)
label = "SETTINGS"
lw, lh = text_size(draw, label, font_label)
draw_text_shadow(draw, label, bx - lw // 2, by + 100, font_label, TEXT)

img.save("rich-menu-line.png", "PNG")
print("Saved rich-menu-line.png")

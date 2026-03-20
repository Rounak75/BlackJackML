"""
yolo/generate_dataset.py — Synthetic Card Dataset Generator
═══════════════════════════════════════════════════════════════════════════════

WHAT THIS DOES:
    Generates a large synthetic dataset of playing card images with YOLO-format
    bounding box labels. No real casino screenshots needed.

WHY SYNTHETIC DATA?
    • We can generate unlimited images — no scraping, no labelling by hand
    • We control every variable: card size, angle, background, lighting
    • Augmentations are built in: perspective, blur, brightness, shadow, overlap
    • The resulting YOLO model generalises to real screenshots because it has
      seen cards at every possible size, angle, and lighting condition

DATASET STRUCTURE CREATED:
    yolo/dataset/
        images/
            train/    ← 80% of images (used for training)
            val/      ← 10% of images (used for validation during training)
            test/     ← 10% of images (used for final accuracy check)
        labels/
            train/    ← YOLO .txt labels matching each train image
            val/      ← YOLO .txt labels matching each val image
            test/     ← YOLO .txt labels matching each test image
        dataset.yaml  ← YOLO config file (points to paths, lists class names)

YOLO LABEL FORMAT (one line per card in the image):
    class_id  cx  cy  width  height
    All values are normalised to [0, 1] relative to image dimensions.
    cx, cy = centre of the bounding box (not top-left corner)

HOW TO RUN:
    python yolo/generate_dataset.py
    python yolo/generate_dataset.py --images 15000    # more images = better model
    python yolo/generate_dataset.py --images 5000     # quick test

REQUIREMENTS:
    pip install opencv-python Pillow numpy
    (All already in requirements.txt)
"""

import argparse
import json
import math
import os
import random
import shutil
import sys
from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont


# ── Card class definitions ─────────────────────────────────────────────────────
# 52 classes: one per unique card (rank + suit combination)
# The model predicts rank AND suit in a single pass

RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K']
SUITS = ['spades', 'hearts', 'diamonds', 'clubs']
SUIT_SYMBOLS = {'spades': '♠', 'hearts': '♥', 'diamonds': '♦', 'clubs': '♣'}

# Build the list of all 52 class names in a consistent order
# Index 0 = A_spades, 1 = A_hearts, 2 = A_diamonds, 3 = A_clubs,
# Index 4 = 2_spades, ... Index 51 = K_clubs
CLASS_NAMES = [f'{rank}_{suit}' for rank in RANKS for suit in SUITS]
CLASS_MAP   = {name: i for i, name in enumerate(CLASS_NAMES)}  # name → index


# ── Colour palette ─────────────────────────────────────────────────────────────
# Red suits (hearts, diamonds) use red ink
# Black suits (spades, clubs) use near-black ink
SUIT_COLORS = {
    'spades':   (15,  15,  15),    # near-black
    'clubs':    (15,  15,  15),
    'hearts':   (185, 20,  20),    # casino red
    'diamonds': (185, 20,  20),
}

# Background colours that casino tables commonly use
BACKGROUND_PRESETS = [
    (25,  90,  25),    # classic green felt
    (18,  65,  18),    # dark green felt
    (15,  45,  75),    # navy blue (some casinos)
    (45,  20,  55),    # purple felt (rare but exists)
    (30,  30,  30),    # dark grey (digital casino)
    (50,  35,  20),    # brown (poker table)
    (20,  60,  45),    # teal felt
]


# ── Font loading ───────────────────────────────────────────────────────────────

def _load_fonts():
    """
    Try to load a bold sans-serif font for card rendering.
    Falls back through several common paths, then to PIL's built-in default.
    Returns a dict of {size: font} for common sizes.
    """
    candidates = [
        # Linux (most common)
        '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
        '/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf',
        '/usr/share/fonts/truetype/freefont/FreeSansBold.ttf',
        # macOS
        '/Library/Fonts/Arial Bold.ttf',
        '/System/Library/Fonts/Helvetica.ttc',
        # Windows
        'C:/Windows/Fonts/arialbd.ttf',
        'C:/Windows/Fonts/Arial.ttf',
    ]
    font_path = None
    for path in candidates:
        if os.path.exists(path):
            font_path = path
            break

    fonts = {}
    for size in [10, 12, 14, 16, 18, 20, 24, 28, 32, 36, 40, 48, 56, 64]:
        try:
            if font_path:
                fonts[size] = ImageFont.truetype(font_path, size)
            else:
                fonts[size] = ImageFont.load_default()
        except Exception:
            fonts[size] = ImageFont.load_default()

    if font_path:
        print(f'  Font: {os.path.basename(font_path)}')
    else:
        print('  Font: PIL default (ranks may look basic)')
    return fonts


FONTS = _load_fonts()


# ── Card renderer ──────────────────────────────────────────────────────────────

def render_card(rank: str, suit: str,
                card_w: int = 100, card_h: int = 140,
                corner_radius: int = 6) -> Image.Image:
    """
    Render a single playing card as a PIL RGBA image.

    The card has:
    - White background with a thin grey border
    - Rank + suit symbol in the top-left corner
    - Large suit symbol in the centre
    - Rank + suit mirrored in the bottom-right (rotated 180°)
    - Rounded corners (using a mask)

    Args:
        rank        Card rank: 'A', '2'…'10', 'J', 'Q', 'K'
        suit        Card suit: 'spades', 'hearts', 'diamonds', 'clubs'
        card_w      Width in pixels
        card_h      Height in pixels
        corner_radius  Rounding of card corners

    Returns:
        PIL RGBA image of the card
    """
    img  = Image.new('RGBA', (card_w, card_h), (255, 255, 255, 255))
    draw = ImageDraw.Draw(img)
    color = SUIT_COLORS[suit]
    sym   = SUIT_SYMBOLS[suit]

    # Border
    draw.rectangle([1, 1, card_w-2, card_h-2], outline=(200, 200, 200), width=1)

    # Font sizes proportional to card size
    rank_size   = max(10, int(card_w * 0.26))
    sym_size    = max(8,  int(card_w * 0.17))
    center_size = max(16, int(card_w * 0.45))
    pad         = max(3,  int(card_w * 0.06))

    f_rank   = FONTS.get(rank_size,   FONTS[max(FONTS)])
    f_sym    = FONTS.get(sym_size,    FONTS[max(FONTS)])
    f_center = FONTS.get(center_size, FONTS[max(FONTS)])

    # Top-left rank and suit symbol
    draw.text((pad, pad),            rank, fill=color, font=f_rank)
    draw.text((pad, pad + rank_size + 1), sym, fill=color, font=f_sym)

    # Centre suit symbol
    try:
        bbox = draw.textbbox((0, 0), sym, font=f_center)
        tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
        cx = (card_w - tw) // 2
        cy = (card_h - th) // 2
        draw.text((cx, cy), sym, fill=color, font=f_center)
    except Exception:
        pass

    # Bottom-right corner (180° rotation of top-left)
    corner_h = pad + rank_size + sym_size + 4
    corner   = img.crop((0, 0, card_w // 2, corner_h))
    rotated  = corner.rotate(180)
    img.paste(rotated, (card_w - card_w // 2, card_h - corner_h))

    # Rounded corner mask
    if corner_radius > 0:
        mask = Image.new('L', (card_w, card_h), 0)
        md   = ImageDraw.Draw(mask)
        md.rounded_rectangle([0, 0, card_w-1, card_h-1],
                              radius=corner_radius, fill=255)
        img.putalpha(mask)

    return img


# ── Background generator ───────────────────────────────────────────────────────

def make_background(w: int, h: int) -> np.ndarray:
    """
    Generate a realistic casino-table-like background (BGR numpy array).
    Randomly chooses from: solid felt, gradient felt, or noisy felt.
    All backgrounds are dark-ish so white cards stand out.
    """
    base = random.choice(BACKGROUND_PRESETS)
    bg   = np.full((h, w, 3), base, dtype=np.uint8)

    style = random.choice(['solid', 'gradient', 'noise', 'vignette'])

    if style == 'gradient':
        # Darker in the corners, lighter in the centre
        for y in range(h):
            factor = 1.0 - 0.3 * abs(y / h - 0.5)
            bg[y] = np.clip(np.array(base) * factor, 0, 255).astype(np.uint8)

    elif style == 'vignette':
        # Darkens towards edges (common in casino photography)
        cx, cy = w // 2, h // 2
        Y, X   = np.ogrid[:h, :w]
        dist   = np.sqrt((X - cx)**2 + (Y - cy)**2)
        max_d  = np.sqrt(cx**2 + cy**2)
        mask   = 1.0 - 0.5 * (dist / max_d)
        for c in range(3):
            bg[:, :, c] = np.clip(bg[:, :, c] * mask, 0, 255).astype(np.uint8)

    # Always add felt texture noise
    noise = np.random.randint(-12, 12, bg.shape, dtype=np.int16)
    bg    = np.clip(bg.astype(np.int16) + noise, 0, 255).astype(np.uint8)

    return bg


# ── Augmentation helpers ───────────────────────────────────────────────────────

def apply_perspective(img_pil: Image.Image, strength: float = 0.06) -> Image.Image:
    """
    Apply a random perspective transform to simulate a card viewed at an angle.
    strength controls maximum corner displacement (fraction of image size).
    """
    arr = np.array(img_pil)
    h, w = arr.shape[:2]
    dx = int(w * strength)
    dy = int(h * strength)

    src = np.float32([[0, 0], [w, 0], [w, h], [0, h]])
    dst = np.float32([
        [random.randint(0, dx),      random.randint(0, dy)],
        [w - random.randint(0, dx),  random.randint(0, dy)],
        [w - random.randint(0, dx),  h - random.randint(0, dy)],
        [random.randint(0, dx),      h - random.randint(0, dy)],
    ])

    M       = cv2.getPerspectiveTransform(src, dst)
    warped  = cv2.warpPerspective(arr, M, (w, h),
                                  borderMode=cv2.BORDER_CONSTANT,
                                  borderValue=(255, 255, 255, 0))
    return Image.fromarray(warped)


def apply_rotation(img_pil: Image.Image, max_angle: float = 15.0) -> Image.Image:
    """Rotate card by a random angle (±max_angle degrees)."""
    angle = random.uniform(-max_angle, max_angle)
    return img_pil.rotate(angle, expand=False,
                          fillcolor=(255, 255, 255, 0),
                          resample=Image.BICUBIC)


def apply_shadow(scene: np.ndarray, x1: int, y1: int, x2: int, y2: int) -> np.ndarray:
    """Add a subtle drop shadow under a card region."""
    shadow_offset = random.randint(2, 6)
    shadow_blur   = random.randint(3, 8)
    sx1 = min(x1 + shadow_offset, scene.shape[1]-1)
    sy1 = min(y1 + shadow_offset, scene.shape[0]-1)
    sx2 = min(x2 + shadow_offset, scene.shape[1]-1)
    sy2 = min(y2 + shadow_offset, scene.shape[0]-1)
    overlay = scene.copy()
    cv2.rectangle(overlay, (sx1, sy1), (sx2, sy2), (0, 0, 0), -1)
    shadow_alpha = random.uniform(0.15, 0.35)
    scene = cv2.addWeighted(overlay, shadow_alpha, scene, 1 - shadow_alpha, 0)
    return scene


# ── Scene compositor ───────────────────────────────────────────────────────────

def compose_scene(scene_w: int = 640, scene_h: int = 480,
                  num_cards: int = None,
                  card_scale_min: float = 0.08,
                  card_scale_max: float = 0.28) -> tuple:
    """
    Compose a full scene with multiple playing cards on a table background.

    Returns:
        scene_bgr  (H, W, 3) numpy BGR array — the image to save
        labels     list of (class_id, cx, cy, w, h) in YOLO normalised format
    """
    if num_cards is None:
        # Realistic hand layouts: usually 2-5 cards visible
        num_cards = random.choices(
            [1, 2, 3, 4, 5, 6, 7],
            weights=[5, 25, 30, 20, 12, 5, 3]
        )[0]

    # Build background
    scene_rgb = make_background(scene_w, scene_h)
    scene_bgr = cv2.cvtColor(scene_rgb, cv2.COLOR_RGB2BGR)

    labels = []

    for _ in range(num_cards):
        rank = random.choice(RANKS)
        suit = random.choice(SUITS)
        name = f'{rank}_{suit}'
        cls  = CLASS_MAP[name]

        # Randomise card dimensions
        scale  = random.uniform(card_scale_min, card_scale_max)
        card_h = int(scene_h * scale * 1.5)
        card_w = int(card_h * 0.714)
        card_h = max(card_h, 30)
        card_w = max(card_w, 22)

        # Render the card
        card_pil = render_card(rank, suit, card_w=card_w, card_h=card_h)

        # Random augmentations
        if random.random() < 0.6:
            card_pil = apply_perspective(card_pil,
                                         strength=random.uniform(0.02, 0.08))
        if random.random() < 0.5:
            card_pil = apply_rotation(card_pil,
                                       max_angle=random.uniform(3, 20))

        # Get final card dimensions after transforms
        cw, ch = card_pil.size

        # Random position (allow slight out-of-frame for realism)
        margin = 5
        x1 = random.randint(-margin, max(0, scene_w - cw + margin))
        y1 = random.randint(-margin, max(0, scene_h - ch + margin))

        # Clamp visible region
        x1c = max(0, x1)
        y1c = max(0, y1)
        x2c = min(scene_w, x1 + cw)
        y2c = min(scene_h, y1 + ch)

        # Only label if at least 40% of the card is visible
        vis_area  = (x2c - x1c) * (y2c - y1c)
        full_area = cw * ch
        if vis_area < full_area * 0.40:
            continue

        # Drop shadow
        if random.random() < 0.6:
            scene_bgr = apply_shadow(scene_bgr, x1c, y1c, x2c, y2c)

        # Paste card onto scene
        card_bgr = cv2.cvtColor(np.array(card_pil.convert('RGBA')),
                                 cv2.COLOR_RGBA2BGRA)
        # Crop the card part that falls within the scene
        crop_x1 = x1c - x1
        crop_y1 = y1c - y1
        crop_x2 = crop_x1 + (x2c - x1c)
        crop_y2 = crop_y1 + (y2c - y1c)
        card_crop = card_bgr[crop_y1:crop_y2, crop_x1:crop_x2]

        # Alpha composite
        if card_crop.shape[2] == 4:
            alpha = card_crop[:, :, 3:4] / 255.0
            rgb   = card_crop[:, :, :3]
            roi   = scene_bgr[y1c:y2c, x1c:x2c]
            blended = (rgb * alpha + roi * (1 - alpha)).astype(np.uint8)
            scene_bgr[y1c:y2c, x1c:x2c] = blended
        else:
            scene_bgr[y1c:y2c, x1c:x2c] = card_crop[:, :, :3]

        # YOLO label: centre coords normalised to [0,1]
        cx = ((x1c + x2c) / 2) / scene_w
        cy = ((y1c + y2c) / 2) / scene_h
        nw = (x2c - x1c) / scene_w
        nh = (y2c - y1c) / scene_h
        labels.append((cls, cx, cy, nw, nh))

    # ── Scene-level augmentations ──────────────────────────────────────────────

    # Random brightness / contrast
    if random.random() < 0.5:
        alpha = random.uniform(0.7, 1.3)   # contrast
        beta  = random.randint(-25, 25)     # brightness
        scene_bgr = cv2.convertScaleAbs(scene_bgr, alpha=alpha, beta=beta)

    # Random Gaussian blur (simulates motion / out of focus)
    if random.random() < 0.3:
        ksize = random.choice([3, 5])
        scene_bgr = cv2.GaussianBlur(scene_bgr, (ksize, ksize), 0)

    # Random JPEG compression artefacts
    if random.random() < 0.4:
        quality = random.randint(60, 92)
        _, enc = cv2.imencode('.jpg', scene_bgr, [cv2.IMWRITE_JPEG_QUALITY, quality])
        scene_bgr = cv2.imdecode(enc, cv2.IMREAD_COLOR)

    # Random horizontal flip (cards look the same mirrored)
    if random.random() < 0.3:
        scene_bgr = cv2.flip(scene_bgr, 1)
        labels = [(c, 1.0 - cx, cy, w, h) for c, cx, cy, w, h in labels]

    return scene_bgr, labels


# ── Dataset writer ─────────────────────────────────────────────────────────────

def generate_dataset(output_dir: str = 'yolo/dataset',
                     total_images: int = 10000,
                     scene_w: int = 640,
                     scene_h: int = 480,
                     train_ratio: float = 0.80,
                     val_ratio:   float = 0.10):
    """
    Generate the full synthetic dataset and write it to disk.

    Args:
        output_dir      Root directory for the dataset
        total_images    Total number of scene images to generate
        scene_w/h       Dimensions of each scene image
        train_ratio     Fraction of images for training (default 80%)
        val_ratio       Fraction for validation (default 10%); rest = test
    """
    output_dir = Path(output_dir)

    # Create directory structure
    splits = ['train', 'val', 'test']
    for split in splits:
        (output_dir / 'images' / split).mkdir(parents=True, exist_ok=True)
        (output_dir / 'labels' / split).mkdir(parents=True, exist_ok=True)

    # Split counts
    n_train = int(total_images * train_ratio)
    n_val   = int(total_images * val_ratio)
    n_test  = total_images - n_train - n_val

    split_counts = {'train': n_train, 'val': n_val, 'test': n_test}

    print(f'\n{"="*60}')
    print(f'  SYNTHETIC CARD DATASET GENERATOR')
    print(f'{"="*60}')
    print(f'  Output:       {output_dir}')
    print(f'  Total images: {total_images:,}')
    print(f'  Train:        {n_train:,}  ({train_ratio*100:.0f}%)')
    print(f'  Val:          {n_val:,}  ({val_ratio*100:.0f}%)')
    print(f'  Test:         {n_test:,}  ({(1-train_ratio-val_ratio)*100:.0f}%)')
    print(f'  Classes:      {len(CLASS_NAMES)}  (all 52 cards)')
    print(f'  Resolution:   {scene_w}×{scene_h}')
    print()

    img_idx     = 0
    class_counts = {name: 0 for name in CLASS_NAMES}

    for split, count in split_counts.items():
        print(f'  Generating {split}: {count:,} images…')
        for i in range(count):
            scene, labels = compose_scene(scene_w=scene_w, scene_h=scene_h)

            fname = f'card_{img_idx:06d}'
            img_path = output_dir / 'images' / split / f'{fname}.jpg'
            lbl_path = output_dir / 'labels' / split / f'{fname}.txt'

            # Save image
            cv2.imwrite(str(img_path), scene,
                        [cv2.IMWRITE_JPEG_QUALITY, 95])

            # Save YOLO label file
            with open(lbl_path, 'w') as f:
                for cls, cx, cy, w, h in labels:
                    f.write(f'{cls} {cx:.6f} {cy:.6f} {w:.6f} {h:.6f}\n')
                    class_counts[CLASS_NAMES[cls]] += 1

            img_idx += 1

            # Progress update every 500 images
            if (i + 1) % 500 == 0 or (i + 1) == count:
                pct = (i + 1) / count * 100
                bar = '█' * int(pct / 5) + '░' * (20 - int(pct / 5))
                print(f'    [{bar}] {i+1:,}/{count:,}  ({pct:.0f}%)',
                      end='\r')
        print()

    # Write dataset.yaml — YOLO's config file
    yaml_content = f"""# BlackjackML Card Detection Dataset
# Generated by yolo/generate_dataset.py
# {total_images:,} synthetic scenes, 52 card classes

path: {output_dir.absolute()}
train: images/train
val:   images/val
test:  images/test

nc: {len(CLASS_NAMES)}

names:
"""
    for i, name in enumerate(CLASS_NAMES):
        yaml_content += f'  {i}: {name}\n'

    yaml_path = output_dir / 'dataset.yaml'
    with open(yaml_path, 'w') as f:
        f.write(yaml_content)

    # Write class stats
    stats = {
        'total_images':  total_images,
        'total_labels':  sum(class_counts.values()),
        'class_counts':  class_counts,
        'min_per_class': min(class_counts.values()),
        'max_per_class': max(class_counts.values()),
        'avg_per_class': sum(class_counts.values()) / len(class_counts),
    }
    with open(output_dir / 'stats.json', 'w') as f:
        json.dump(stats, f, indent=2)

    print(f'\n  ✅  Dataset complete!')
    print(f'  Total label instances: {stats["total_labels"]:,}')
    print(f'  Labels per class: '
          f'min={stats["min_per_class"]}  '
          f'max={stats["max_per_class"]}  '
          f'avg={stats["avg_per_class"]:.0f}')
    print(f'  Config file: {yaml_path}')
    print(f'\n  Next step:')
    print(f'    python yolo/train_yolo.py')
    print(f'{"="*60}\n')

    return str(yaml_path)


# ── CLI ────────────────────────────────────────────────────────────────────────

if __name__ == '__main__':
    parser = argparse.ArgumentParser(
        description='Generate synthetic playing card dataset for YOLO training'
    )
    parser.add_argument(
        '--images', type=int, default=10000,
        help='Total number of scene images to generate (default: 10000). '
             'More = better model but longer generation. '
             'Recommended: 10000 minimum, 25000 for best accuracy.'
    )
    parser.add_argument(
        '--output', type=str, default='yolo/dataset',
        help='Output directory for the dataset (default: yolo/dataset)'
    )
    parser.add_argument(
        '--width', type=int, default=640,
        help='Width of each scene image in pixels (default: 640)'
    )
    parser.add_argument(
        '--height', type=int, default=480,
        help='Height of each scene image in pixels (default: 480)'
    )
    parser.add_argument(
        '--seed', type=int, default=42,
        help='Random seed for reproducibility (default: 42)'
    )
    args = parser.parse_args()

    random.seed(args.seed)
    np.random.seed(args.seed)

    generate_dataset(
        output_dir   = args.output,
        total_images = args.images,
        scene_w      = args.width,
        scene_h      = args.height,
    )
"""
app/cv_detector.py — Computer Vision Card Detector
═══════════════════════════════════════════════════
Detects playing cards from a screenshot or camera frame.

PIPELINE:
  1. Find card regions   — white rectangles via contour detection
  2. Read rank           — OCR on top-left corner, with noise cleanup
  3. Classify suit       — color (red/black) + shape analysis of suit symbol
  4. Return results      — [{rank, suit, confidence, bbox}]

CALLED BY:
  app/server.py  POST /api/detect_cards
  Receives a base64-encoded JPEG, returns JSON list of detected cards.

ACCURACY NOTES:
  • Works best on clean screenshots of online casino software
  • Physical camera: ensure good lighting, card face clearly visible
  • Cards overlapping heavily may be missed
  • Suit shape analysis is heuristic — hearts/diamonds and clubs/spades
    are most commonly confused when the symbol is tiny or blurry.
    The UI always lets the user correct any wrong detection before applying.

REQUIREMENTS (already in requirements.txt):
  opencv-python, numpy, Pillow, pytesseract
  System: tesseract-ocr  (sudo apt install tesseract-ocr)
"""

import base64
import io
import re
import logging
from typing import Dict, List, Optional, Tuple

import cv2
import numpy as np

log = logging.getLogger(__name__)


# ── Constants ──────────────────────────────────────────────────────────────────

VALID_RANKS = {'A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'}

# Minimum card area and aspect ratio bounds (height/width)
CARD_MIN_AREA   = 1500
CARD_MAX_AREA   = 200_000
CARD_ASPECT_MIN = 1.05
CARD_ASPECT_MAX = 2.20

# OCR scale factor — larger = more accurate but slower
OCR_SCALE = 6

# Red-pixel threshold to call a card "red-suited"
RED_PIXEL_THRESHOLD = 6


# ── Public API ─────────────────────────────────────────────────────────────────

def detect_from_base64(b64_data: str) -> List[Dict]:
    """
    Main entry point called by server.py.

    Args:
        b64_data: base64-encoded JPEG/PNG image string
                  (may include a data-URI prefix: "data:image/jpeg;base64,...")

    Returns:
        List of dicts, each:
          {
            rank:       str   — 'A','2'…'10','J','Q','K'
            suit:       str   — 'hearts','diamonds','clubs','spades'
            confidence: float — 0.0–1.0
            bbox:       [x, y, w, h]  pixels in original image
          }
        Empty list on any error.
    """
    try:
        # Strip data-URI prefix if present
        if ',' in b64_data:
            b64_data = b64_data.split(',', 1)[1]

        img_bytes = base64.b64decode(b64_data)
        arr = np.frombuffer(img_bytes, dtype=np.uint8)
        frame = cv2.imdecode(arr, cv2.IMREAD_COLOR)

        if frame is None:
            log.warning('[CV] Could not decode image')
            return []

        return detect_cards(frame)

    except Exception as exc:
        log.error(f'[CV] detect_from_base64 failed: {exc}')
        return []


def detect_cards(frame: np.ndarray) -> List[Dict]:
    """
    Run the full detection pipeline on a BGR numpy image.
    Returns the same list format as detect_from_base64.
    """
    card_rois = _find_card_regions(frame)
    results   = []

    for (x, y, w, h) in card_rois:
        card_bgr = frame[y:y + h, x:x + w]
        rank, suit, conf = _read_card(card_bgr)
        if rank:
            results.append({
                'rank':       rank,
                'suit':       suit,
                'confidence': round(conf, 3),
                'bbox':       [int(x), int(y), int(w), int(h)],
            })

    # Sort left-to-right so player cards come before dealer cards naturally
    results.sort(key=lambda c: c['bbox'][0])
    return results


# ── Step 1: Find card regions ──────────────────────────────────────────────────

def _find_card_regions(frame: np.ndarray) -> List[Tuple[int, int, int, int]]:
    """
    Locate white (or near-white) card-shaped rectangles in the frame.
    Returns list of (x, y, w, h) bounding boxes.
    """
    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)

    # Threshold: keep anything brighter than 185 (card faces)
    _, thresh = cv2.threshold(gray, 185, 255, cv2.THRESH_BINARY)

    # Mild morphological close to bridge tiny gaps in card borders
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (3, 3))
    thresh = cv2.morphologyEx(thresh, cv2.MORPH_CLOSE, kernel)

    contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    regions = []
    for cnt in contours:
        x, y, w, h = cv2.boundingRect(cnt)
        area   = w * h
        aspect = h / w if w > 0 else 0

        if (CARD_MIN_AREA < area < CARD_MAX_AREA
                and CARD_ASPECT_MIN < aspect < CARD_ASPECT_MAX):
            regions.append((x, y, w, h))

    # Deduplicate heavily overlapping regions
    regions = _deduplicate_regions(regions)
    return regions


def _deduplicate_regions(regions, iou_thresh=0.5):
    """Remove duplicate/overlapping card regions by IoU."""
    if not regions:
        return []
    kept = []
    for (x1, y1, w1, h1) in regions:
        dominated = False
        for (x2, y2, w2, h2) in kept:
            # Intersection
            ix = max(0, min(x1+w1, x2+w2) - max(x1, x2))
            iy = max(0, min(y1+h1, y2+h2) - max(y1, y2))
            inter = ix * iy
            union = w1*h1 + w2*h2 - inter
            if union > 0 and inter / union > iou_thresh:
                dominated = True
                break
        if not dominated:
            kept.append((x1, y1, w1, h1))
    return kept


# ── Step 2 + 3: Read rank and suit from one card ROI ──────────────────────────

def _read_card(card_bgr: np.ndarray) -> Tuple[Optional[str], str, float]:
    """
    Given a tightly-cropped card image (BGR), return (rank, suit, confidence).
    Returns (None, 'spades', 0.0) if rank cannot be determined.
    """
    h, w = card_bgr.shape[:2]
    if h < 20 or w < 15:
        return None, 'spades', 0.0

    # Corner region: top-left ~45% width × ~42% height
    ch  = max(int(h * 0.42), 18)
    cw  = max(int(w * 0.50), 15)
    # Skip the outer 2 px border
    corner = card_bgr[2:ch, 2:cw]

    if corner.size == 0:
        return None, 'spades', 0.0

    # ── Color detection (red vs black) ────────────────────────────────────
    is_red = _is_red_card(corner)

    # ── Rank OCR ──────────────────────────────────────────────────────────
    rank, rank_conf = _ocr_rank(corner)

    # ── Suit shape classification ──────────────────────────────────────────
    # Suit symbol lives just below the rank (~25-45% of corner height)
    suit_top = max(int(ch * 0.40), 10)
    suit_roi = card_bgr[suit_top:ch, 2:cw] if suit_top < ch else corner
    suit = _classify_suit(suit_roi, is_red)

    return rank, suit, rank_conf


# ── Color detection ────────────────────────────────────────────────────────────

def _is_red_card(corner_bgr: np.ndarray) -> bool:
    """True if the card corner contains red pixels (hearts or diamonds)."""
    hsv = cv2.cvtColor(corner_bgr, cv2.COLOR_BGR2HSV)
    # Red wraps in HSV: hue 0-15 and 155-180
    mask1 = cv2.inRange(hsv, np.array([0,   60,  60]),  np.array([15,  255, 255]))
    mask2 = cv2.inRange(hsv, np.array([155, 60,  60]),  np.array([180, 255, 255]))
    red_pixels = cv2.countNonZero(mask1 | mask2)
    return red_pixels >= RED_PIXEL_THRESHOLD


# ── Rank OCR ───────────────────────────────────────────────────────────────────

def _ocr_rank(corner_bgr: np.ndarray) -> Tuple[Optional[str], float]:
    """
    Run Tesseract on the corner crop to extract the rank character(s).
    Returns (rank_str, confidence) or (None, 0.0).
    """
    try:
        import pytesseract

        gray = cv2.cvtColor(corner_bgr, cv2.COLOR_BGR2GRAY)

        # Invert: dark text on white card → white text on black (tesseract prefers this)
        _, inv = cv2.threshold(gray, 170, 255, cv2.THRESH_BINARY_INV)

        # Scale up — tesseract accuracy drops significantly below ~30px char height
        big = cv2.resize(inv, None, fx=OCR_SCALE, fy=OCR_SCALE,
                         interpolation=cv2.INTER_CUBIC)
        # Add padding so tesseract doesn't clip border characters
        big = cv2.copyMakeBorder(big, 15, 15, 15, 15,
                                 cv2.BORDER_CONSTANT, value=0)

        raw = pytesseract.image_to_string(
            big,
            config='--psm 6 --oem 3 '
                   '-c tessedit_char_whitelist=AaKkQqJj23456789T10'
        )
        rank = _clean_rank(raw)
        if rank:
            return rank, 0.88
        return None, 0.0

    except Exception as exc:
        log.debug(f'[CV] OCR error: {exc}')
        return None, 0.0


def _clean_rank(raw: str) -> Optional[str]:
    """
    Normalise raw OCR output to a valid blackjack rank string.
    Handles common mistakes: lowercase, noise chars, '1O' vs '10', 'T' vs '10'.
    """
    if not raw:
        return None

    s = raw.upper().replace('\n', ' ').replace('\r', '').strip()
    s = re.sub(r'[^AKQJakqj0-9T ]', '', s).strip()

    for token in s.split():
        t = token.strip()
        # Direct valid matches
        if t in VALID_RANKS:
            return t
        # 'T' → '10'
        if t == 'T':
            return '10'
        # Single face card letter
        if len(t) == 1 and t in 'AKQJ':
            return t
        # Single digit
        if len(t) == 1 and t in '23456789':
            return t
        # First char is letter
        if len(t) >= 1 and t[0] in 'AKQJ':
            return t[0]
        # First char is digit
        if len(t) >= 1 and t[0] in '23456789':
            return t[0]
        # '10': starts with '1' followed by '0' or 'O'
        if len(t) >= 2 and t[0] == '1' and t[1] in '0O':
            return '10'

    return None


# ── Suit classification ────────────────────────────────────────────────────────

def _classify_suit(suit_roi_bgr: np.ndarray, is_red: bool) -> str:
    """
    Classify suit using shape analysis of the suit symbol.

    Color splits red/black into two groups:
      Red  → hearts or diamonds
      Black → spades or clubs

    Then shape heuristics distinguish within each group:
      Hearts:   wider aspect, moderate solidity, rounded
      Diamonds: aspect ~1:1, very high solidity (nearly convex)
      Spades:   taller aspect, moderate solidity (has stem notch)
      Clubs:    wider aspect, lower solidity (3 round lobes)
    """
    if suit_roi_bgr is None or suit_roi_bgr.size == 0:
        return 'hearts' if is_red else 'spades'

    gray = cv2.cvtColor(suit_roi_bgr, cv2.COLOR_BGR2GRAY) \
           if len(suit_roi_bgr.shape) == 3 else suit_roi_bgr

    _, thresh = cv2.threshold(gray, 140, 255, cv2.THRESH_BINARY_INV)

    contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if not contours:
        return 'hearts' if is_red else 'spades'

    cnt      = max(contours, key=cv2.contourArea)
    area     = cv2.contourArea(cnt)
    if area < 5:
        return 'hearts' if is_red else 'spades'

    bx, by, bw, bh = cv2.boundingRect(cnt)
    aspect    = bw / bh if bh > 0 else 1.0           # >1 = wider, <1 = taller

    hull      = cv2.convexHull(cnt)
    hull_area = cv2.contourArea(hull)
    solidity  = area / hull_area if hull_area > 0 else 1.0

    perim        = cv2.arcLength(cnt, True)
    circularity  = (4 * np.pi * area / (perim ** 2)) if perim > 0 else 0

    if is_red:
        # Diamonds are angular (low circularity) and nearly convex (high solidity)
        # Hearts are rounder and slightly concave at the top cleft
        if solidity > 0.90 and circularity < 0.70:
            return 'diamonds'
        else:
            return 'hearts'
    else:
        # Spades taper to a point at top → taller aspect, pointed shape
        # Clubs have 3 circular lobes → wider, lower solidity
        if aspect < 0.95 and solidity > 0.72:
            return 'spades'
        else:
            return 'clubs'


# ── Debug helper ───────────────────────────────────────────────────────────────

def annotate_frame(frame: np.ndarray, detections: List[Dict]) -> np.ndarray:
    """
    Draw bounding boxes and labels onto the frame for debug visualisation.
    Returns an annotated copy of the frame.
    """
    out = frame.copy()
    for d in detections:
        x, y, w, h = d['bbox']
        conf  = d['confidence']
        label = f"{d['rank']}{d['suit'][0].upper()} {conf:.0%}"
        color = (0, 200, 80) if conf >= 0.8 else (0, 160, 255)
        cv2.rectangle(out, (x, y), (x + w, y + h), color, 2)
        cv2.putText(out, label, (x, y - 6),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.55, color, 1, cv2.LINE_AA)
    return out
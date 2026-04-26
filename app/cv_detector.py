"""
app/cv_detector.py — Computer Vision Card Detector
═══════════════════════════════════════════════════
TWO BACKENDS (auto-selected):
  YOLO  — models/card_detector.pt (train: python yolo/train_yolo.py)
  OCR   — fallback when no YOLO model found (requires tesseract)
"""

import base64
import logging
import os
import re
import threading as _threading
from typing import Dict, List, Optional, Tuple

import cv2
import numpy as np

log = logging.getLogger(__name__)

_ROOT      = os.path.join(os.path.dirname(__file__), '..')
YOLO_PATH  = os.path.join(_ROOT, 'models', 'card_detector.pt')

RANKS      = ['A','2','3','4','5','6','7','8','9','10','J','Q','K']
SUITS      = ['spades','hearts','diamonds','clubs']
CLASS_NAMES= [f'{r}_{s}' for r in RANKS for s in SUITS]

VALID_RANKS       = set(RANKS)
CARD_MIN_AREA     = 1500
CARD_MAX_AREA     = 200_000
CARD_ASPECT_MIN   = 1.05
CARD_ASPECT_MAX   = 2.20
OCR_SCALE         = 6
RED_PIXEL_THRESH  = 6
YOLO_CONF         = 0.30

_yolo_model = None
_yolo_init  = False
_yolo_lock  = _threading.Lock()  # GAP-04: prevent double-init race

def _load_yolo() -> bool:
    """Thread-safe lazy YOLO loader (GAP-04).

    Two concurrent detect_from_base64() calls used to both pass the
    `_yolo_init=False` check and each allocate a model (~25MB leak).
    The lock collapses concurrent loads to a single allocation.
    """
    global _yolo_model, _yolo_init
    # Fast-path: avoid acquiring the lock once initialisation is finalised.
    if _yolo_init:
        return _yolo_model is not None
    with _yolo_lock:
        # Re-check inside the lock (another thread may have completed init).
        if _yolo_init:
            return _yolo_model is not None
        if not os.path.exists(YOLO_PATH):
            log.info(f'[CV] YOLO not found at {YOLO_PATH} — using OCR fallback')
            _yolo_init = True
            return False
        try:
            from ultralytics import YOLO
            _yolo_model = YOLO(YOLO_PATH)
            _yolo_model.fuse()
            log.info('[CV] YOLO card detector loaded')
            _yolo_init = True
            return True
        except Exception as e:
            log.error(f'[CV] YOLO load failed: {e}')
            _yolo_model = None
            _yolo_init = True
            return False

def _detect_yolo(frame):
    results = _yolo_model(frame, conf=YOLO_CONF, verbose=False, iou=0.45)
    out = []
    for r in results:
        if r.boxes is None: continue
        for box in r.boxes:
            cls_id = int(box.cls[0])
            conf   = float(box.conf[0])
            if cls_id >= len(CLASS_NAMES): continue
            rank, suit = CLASS_NAMES[cls_id].split('_', 1)
            x1,y1,x2,y2 = map(int, box.xyxy[0].tolist())
            out.append({'rank':rank,'suit':suit,'confidence':round(conf,3),
                        'bbox':[x1,y1,x2-x1,y2-y1],'backend':'yolo'})
    out.sort(key=lambda d: d['bbox'][0])
    return out

def _find_card_regions(frame):
    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    _,thresh = cv2.threshold(gray, 185, 255, cv2.THRESH_BINARY)
    k = cv2.getStructuringElement(cv2.MORPH_RECT,(3,3))
    thresh = cv2.morphologyEx(thresh, cv2.MORPH_CLOSE, k)
    contours,_ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    regions = []
    for cnt in contours:
        x,y,w,h = cv2.boundingRect(cnt)
        area = w*h; asp = h/w if w>0 else 0
        if CARD_MIN_AREA < area < CARD_MAX_AREA and CARD_ASPECT_MIN < asp < CARD_ASPECT_MAX:
            regions.append((x,y,w,h))
    kept = []
    for (x1,y1,w1,h1) in regions:
        dom = False
        for (x2,y2,w2,h2) in kept:
            ix=max(0,min(x1+w1,x2+w2)-max(x1,x2)); iy=max(0,min(y1+h1,y2+h2)-max(y1,y2))
            inter=ix*iy; union=w1*h1+w2*h2-inter
            if union>0 and inter/union>0.5: dom=True; break
        if not dom: kept.append((x1,y1,w1,h1))
    return kept

def _is_red(corner):
    hsv=cv2.cvtColor(corner,cv2.COLOR_BGR2HSV)
    m1=cv2.inRange(hsv,np.array([0,60,60]),np.array([15,255,255]))
    m2=cv2.inRange(hsv,np.array([155,60,60]),np.array([180,255,255]))
    return cv2.countNonZero(m1|m2) >= RED_PIXEL_THRESH

def _ocr_rank(corner):
    try:
        import pytesseract
        gray=cv2.cvtColor(corner,cv2.COLOR_BGR2GRAY)
        _,inv=cv2.threshold(gray,170,255,cv2.THRESH_BINARY_INV)
        big=cv2.resize(inv,None,fx=OCR_SCALE,fy=OCR_SCALE,interpolation=cv2.INTER_CUBIC)
        big=cv2.copyMakeBorder(big,15,15,15,15,cv2.BORDER_CONSTANT,value=0)
        raw=pytesseract.image_to_string(big,config='--psm 6 --oem 3 -c tessedit_char_whitelist=AaKkQqJj23456789T10')
        s=raw.upper().replace('\n',' ').strip()
        s=re.sub(r'[^AKQJakqj0-9T ]','',s).strip()
        for t in s.split():
            if t in VALID_RANKS: return t,0.75
            if t=='T': return '10',0.75
            if len(t)==1 and t in 'AKQJ23456789': return t,0.75
            if len(t)>=1 and t[0] in 'AKQJ': return t[0],0.65
            if len(t)>=1 and t[0] in '23456789': return t[0],0.65
            if len(t)>=2 and t[0]=='1' and t[1] in '0O': return '10',0.70
        return None,0.0
    except Exception as e:
        log.warning(f'[CV] OCR rank detection failed: {e}')
        return None,0.0

def _suit(roi, is_red):
    if roi is None or roi.size==0: return 'hearts' if is_red else 'spades'
    gray=cv2.cvtColor(roi,cv2.COLOR_BGR2GRAY) if len(roi.shape)==3 else roi
    _,th=cv2.threshold(gray,140,255,cv2.THRESH_BINARY_INV)
    cnts,_=cv2.findContours(th,cv2.RETR_EXTERNAL,cv2.CHAIN_APPROX_SIMPLE)
    if not cnts: return 'hearts' if is_red else 'spades'
    cnt=max(cnts,key=cv2.contourArea); area=cv2.contourArea(cnt)
    if area<5: return 'hearts' if is_red else 'spades'
    _,_,bw,bh=cv2.boundingRect(cnt); asp=bw/bh if bh>0 else 1
    hull=cv2.convexHull(cnt); ha=cv2.contourArea(hull)
    sol=area/ha if ha>0 else 1
    if is_red: return 'diamonds' if (sol>0.90 and (4*3.14159*area/(cv2.arcLength(cnt,True)**2+1e-9))<0.70) else 'hearts'
    return 'spades' if (asp<0.95 and sol>0.72) else 'clubs'

def _detect_ocr(frame):
    out=[]
    for (x,y,w,h) in _find_card_regions(frame):
        card=frame[y:y+h,x:x+w]
        ch=max(int(h*0.42),18); cw=max(int(w*0.50),15)
        corner=card[2:ch,2:cw]
        if corner.size==0: continue
        red=_is_red(corner)
        rank,conf=_ocr_rank(corner)
        if not rank: continue
        st=max(int(ch*0.40),10)
        suit_roi=card[st:ch,2:cw] if st<ch else corner
        suit=_suit(suit_roi,red)
        out.append({'rank':rank,'suit':suit,'confidence':round(conf,3),
                    'bbox':[int(x),int(y),int(w),int(h)],'backend':'ocr'})
    out.sort(key=lambda d:d['bbox'][0])
    return out

def detect_cards(frame: np.ndarray) -> List[Dict]:
    """Detect cards in a BGR numpy frame. Uses YOLO if available, else OCR."""
    if _load_yolo():
        try: return _detect_yolo(frame)
        except Exception as e: log.error(f'[CV] YOLO failed: {e} — using OCR')
    return _detect_ocr(frame)

def detect_from_base64(b64: str) -> List[Dict]:
    """Detect cards from a base64-encoded JPEG/PNG string."""
    try:
        if ',' in b64: b64=b64.split(',',1)[1]
        arr=np.frombuffer(base64.b64decode(b64),dtype=np.uint8)
        frame=cv2.imdecode(arr,cv2.IMREAD_COLOR)
        if frame is None: return []
        return detect_cards(frame)
    except Exception as e:
        log.error(f'[CV] decode error: {e}')
        return []

def get_backend() -> str:
    return 'yolo' if (_yolo_init and _yolo_model is not None) else 'ocr'

def annotate_frame(frame: np.ndarray, detections: List[Dict]) -> np.ndarray:
    out=frame.copy()
    for d in detections:
        x,y,w,h=d['bbox']; conf=d['confidence']
        col=(0,200,80) if conf>=0.80 else (0,200,255) if conf>=0.50 else (0,60,255)
        cv2.rectangle(out,(x,y),(x+w,y+h),col,2)
        cv2.putText(out,f'{d["rank"]}{d["suit"][0].upper()} {conf:.0%}',(x,y-6),
                    cv2.FONT_HERSHEY_SIMPLEX,0.55,col,1,cv2.LINE_AA)
    return out
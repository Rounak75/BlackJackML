"""
yolo/train_yolo.py — YOLOv8 Training Script for Card Detection
═══════════════════════════════════════════════════════════════════════════════

WHAT THIS DOES:
    Trains a YOLOv8 model to detect and classify all 52 playing cards in a
    single forward pass. The trained model replaces the OpenCV + Tesseract
    pipeline with something far more accurate, especially for small cards.

WHY YOLOv8?
    • State-of-the-art speed + accuracy trade-off
    • Handles overlapping cards, small cards, partial cards
    • Single forward pass: detects location AND rank+suit simultaneously
    • Works in real time (30+ FPS) on a laptop CPU, 100+ FPS on GPU
    • Much better than Tesseract on small or stylised card fonts

MODELS AVAILABLE (choose with --model):
    yolov8n  → nano   — fastest, least accurate (~3MB)
    yolov8s  → small  — good balance (~11MB)        ← default
    yolov8m  → medium — better accuracy (~25MB)
    yolov8l  → large  — high accuracy (~43MB)
    yolov8x  → extra  — maximum accuracy (~68MB)

    For card detection at 640px: yolov8s is usually the best trade-off.
    If you have a GPU: use yolov8m or yolov8l for better accuracy.

HOW TO RUN:
    # Step 1: Generate the dataset (if not already done)
    python yolo/generate_dataset.py --images 10000

    # Step 2: Train
    python yolo/train_yolo.py

    # Step 3: The trained model is saved to:
    yolo/runs/card_detector/weights/best.pt

    # Then the dashboard will automatically use it.

REQUIREMENTS:
    pip install ultralytics>=8.0.0
    (This installs YOLOv8 and all its dependencies including PyTorch)
"""

import argparse
import os
import shutil
import sys
import time
from pathlib import Path


# ── Check ultralytics is installed ─────────────────────────────────────────────
try:
    from ultralytics import YOLO
    import ultralytics
    YOLO_VERSION = ultralytics.__version__
except ImportError:
    print('\n❌  ultralytics not installed.')
    print('    Run:  pip install ultralytics')
    print('    Then re-run this script.\n')
    sys.exit(1)


# ── Constants ──────────────────────────────────────────────────────────────────

DATASET_YAML   = Path('yolo/dataset/dataset.yaml')   # created by generate_dataset.py
RUNS_DIR       = Path('yolo/runs')                    # where YOLO saves training runs
OUTPUT_WEIGHTS = Path('yolo/best_card_model.pt')      # final model copied here
FINAL_PATH     = Path('models/card_detector.pt')      # where cv_detector.py looks


def check_dataset():
    """Make sure the dataset was generated before training."""
    if not DATASET_YAML.exists():
        print(f'\n❌  Dataset not found at: {DATASET_YAML}')
        print('    Generate it first:')
        print('      python yolo/generate_dataset.py --images 10000\n')
        sys.exit(1)

    # Count images in each split
    dataset_dir = DATASET_YAML.parent
    for split in ['train', 'val', 'test']:
        img_dir = dataset_dir / 'images' / split
        n = len(list(img_dir.glob('*.jpg'))) if img_dir.exists() else 0
        if n == 0 and split == 'train':
            print(f'\n❌  No training images found in {img_dir}')
            print('    Re-run: python yolo/generate_dataset.py\n')
            sys.exit(1)
        print(f'  {split:5}: {n:,} images')


def train(
    model_size:   str   = 'yolov8s',
    epochs:       int   = 100,
    batch_size:   int   = 16,
    img_size:     int   = 640,
    patience:     int   = 20,
    workers:      int   = 4,
    device:       str   = None,   # None = auto-detect GPU
    resume:       bool  = False,
    augment:      bool  = True,
):
    """
    Train YOLOv8 on the synthetic card dataset.

    Args:
        model_size   YOLOv8 model variant: 'yolov8n/s/m/l/x'
        epochs       Maximum training epochs (early stopping via patience)
        batch_size   Images per gradient update (reduce if out of VRAM)
        img_size     Input resolution (640 = standard YOLO)
        patience     Stop if mAP doesn't improve for this many epochs
        workers      DataLoader worker threads (reduce to 0 on Windows if errors)
        device       'cpu', '0' (first GPU), '0,1' (multi-GPU), or None (auto)
        resume       Resume from last checkpoint if True
        augment      Use extra augmentations during training
    """
    print(f'\n{"="*60}')
    print(f'  YOLO CARD DETECTOR TRAINING')
    print(f'{"="*60}')
    print(f'  Model:        {model_size}')
    print(f'  Epochs:       {epochs}  (early stop after {patience} no-improve)')
    print(f'  Batch size:   {batch_size}')
    print(f'  Image size:   {img_size}×{img_size}')
    print(f'  Dataset:      {DATASET_YAML}')
    print(f'  ultralytics:  v{YOLO_VERSION}')

    # Auto-detect device
    if device is None:
        try:
            import torch
            device = '0' if torch.cuda.is_available() else 'cpu'
        except ImportError:
            device = 'cpu'
    print(f'  Device:       {device}  {"(GPU — fast! ✅)" if device != "cpu" else "(CPU — consider GPU for faster training)"}')
    print()

    # ── Check dataset ─────────────────────────────────────────────────────────
    print('  Dataset:')
    check_dataset()
    print()

    # ── Load model ────────────────────────────────────────────────────────────
    # If resuming, load from last checkpoint. Otherwise load pretrained weights.
    # Pretrained weights = ImageNet features that transfer well to any visual task.
    # They give MUCH better accuracy than training from random weights.

    if resume:
        last_ckpt = RUNS_DIR / 'card_detector' / 'weights' / 'last.pt'
        if last_ckpt.exists():
            print(f'  Resuming from: {last_ckpt}')
            model = YOLO(str(last_ckpt))
        else:
            print(f'  No checkpoint found at {last_ckpt} — starting fresh')
            model = YOLO(f'{model_size}.pt')
    else:
        # Download pretrained weights automatically (cached after first download)
        print(f'  Loading pretrained weights: {model_size}.pt')
        model = YOLO(f'{model_size}.pt')

    # ── Windows pin_memory fix ────────────────────────────────────────────────
    # On Windows with tight VRAM, pin_memory causes "CUDA error: resource
    # already mapped" crashes during validation data loading.  Disable it
    # by monkey-patching DataLoader before training starts.
    if sys.platform == 'win32' and device != 'cpu':
        workers = 0
        import torch.utils.data as _tud
        _OrigDL = _tud.DataLoader
        class _SafeDataLoader(_OrigDL):
            def __init__(self, *args, **kwargs):
                kwargs.setdefault('pin_memory', False)
                super().__init__(*args, **kwargs)
        _tud.DataLoader = _SafeDataLoader
        print(f'  ⚙️  Windows GPU mode: workers=0, pin_memory disabled')

    # ── Train ─────────────────────────────────────────────────────────────────
    print(f'\n  Starting training…\n')
    start = time.time()

    results = model.train(
        data        = str(DATASET_YAML),
        epochs      = epochs,
        batch       = batch_size,
        imgsz       = img_size,
        patience    = patience,       # early stopping
        workers     = workers,
        device      = device,
        project     = str(RUNS_DIR),
        name        = 'card_detector',
        exist_ok    = True,           # overwrite previous run
        resume      = resume,
        verbose     = True,
        save        = True,
        save_period = 10,             # save checkpoint every 10 epochs

        # ── Augmentation settings ─────────────────────────────────────────────
        # These are applied on top of our dataset's built-in augmentations.
        # Together they make the model robust to real-world variation.
        augment     = augment,
        hsv_h       = 0.015,          # hue jitter (subtle colour shift)
        hsv_s       = 0.5,            # saturation jitter (lighting conditions)
        hsv_v       = 0.4,            # brightness jitter (dim/bright rooms)
        degrees     = 10.0,           # random rotation ±10°
        translate   = 0.1,            # random translation ±10%
        scale       = 0.5,            # random zoom 50–150%
        shear       = 5.0,            # random shear ±5°
        perspective = 0.0005,         # random perspective warp
        flipud      = 0.0,            # no vertical flip (cards aren't upside down… usually)
        fliplr      = 0.5,            # horizontal flip (cards look same mirrored)
        mosaic      = 0.8,            # mosaic augmentation (tiles 4 images together)
        mixup       = 0.1,            # mixup augmentation (blends two images)
        copy_paste  = 0.0,            # copy-paste augmentation (disabled)
    )

    elapsed = time.time() - start
    elapsed_str = f'{elapsed/3600:.1f}h' if elapsed > 3600 else f'{elapsed/60:.1f}min'

    # ── Copy best weights to standard location ────────────────────────────────
    best_weights = RUNS_DIR / 'card_detector' / 'weights' / 'best.pt'

    if best_weights.exists():
        # Copy to yolo/best_card_model.pt
        shutil.copy2(best_weights, OUTPUT_WEIGHTS)

        # Also copy to models/ where cv_detector.py looks
        Path('models').mkdir(exist_ok=True)
        shutil.copy2(best_weights, FINAL_PATH)

        print(f'\n{"="*60}')
        print(f'  ✅  Training complete in {elapsed_str}')
        print(f'  Best weights saved to:')
        print(f'    {OUTPUT_WEIGHTS}')
        print(f'    {FINAL_PATH}  ← used by dashboard automatically')
        print()

        # Print final metrics
        try:
            metrics = results.results_dict
            map50   = metrics.get('metrics/mAP50(B)',   0)
            map5095 = metrics.get('metrics/mAP50-95(B)', 0)
            prec    = metrics.get('metrics/precision(B)', 0)
            rec     = metrics.get('metrics/recall(B)',    0)
            print(f'  Final metrics:')
            print(f'    mAP@50:    {map50:.3f}  (>0.90 = excellent)')
            print(f'    mAP@50-95: {map5095:.3f}  (>0.75 = excellent)')
            print(f'    Precision: {prec:.3f}')
            print(f'    Recall:    {rec:.3f}')
        except Exception:
            pass

        print(f'\n  Next step:')
        print(f'    python main.py web')
        print(f'    The dashboard will automatically use the YOLO model.')
        print(f'{"="*60}\n')
    else:
        print(f'\n⚠️   Training finished but best.pt not found at {best_weights}')
        print(f'    Check the runs directory: {RUNS_DIR}')


def evaluate(model_path: str = None):
    """
    Evaluate a trained model on the test set.
    Prints per-class mAP so you can see which cards are hardest to detect.
    """
    if model_path is None:
        model_path = str(FINAL_PATH) if FINAL_PATH.exists() else str(OUTPUT_WEIGHTS)

    if not Path(model_path).exists():
        print(f'❌  Model not found: {model_path}')
        print('    Train first: python yolo/train_yolo.py')
        return

    print(f'\nEvaluating: {model_path}')
    model   = YOLO(model_path)
    metrics = model.val(data=str(DATASET_YAML), split='test', verbose=True)

    print(f'\nTest set results:')
    print(f'  mAP@50:    {metrics.box.map50:.4f}')
    print(f'  mAP@50-95: {metrics.box.map:.4f}')


def quick_test(model_path: str = None, image_path: str = None):
    """
    Quick test: run the model on a single image and print detected cards.
    """
    if model_path is None:
        model_path = str(FINAL_PATH) if FINAL_PATH.exists() else str(OUTPUT_WEIGHTS)

    if not Path(model_path).exists():
        print('❌  No trained model found. Train first: python yolo/train_yolo.py')
        return

    model = YOLO(model_path)

    if image_path and Path(image_path).exists():
        results = model(image_path, conf=0.25)
    else:
        # Generate a test scene
        sys.path.insert(0, '.')
        from yolo.generate_dataset import compose_scene
        import cv2, tempfile
        scene, _ = compose_scene()
        with tempfile.NamedTemporaryFile(suffix='.jpg', delete=False) as f:
            cv2.imwrite(f.name, scene)
            results = model(f.name, conf=0.25)
            image_path = f.name

    print(f'\nDetected cards in {image_path}:')
    from yolo.generate_dataset import CLASS_NAMES
    for r in results:
        boxes = r.boxes
        if boxes is None or len(boxes) == 0:
            print('  No cards detected')
            continue
        for box in boxes:
            cls_id = int(box.cls[0])
            conf   = float(box.conf[0])
            name   = CLASS_NAMES[cls_id] if cls_id < len(CLASS_NAMES) else f'class_{cls_id}'
            rank, suit = name.split('_')
            print(f'  {rank:>2} of {suit:<8}  confidence={conf:.0%}')


# ── CLI ────────────────────────────────────────────────────────────────────────

if __name__ == '__main__':
    parser = argparse.ArgumentParser(
        description='Train YOLOv8 card detector'
    )
    parser.add_argument(
        '--model', default='yolov8s',
        choices=['yolov8n', 'yolov8s', 'yolov8m', 'yolov8l', 'yolov8x'],
        help='YOLOv8 model size (default: yolov8s). '
             'n=fastest/smallest, x=slowest/most accurate.'
    )
    parser.add_argument(
        '--epochs', type=int, default=100,
        help='Maximum training epochs (default: 100). '
             'Early stopping kicks in after --patience epochs without improvement.'
    )
    parser.add_argument(
        '--batch', type=int, default=16,
        help='Batch size (default: 16). Reduce to 8 if you run out of VRAM.'
    )
    parser.add_argument(
        '--imgsz', type=int, default=640,
        help='Training image size (default: 640). Use 416 for faster training.'
    )
    parser.add_argument(
        '--patience', type=int, default=20,
        help='Early stopping patience (default: 20 epochs without improvement).'
    )
    parser.add_argument(
        '--workers', type=int, default=4,
        help='DataLoader workers (default: 4). Set to 0 on Windows if errors occur.'
    )
    parser.add_argument(
        '--device', type=str, default=None,
        help='Training device: "cpu", "0" (GPU 0), "0,1" (multi-GPU). '
             'Default: auto-detect.'
    )
    parser.add_argument(
        '--resume', action='store_true',
        help='Resume training from last checkpoint.'
    )
    parser.add_argument(
        '--eval', action='store_true',
        help='Evaluate existing model on test set instead of training.'
    )
    parser.add_argument(
        '--test', type=str, default=None, metavar='IMAGE',
        help='Quick test: run model on this image (or a generated scene if omitted).'
    )

    args = parser.parse_args()

    if args.eval:
        evaluate()
    elif args.test is not None or (args.test is None and '--test' in sys.argv):
        quick_test(image_path=args.test)
    else:
        train(
            model_size = args.model,
            epochs     = args.epochs,
            batch_size = args.batch,
            img_size   = args.imgsz,
            patience   = args.patience,
            workers    = args.workers,
            device     = args.device,
            resume     = args.resume,
        )
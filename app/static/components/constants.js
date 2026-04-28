/*
 * constants.js — Static Game Data
 * ─────────────────────────────────────────────────────────────────────
 *
 * WHAT THIS FILE IS:
 *   All the fixed lookup tables the game needs: card ranks, suits,
 *   basic strategy tables, and the Illustrious 18 + Fab 4 deviations.
 *   None of this changes while the app is running — it's read-only data.
 *
 * WHY IT'S SEPARATE:
 *   Keeping data in its own file means every other component can use it
 *   without duplicating it. Change a strategy table here once and every
 *   panel that reads it updates automatically.
 *
 * LOAD ORDER:
 *   This file MUST be loaded first in index.html (before any component)
 *   because every other file uses these constants.
 */


// ── Speed mode: shuffle-prompt trigger ─────────────────────────────────
// When shoe.penetration crosses this percent in Speed mode, the
// SpeedShufflePrompt renders above CardGrid. Mirrors the server-side
// GameConfig.PENETRATION (0.75 → 75%); kept frontend-side to avoid
// threading another value through the gameState payload.
const SHUFFLE_PROMPT_THRESHOLD = 75;


// ── Card ranks in the order they appear in the card grid ─────────────
// 'A' = Ace, 'J/Q/K' = face cards, all count as 10 in Hi-Lo
const RANKS = ['A','2','3','4','5','6','7','8','9','10','J','Q','K'];

// ── The four suits with their display icon and colour flag ────────────
// isRed drives the red/black colour in the card grid buttons
const SUITS = [
  { name: 'spades',   icon: '♠', isRed: false },
  { name: 'hearts',   icon: '♥', isRed: true  },
  { name: 'diamonds', icon: '♦', isRed: true  },
  { name: 'clubs',    icon: '♣', isRed: false },
];

// ── Hi-Lo count tag for each rank ─────────────────────────────────────
// +1 = low cards (good for player when gone, bad when remaining)
//  0 = neutral cards
// -1 = high cards (good for player when remaining)
// This is the most popular card counting system in the world.
const HILO_TAG = {
  A: -1, '2': 1, '3': 1, '4': 1, '5': 1, '6': 1,
  '7': 0, '8': 0, '9': 0, '10': -1, J: -1, Q: -1, K: -1,
};

// ── Wong Halves count tag for each rank ───────────────────────────────
// Level 3 fractional system. Most accurate balanced system.
// Uses ±0.5, ±1, ±1.5 values. Extremely hard to use mentally.
const WONG_HALVES_TAG = {
  A: -1, '2': 0.5, '3': 1, '4': 1, '5': 1.5, '6': 1, '7': 0.5,
  '8': 0, '9': -0.5, '10': -1, J: -1, Q: -1, K: -1,
};

// ── Uston APC (Advanced Point Count) tag for each rank ────────────────
// Level 3 balanced system. Highest BC (.91) & IC (.90).
// Created by Ken Uston (Million Dollar Blackjack, 1981).
// Ace = 0 in main count; tracked via ace side count.
const USTON_APC_TAG = {
  A: 0, '2': 1, '3': 2, '4': 2, '5': 3, '6': 2, '7': 2,
  '8': 1, '9': -1, '10': -3, J: -3, Q: -3, K: -3,
};

// ── KO (Knock-Out) count tag — unbalanced (7 is +1) ──────────────────
const KO_TAG = {
  A: -1, '2': 1, '3': 1, '4': 1, '5': 1, '6': 1, '7': 1,
  '8': 0, '9': 0, '10': -1, J: -1, Q: -1, K: -1,
};

// ── Omega II count tag — Level 2 (±2 tags for 4-6, 10s) ──────────────
const OMEGA_II_TAG = {
  A: 0, '2': 1, '3': 1, '4': 2, '5': 2, '6': 2, '7': 1,
  '8': 0, '9': -1, '10': -2, J: -2, Q: -2, K: -2,
};

// ── Zen Count tag — Level 2 balanced ──────────────────────────────────
const ZEN_TAG = {
  A: -1, '2': 1, '3': 1, '4': 2, '5': 2, '6': 2, '7': 1,
  '8': 0, '9': 0, '10': -2, J: -2, Q: -2, K: -2,
};

// ── All counting system tags (for system-aware components) ────────────
const COUNT_TAGS = {
  hi_lo: HILO_TAG,
  ko: KO_TAG,
  omega_ii: OMEGA_II_TAG,
  zen: ZEN_TAG,
  wong_halves: WONG_HALVES_TAG,
  uston_apc: USTON_APC_TAG,
};

// ── Dealer upcards shown as column headers in the strategy tables ─────
// These are the 10 possible dealer upcards: 2 through 10, then Ace
const DEALER_COLS = [2, 3, 4, 5, 6, 7, 8, 9, 10, 'A'];

// ── Basic Strategy Tables ─────────────────────────────────────────────
// HOW TO READ THESE:
//   Each row = player's hand total
//   Each column = dealer's upcard (in DEALER_COLS order: 2,3,4,5,6,7,8,9,10,A)
//   Cell value = correct play:
//     H   = Hit
//     S   = Stand
//     D   = Double down (hit if double not allowed)
//     Ds  = Double if allowed, otherwise Stand
//     SP  = Split
//     SUR = Surrender (hit if surrender not allowed)
//
// These tables assume: 6-8 decks, S17 (dealer Stands on soft 17),
// no double after split (DAS=false), late surrender allowed.
// Change config.py if your casino uses different rules.

// Hard hands: player total with no usable Ace
const HARD_TABLE = {
   5: ['H','H','H','H','H','H','H','H','H','H'],
   6: ['H','H','H','H','H','H','H','H','H','H'],
   7: ['H','H','H','H','H','H','H','H','H','H'],
   8: ['H','H','H','H','H','H','H','H','H','H'],
   9: ['H','D','D','D','D','H','H','H','H','H'],
  10: ['D','D','D','D','D','D','D','D','H','H'],
  11: ['D','D','D','D','D','D','D','D','D','D'],
  12: ['H','H','S','S','S','H','H','H','H','H'],
  13: ['S','S','S','S','S','H','H','H','H','H'],
  14: ['S','S','S','S','S','H','H','H','H','H'],
  15: ['S','S','S','S','S','H','H','H','SUR','SUR'],  // Surrender vs 10 and Ace
  16: ['S','S','S','S','S','H','H','SUR','SUR','SUR'], // Surrender vs 9, 10, Ace
  17: ['S','S','S','S','S','S','S','S','S','S'],
};

// Soft hands: player has a usable Ace (counts as 11 without busting)
// Key = total WITH the Ace counted as 11. e.g. 17 = Ace + 6
const SOFT_LABELS = {
  13:'A,2', 14:'A,3', 15:'A,4', 16:'A,5',
  17:'A,6', 18:'A,7', 19:'A,8', 20:'A,9',
};

const SOFT_TABLE = {
  13: ['H','H','H','D','D','H','H','H','H','H'],
  14: ['H','H','H','D','D','H','H','H','H','H'],
  15: ['H','H','D','D','D','H','H','H','H','H'],
  16: ['H','H','D','D','D','H','H','H','H','H'],
  17: ['H','D','D','D','D','H','H','H','H','H'],
  18: ['S','Ds','Ds','Ds','Ds','S','S','H','H','H'],  // S17: Stand vs 2
  19: ['S','S','S','S','Ds','S','S','S','S','S'],
  20: ['S','S','S','S','S','S','S','S','S','S'],
};

// Pair hands: player's first two cards are the same rank
// Key = "rank,rank" string. e.g. 'A,A' = pair of Aces
const PAIR_TABLE = {
  'A,A':   ['SP','SP','SP','SP','SP','SP','SP','SP','SP','SP'], // Always split Aces
  '10,10': ['S','S','S','S','S','S','S','S','S','S'],           // Never split 10s (normally)
  '9,9':   ['SP','SP','SP','SP','SP','S','SP','SP','S','S'],
  '8,8':   ['SP','SP','SP','SP','SP','SP','SP','SP','SP','SP'], // Always split 8s
  '7,7':   ['SP','SP','SP','SP','SP','SP','H','H','H','H'],
  '6,6':   ['H','SP','SP','SP','SP','H','H','H','H','H'],
  '5,5':   ['D','D','D','D','D','D','D','D','H','H'],           // Treat 5,5 as hard 10
  '4,4':   ['H','H','H','H','H','H','H','H','H','H'],
  '3,3':   ['H','H','SP','SP','SP','SP','H','H','H','H'],
  '2,2':   ['H','H','SP','SP','SP','SP','H','H','H','H'],
};

// ── Illustrious 18 + Fab 4 Deviations ────────────────────────────────
// WHAT ARE DEVIATIONS?
//   Basic strategy (the tables above) assumes a neutral shoe. But when
//   the True Count is high or low, the correct play sometimes changes.
//   These 22 exceptions are the most valuable count-based deviations —
//   using them adds roughly +0.2% edge on top of basic strategy.
//
// HOW TO READ EACH ENTRY:
//   sit  = "player hand vs dealer upcard" — when this situation occurs
//   act  = the DEVIATION action (different from basic strategy)
//   tc   = the True Count trigger condition (e.g. "TC ≥ +3")
//   dir  = ">=" means "at or above this TC" | "<" means "below this TC"
//   thr  = the numeric threshold (e.g. 3 for TC ≥ +3)
//
// EXAMPLE:
//   { sit: '16 vs 10', act: 'STAND', dir: '>=', thr: 0 }
//   → Basic strategy says HIT 16 vs 10.
//   → But when True Count ≥ 0, STAND instead.
//   → Why? A neutral-to-rich shoe means the dealer likely already has 20.
//     Drawing into 26 hurts you more than standing on 16.

const ALL_DEVIATIONS = [
  // ── Fab 4 Surrenders (give up half your bet vs. likely losing full) ──
  { sit: '14 vs 10', act: 'SURRENDER', tc: 'TC ≥ +3', dir: '>=', thr:  3 },
  { sit: '15 vs 10', act: 'SURRENDER', tc: 'TC ≥ 0',  dir: '>=', thr:  0 },
  { sit: '15 vs 9',  act: 'SURRENDER', tc: 'TC ≥ +2', dir: '>=', thr:  2 },
  { sit: '15 vs A',  act: 'SURRENDER', tc: 'TC ≥ +1', dir: '>=', thr:  1 },

  // ── Illustrious 18 (the most valuable play deviations) ───────────────
  { sit: '16 vs 10',   act: 'STAND',  tc: 'TC ≥ 0',  dir: '>=', thr:  0  },
  { sit: '15 vs 10',   act: 'STAND',  tc: 'TC ≥ +4', dir: '>=', thr:  4  },
  { sit: '10,10 vs 5', act: 'SPLIT',  tc: 'TC ≥ +5', dir: '>=', thr:  5  },
  { sit: '10,10 vs 6', act: 'SPLIT',  tc: 'TC ≥ +4', dir: '>=', thr:  4  },
  { sit: '10 vs 10',   act: 'DOUBLE', tc: 'TC ≥ +4', dir: '>=', thr:  4  },
  { sit: '12 vs 3',    act: 'STAND',  tc: 'TC ≥ +2', dir: '>=', thr:  2  },
  { sit: '12 vs 2',    act: 'STAND',  tc: 'TC ≥ +3', dir: '>=', thr:  3  },
  { sit: '11 vs A',    act: 'DOUBLE', tc: 'TC ≥ +1', dir: '>=', thr:  1  },
  { sit: '9 vs 2',     act: 'DOUBLE', tc: 'TC ≥ +1', dir: '>=', thr:  1  },
  { sit: '10 vs A',    act: 'DOUBLE', tc: 'TC ≥ +4', dir: '>=', thr:  4  },
  { sit: '9 vs 7',     act: 'DOUBLE', tc: 'TC ≥ +3', dir: '>=', thr:  3  },
  { sit: '16 vs 9',    act: 'STAND',  tc: 'TC ≥ +5', dir: '>=', thr:  5  },
  // Negative count deviations — hit instead of standing when shoe is low-card rich
  { sit: '13 vs 2',    act: 'HIT',    tc: 'TC < −1', dir: '<',  thr: -1  },
  { sit: '12 vs 4',    act: 'HIT',    tc: 'TC < 0',  dir: '<',  thr:  0  },
  { sit: '12 vs 5',    act: 'HIT',    tc: 'TC < −2', dir: '<',  thr: -2  },
  { sit: '12 vs 6',    act: 'HIT',    tc: 'TC < −1', dir: '<',  thr: -1  },
  { sit: '13 vs 3',    act: 'HIT',    tc: 'TC < −2', dir: '<',  thr: -2  },
  { sit: '10 vs 9',    act: 'DOUBLE', tc: 'TC ≥ +2', dir: '>=', thr:  2  },
];
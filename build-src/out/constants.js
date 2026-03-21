const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const SUITS = [
    { name: 'spades', icon: '♠', isRed: false },
    { name: 'hearts', icon: '♥', isRed: true },
    { name: 'diamonds', icon: '♦', isRed: true },
    { name: 'clubs', icon: '♣', isRed: false },
];
const HILO_TAG = {
    A: -1, '2': 1, '3': 1, '4': 1, '5': 1, '6': 1,
    '7': 0, '8': 0, '9': 0, '10': -1, J: -1, Q: -1, K: -1,
};
const DEALER_COLS = [2, 3, 4, 5, 6, 7, 8, 9, 10, 'A'];
const HARD_TABLE = {
    5: ['H', 'H', 'H', 'H', 'H', 'H', 'H', 'H', 'H', 'H'],
    6: ['H', 'H', 'H', 'H', 'H', 'H', 'H', 'H', 'H', 'H'],
    7: ['H', 'H', 'H', 'H', 'H', 'H', 'H', 'H', 'H', 'H'],
    8: ['H', 'H', 'H', 'H', 'H', 'H', 'H', 'H', 'H', 'H'],
    9: ['H', 'D', 'D', 'D', 'D', 'H', 'H', 'H', 'H', 'H'],
    10: ['D', 'D', 'D', 'D', 'D', 'D', 'D', 'D', 'H', 'H'],
    11: ['D', 'D', 'D', 'D', 'D', 'D', 'D', 'D', 'D', 'D'],
    12: ['H', 'H', 'S', 'S', 'S', 'H', 'H', 'H', 'H', 'H'],
    13: ['S', 'S', 'S', 'S', 'S', 'H', 'H', 'H', 'H', 'H'],
    14: ['S', 'S', 'S', 'S', 'S', 'H', 'H', 'H', 'H', 'H'],
    15: ['S', 'S', 'S', 'S', 'S', 'H', 'H', 'H', 'SUR', 'SUR'],
    16: ['S', 'S', 'S', 'S', 'S', 'H', 'H', 'SUR', 'SUR', 'SUR'],
    17: ['S', 'S', 'S', 'S', 'S', 'S', 'S', 'S', 'S', 'S'],
};
const SOFT_LABELS = {
    13: 'A,2', 14: 'A,3', 15: 'A,4', 16: 'A,5',
    17: 'A,6', 18: 'A,7', 19: 'A,8', 20: 'A,9',
};
const SOFT_TABLE = {
    13: ['H', 'H', 'H', 'D', 'D', 'H', 'H', 'H', 'H', 'H'],
    14: ['H', 'H', 'H', 'D', 'D', 'H', 'H', 'H', 'H', 'H'],
    15: ['H', 'H', 'D', 'D', 'D', 'H', 'H', 'H', 'H', 'H'],
    16: ['H', 'H', 'D', 'D', 'D', 'H', 'H', 'H', 'H', 'H'],
    17: ['H', 'D', 'D', 'D', 'D', 'H', 'H', 'H', 'H', 'H'],
    18: ['S', 'Ds', 'Ds', 'Ds', 'Ds', 'S', 'S', 'H', 'H', 'H'],
    19: ['S', 'S', 'S', 'S', 'Ds', 'S', 'S', 'S', 'S', 'S'],
    20: ['S', 'S', 'S', 'S', 'S', 'S', 'S', 'S', 'S', 'S'],
};
const PAIR_TABLE = {
    'A,A': ['SP', 'SP', 'SP', 'SP', 'SP', 'SP', 'SP', 'SP', 'SP', 'SP'],
    '10,10': ['S', 'S', 'S', 'S', 'S', 'S', 'S', 'S', 'S', 'S'],
    '9,9': ['SP', 'SP', 'SP', 'SP', 'SP', 'S', 'SP', 'SP', 'S', 'S'],
    '8,8': ['SP', 'SP', 'SP', 'SP', 'SP', 'SP', 'SP', 'SP', 'SP', 'SP'],
    '7,7': ['SP', 'SP', 'SP', 'SP', 'SP', 'SP', 'H', 'H', 'H', 'H'],
    '6,6': ['H', 'SP', 'SP', 'SP', 'SP', 'H', 'H', 'H', 'H', 'H'],
    '5,5': ['D', 'D', 'D', 'D', 'D', 'D', 'D', 'D', 'H', 'H'],
    '4,4': ['H', 'H', 'H', 'H', 'H', 'H', 'H', 'H', 'H', 'H'],
    '3,3': ['H', 'H', 'SP', 'SP', 'SP', 'SP', 'H', 'H', 'H', 'H'],
    '2,2': ['H', 'H', 'SP', 'SP', 'SP', 'SP', 'H', 'H', 'H', 'H'],
};
const ALL_DEVIATIONS = [
    { sit: '14 vs 10', act: 'SURRENDER', tc: 'TC ≥ +3', dir: '>=', thr: 3 },
    { sit: '15 vs 10', act: 'SURRENDER', tc: 'TC ≥ 0', dir: '>=', thr: 0 },
    { sit: '15 vs 9', act: 'SURRENDER', tc: 'TC ≥ +2', dir: '>=', thr: 2 },
    { sit: '15 vs A', act: 'SURRENDER', tc: 'TC ≥ +1', dir: '>=', thr: 1 },
    { sit: '16 vs 10', act: 'STAND', tc: 'TC ≥ 0', dir: '>=', thr: 0 },
    { sit: '15 vs 10', act: 'STAND', tc: 'TC ≥ +4', dir: '>=', thr: 4 },
    { sit: '10,10 vs 5', act: 'SPLIT', tc: 'TC ≥ +5', dir: '>=', thr: 5 },
    { sit: '10,10 vs 6', act: 'SPLIT', tc: 'TC ≥ +4', dir: '>=', thr: 4 },
    { sit: '10 vs 10', act: 'DOUBLE', tc: 'TC ≥ +4', dir: '>=', thr: 4 },
    { sit: '12 vs 3', act: 'STAND', tc: 'TC ≥ +2', dir: '>=', thr: 2 },
    { sit: '12 vs 2', act: 'STAND', tc: 'TC ≥ +3', dir: '>=', thr: 3 },
    { sit: '11 vs A', act: 'DOUBLE', tc: 'TC ≥ +1', dir: '>=', thr: 1 },
    { sit: '9 vs 2', act: 'DOUBLE', tc: 'TC ≥ +1', dir: '>=', thr: 1 },
    { sit: '10 vs A', act: 'DOUBLE', tc: 'TC ≥ +4', dir: '>=', thr: 4 },
    { sit: '9 vs 7', act: 'DOUBLE', tc: 'TC ≥ +3', dir: '>=', thr: 3 },
    { sit: '16 vs 9', act: 'STAND', tc: 'TC ≥ +5', dir: '>=', thr: 5 },
    { sit: '13 vs 2', act: 'HIT', tc: 'TC < −1', dir: '<', thr: -1 },
    { sit: '12 vs 4', act: 'HIT', tc: 'TC < 0', dir: '<', thr: 0 },
    { sit: '12 vs 5', act: 'HIT', tc: 'TC < −2', dir: '<', thr: -2 },
    { sit: '12 vs 6', act: 'HIT', tc: 'TC < −1', dir: '<', thr: -1 },
    { sit: '13 vs 3', act: 'HIT', tc: 'TC < −2', dir: '<', thr: -2 },
    { sit: '10 vs 9', act: 'DOUBLE', tc: 'TC ≥ +2', dir: '>=', thr: 2 },
];

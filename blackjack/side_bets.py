"""
╔══════════════════════════════════════════════════════════════════════════════╗
║  blackjack/side_bets.py — Side Bet Expected Value Analyser                 ║
║                                                                              ║
║  BUGS FIXED (3 separate issues):                                             ║
║                                                                              ║
║  BUG 1 — EV formula wrong across ALL bets:                                  ║
║    OLD (wrong):  EV = Σ p_i * (payout_i - 1) - p_lose                      ║
║    NEW (correct): EV = Σ p_i * payout_i      - p_lose                      ║
║    Payouts are stated as X:1 (NET wins). The -1 subtracted the stake        ║
║    twice, doubling the apparent house edge.                                 ║
║                                                                              ║
║  BUG 2 — 21+3 used hardcoded approximate probabilities instead of          ║
║    computing real probabilities from the actual remaining shoe.              ║
║    Now uses combinatorial math on shoe.cards for accurate EV.              ║
║                                                                              ║
║  BUG 3 — Lucky Ladies ignored the matched_20 (25:1) and suited_20 (10:1)  ║
║    payout tiers entirely. Only QH pair and any_20 were computed.            ║
║    Now all five tiers are computed with correct hierarchical assignment.    ║
║                                                                              ║
║  EV FORMULA (correct):                                                       ║
║    EV per $1 bet = Σ(probability_i × net_payout_i) − probability_lose      ║
║    where net_payout_i is the X in "pays X:1" (not including stake return)  ║
╚══════════════════════════════════════════════════════════════════════════════╝
"""
from math import comb
from typing import Dict, List
from .card import Card, Shoe, Rank, Suit
from .counting import CardCounter
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from config import SideBetConfig


class SideBetAnalyzer:
    """
    Real-time expected value calculator for blackjack side bets.
    Uses remaining shoe composition for accurate probability calculation.

    Insurance is intentionally excluded — handled separately in server.py.
    """

    def __init__(self, config: SideBetConfig = None):
        self.config = config or SideBetConfig()

    def analyze_all(self, shoe: Shoe, counter: CardCounter,
                    player_cards: List[Card] = None,
                    dealer_upcard: Card = None) -> Dict:
        return {
            "perfect_pairs":     self.perfect_pairs_ev(shoe),
            "twenty_one_plus_3": self.twenty_one_plus_3_ev(shoe, player_cards, dealer_upcard),
            "lucky_ladies":      self.lucky_ladies_ev(shoe, dealer_upcard),
        }

    # ──────────────────────────────────────────────────────────────────────
    # PERFECT PAIRS
    # ──────────────────────────────────────────────────────────────────────

    def perfect_pairs_ev(self, shoe: Shoe) -> Dict:
        """
        Perfect Pairs: pays on player's first two cards being a pair.
          Perfect (same rank, same suit):          25:1
          Colored (same rank, same colour, diff suit): 12:1
          Mixed   (same rank, different colour):    6:1

        FIX: Use correct EV formula — payouts are X:1 (NET), not gross.
        Probabilities count UNORDERED pairs (combinations, not permutations).
        """
        total = len(shoe.cards)
        if total < 2:
            return {"name": "Perfect Pairs", "ev": -100.0, "recommended": False}

        total_combos = total * (total - 1) // 2   # C(total, 2) unordered pairs
        if total_combos == 0:
            return {"name": "Perfect Pairs", "ev": -100.0, "recommended": False}

        red_suits   = {Suit.HEARTS, Suit.DIAMONDS}
        black_suits = {Suit.CLUBS,  Suit.SPADES}

        # Group cards by rank
        by_rank: Dict = {}
        for card in shoe.cards:
            by_rank.setdefault(card.rank, []).append(card)

        perfect_count  = 0
        colored_count  = 0
        mixed_count    = 0

        for cards_of_rank in by_rank.values():
            n = len(cards_of_rank)
            if n < 2:
                continue

            # Group by suit within this rank
            by_suit: Dict = {}
            for c in cards_of_rank:
                by_suit.setdefault(c.suit, 0)
                by_suit[c.suit] += 1

            # Perfect: same rank, same suit
            for cnt in by_suit.values():
                if cnt >= 2:
                    perfect_count += cnt * (cnt - 1) // 2

            # Colored: same rank, same colour, different suit
            red_cnt   = sum(by_suit.get(s, 0) for s in red_suits)
            black_cnt = sum(by_suit.get(s, 0) for s in black_suits)

            # Pairs within same colour = C(colour_total, 2) minus perfect pairs of that colour
            red_perfect   = sum(c * (c - 1) // 2 for s in red_suits   for c in [by_suit.get(s, 0)])
            black_perfect = sum(c * (c - 1) // 2 for s in black_suits for c in [by_suit.get(s, 0)])

            colored_count += max(0, red_cnt   * (red_cnt   - 1) // 2 - red_perfect)
            colored_count += max(0, black_cnt * (black_cnt - 1) // 2 - black_perfect)

            # Mixed: same rank, different colour = all pairs minus same-colour pairs
            all_pairs_this_rank   = n * (n - 1) // 2
            same_color_pairs      = (red_cnt * (red_cnt - 1) // 2 +
                                     black_cnt * (black_cnt - 1) // 2)
            mixed_count += max(0, all_pairs_this_rank - same_color_pairs)

        p_perfect  = perfect_count  / total_combos
        p_colored  = colored_count  / total_combos
        p_mixed    = mixed_count    / total_combos
        p_loss     = 1.0 - p_perfect - p_colored - p_mixed

        payouts = self.config.PERFECT_PAIRS_PAYOUT
        # FIXED: payout is X:1 net — multiply directly, do NOT subtract 1
        ev = (p_perfect * payouts["perfect"]
              + p_colored * payouts["colored"]
              + p_mixed   * payouts["mixed"]
              - p_loss)

        return {
            "name":         "Perfect Pairs",
            "ev":           round(ev * 100, 2),
            "perfect_prob": round(p_perfect * 100, 2),
            "colored_prob": round(p_colored * 100, 2),
            "mixed_prob":   round(p_mixed   * 100, 2),
            "recommended":  ev > 0,
            "emoji":        "✅" if ev > 0 else "❌",
        }

    # ──────────────────────────────────────────────────────────────────────
    # 21+3
    # ──────────────────────────────────────────────────────────────────────

    def twenty_one_plus_3_ev(self, shoe: Shoe,
                              player_cards: List[Card] = None,
                              dealer_upcard: Card = None) -> Dict:
        """
        21+3: player's 2 cards + dealer upcard form a 3-card poker hand.
          Suited trips:    100:1
          Straight flush:   40:1
          Three of a kind:  30:1
          Straight:         10:1
          Flush:             5:1

        FIX 1: Real probabilities from shoe composition — not hardcoded.
        FIX 2: Correct net EV formula (X:1 payouts, no spurious -1).
        FIX 3: Ace-double-counting bug fixed — exactly 12 unique sequences.
        """
        cards = shoe.cards
        total = len(cards)
        if total < 3:
            return {"name": "21+3", "ev": -100.0, "recommended": False}

        total_combos = comb(total, 3)

        # rank_val → suit → count  (ace appears as both 1 and 14 for A-low/A-high straights)
        RANK_VALS = {
            Rank.ACE: [1, 14], Rank.TWO: [2], Rank.THREE: [3], Rank.FOUR: [4],
            Rank.FIVE: [5], Rank.SIX: [6], Rank.SEVEN: [7], Rank.EIGHT: [8],
            Rank.NINE: [9], Rank.TEN: [10], Rank.JACK: [11],
            Rank.QUEEN: [12], Rank.KING: [13],
        }

        # Build group structures in one O(n) pass
        by_rank_suit: Dict = {}    # rank → suit → count
        by_suit_rank: Dict = {}    # suit → rank → count
        for c in cards:
            by_rank_suit.setdefault(c.rank, {}).setdefault(c.suit, 0)
            by_rank_suit[c.rank][c.suit] += 1
            by_suit_rank.setdefault(c.suit, {}).setdefault(c.rank, 0)
            by_suit_rank[c.suit][c.rank] += 1

        # rank_val → suit → count  (ace duplicated for low/high)
        rv_suit: Dict = {}
        for rank, suit_counts in by_rank_suit.items():
            for rv in RANK_VALS[rank]:
                rv_suit[rv] = suit_counts   # same dict reference for ace's two values is fine

        # 12 unique sequences: A23…JQK then QKA (ace-high). No duplicates.
        sequences = [(i, i+1, i+2) for i in range(1, 12)]   # (1,2,3) … (11,12,13)
        sequences.append((12, 13, 14))                        # QKA

        # ── Suited trips ───────────────────────────────────────────────
        suited_trips = sum(
            comb(cnt, 3)
            for suit_counts in by_rank_suit.values()
            for cnt in suit_counts.values()
            if cnt >= 3
        )

        # ── Three of a kind (same rank, not all same suit) ─────────────
        three_kind = sum(
            comb(sum(sc.values()), 3) - sum(comb(c, 3) for c in sc.values())
            for sc in by_rank_suit.values()
            if sum(sc.values()) >= 3
        )

        # ── Straight flush (3 consecutive ranks, same suit) ────────────
        straight_flush = 0
        for r1, r2, r3 in sequences:
            s1, s2, s3 = rv_suit.get(r1, {}), rv_suit.get(r2, {}), rv_suit.get(r3, {})
            for suit in Suit:
                straight_flush += s1.get(suit, 0) * s2.get(suit, 0) * s3.get(suit, 0)

        # ── All straights (3 consecutive ranks, any suits) ─────────────
        all_straights = 0
        for r1, r2, r3 in sequences:
            t1 = sum(rv_suit.get(r1, {}).values())
            t2 = sum(rv_suit.get(r2, {}).values())
            t3 = sum(rv_suit.get(r3, {}).values())
            all_straights += t1 * t2 * t3

        straight = all_straights - straight_flush

        # ── Flush (same suit, not straight, not trips) ─────────────────
        flush = 0
        for suit, rank_counts in by_suit_rank.items():
            sc = sum(rank_counts.values())
            if sc < 3:
                continue
            all_flush_suit = comb(sc, 3)
            # subtract suited trips for this suit
            st_suit = sum(comb(cnt, 3) for cnt in rank_counts.values() if cnt >= 3)
            # subtract straight flushes for this suit
            sf_suit = 0
            for r1, r2, r3 in sequences:
                def _c(rv, s=suit):
                    return rv_suit.get(rv, {}).get(s, 0)
                sf_suit += _c(r1) * _c(r2) * _c(r3)
            flush += max(0, all_flush_suit - st_suit - sf_suit)

        p_st   = suited_trips   / total_combos
        p_sf   = straight_flush / total_combos
        p_tk   = three_kind     / total_combos
        p_s    = straight       / total_combos
        p_f    = flush          / total_combos
        p_loss = 1.0 - p_st - p_sf - p_tk - p_s - p_f

        payouts = self.config.TWENTY_ONE_PLUS_3_PAYOUT
        ev = (p_st * payouts["suited_trips"]
              + p_sf * payouts["straight_flush"]
              + p_tk * payouts["three_of_a_kind"]
              + p_s  * payouts["straight"]
              + p_f  * payouts["flush"]
              - p_loss)

        return {
            "name":                "21+3",
            "ev":                  round(ev * 100, 2),
            "suited_trips_prob":   round(p_st * 100, 3),
            "straight_flush_prob": round(p_sf * 100, 3),
            "three_kind_prob":     round(p_tk * 100, 3),
            "straight_prob":       round(p_s  * 100, 2),
            "flush_prob":          round(p_f  * 100, 2),
            "recommended":         ev > 0,
            "emoji":               "✅" if ev > 0 else "❌",
        }

    # ──────────────────────────────────────────────────────────────────────
    # LUCKY LADIES
    # ──────────────────────────────────────────────────────────────────────

    def lucky_ladies_ev(self, shoe: Shoe, dealer_upcard: Card = None) -> Dict:
        """
        Lucky Ladies: pays on player's first two cards totaling 20.
        Payout tiers (highest wins, hierarchical):
          QH pair + dealer BJ: 1000:1
          QH pair:              200:1
          Matched 20 (same rank, same suit, total=20): 25:1
          Suited 20  (same suit, total=20, not matched): 10:1
          Any 20:                4:1

        FIX 1: All five payout tiers now computed (matched_20 and suited_20
               were completely missing before).
        FIX 2: Correct net EV formula (no spurious -1 on payouts).
        FIX 3: O(n) computation via value-bucketing (was O(n²) nested loop).
        """
        cards = shoe.cards
        total = len(cards)
        if total < 2:
            return {"name": "Lucky Ladies", "ev": -100.0, "recommended": False}

        total_combos = total * (total - 1) // 2   # C(total, 2)

        red_suits = {Suit.HEARTS, Suit.DIAMONDS}

        # Build lookup structures in one pass — O(n)
        by_val_suit: Dict = {}     # (bj_value, suit) → count
        by_val: Dict = {}          # bj_value → count
        by_rank_suit: Dict = {}    # (rank, suit) → count

        for c in cards:
            v = c.value   # BJ value (10 for all face cards)
            by_val[v]                    = by_val.get(v, 0) + 1
            key_vs = (v, c.suit)
            by_val_suit[key_vs]          = by_val_suit.get(key_vs, 0) + 1
            key_rs = (c.rank, c.suit)
            by_rank_suit[key_rs]         = by_rank_suit.get(key_rs, 0) + 1

        qh_cnt = by_rank_suit.get((Rank.QUEEN, Suit.HEARTS), 0)

        # ── QH pair ────────────────────────────────────────────────────
        qh_pair = comb(qh_cnt, 2) if qh_cnt >= 2 else 0

        # ── QH pair + dealer BJ (1000:1) ────────────────────────────────────
        # Dealer BJ requires their upcard to be Ace or 10-value.
        # If we know the dealer upcard is Ace, P(dealer BJ) ≈ 10-count/remaining.
        # If we know it's 10-value, P(dealer BJ) ≈ ace-count/remaining.
        # If unknown, we cannot compute this tier — set to 0.
        p_dealer_bj = 0.0
        if dealer_upcard is not None:
            remaining_cards = len(shoe.cards)
            if dealer_upcard.is_ace and remaining_cards > 0:
                ten_cnt = by_val.get(10, 0)
                p_dealer_bj = ten_cnt / remaining_cards
            elif dealer_upcard.value == 10 and remaining_cards > 0:
                ace_cnt = by_val.get(11, 0)
                p_dealer_bj = ace_cnt / remaining_cards
        # P(QH pair AND dealer BJ) — QH pair is from player's 2 cards
        p_qh_dealer_bj = (qh_pair / total_combos) * p_dealer_bj if total_combos > 0 else 0

        # ── Matched 20: same rank + same suit, total = 20 ──────────────
        # Only 10-value cards can form a matched pair totaling 20
        matched_20 = sum(
            comb(cnt, 2)
            for (rank, suit), cnt in by_rank_suit.items()
            if rank.bj_value == 10 and cnt >= 2
        )
        # QH pair is a subset of matched_20 (QH are rank=QUEEN, suit=HEARTS, value=10)

        # ── Suited 20: same suit, total=20, NOT matched ─────────────────
        # Case 1: two 10-value cards, same suit, different rank
        suited_10_10 = 0
        for suit in Suit:
            # all 10-val cards of this suit
            ten_val_this_suit = sum(
                cnt for (v, s), cnt in by_val_suit.items()
                if s == suit and v == 10
            )
            # subtract matched pairs within this suit (same rank)
            matched_this_suit = sum(
                comb(cnt, 2)
                for (rank, s), cnt in by_rank_suit.items()
                if s == suit and rank.bj_value == 10 and cnt >= 2
            )
            suited_10_10 += comb(ten_val_this_suit, 2) - matched_this_suit

        # Case 2: Ace + 9, same suit (A=11, 9=9 → 20)
        suited_a9 = 0
        for suit in Suit:
            aces_this_suit  = by_val_suit.get((11, suit), 0)
            nines_this_suit = by_val_suit.get((9,  suit), 0)
            suited_a9 += aces_this_suit * nines_this_suit

        suited_20 = suited_10_10 + suited_a9

        # ── Any 20: all combos totaling 20 ─────────────────────────────
        # 10-val + 10-val (any suits)
        ten_total = by_val.get(10, 0)
        any_10_10 = comb(ten_total, 2)

        # Ace + 9 (any suits)
        ace_total  = by_val.get(11, 0)
        nine_total = by_val.get(9,  0)
        any_a9 = ace_total * nine_total

        any_20 = any_10_10 + any_a9

        # ── Hierarchical tier assignment ────────────────────────────────
        # Award the HIGHEST applicable tier for each combo
        p_qh_bj   = p_qh_dealer_bj                              # QH pair + dealer BJ: 1000:1
        p_qh      = max(0, qh_pair / total_combos - p_qh_bj)    # QH pair (no dealer BJ): 200:1
        # matched includes QH; subtract QH to get non-QH matched tier
        p_matched = max(0, (matched_20 - qh_pair) / total_combos)
        # suited_20 already has matched pairs excluded (subtracted during computation)
        suited_non_matched = suited_20
        p_suited  = suited_non_matched / total_combos
        # any_20 minus the upper tiers
        any_non_special = max(0, any_20 - matched_20 - suited_non_matched)
        p_any     = any_non_special / total_combos
        payouts = self.config.LUCKY_LADIES_PAYOUT
        p_loss = max(0, 1.0 - p_qh_bj - p_qh - p_matched - p_suited - p_any)
        ev = (p_qh_bj   * payouts["matched_20_with_dealer_bj"]
              + p_qh     * payouts["queen_hearts_pair"]
              + p_matched * payouts["matched_20"]
              + p_suited  * payouts["suited_20"]
              + p_any     * payouts["any_20"]
              - p_loss)

        return {
            "name":           "Lucky Ladies",
            "ev":             round(ev * 100, 2),
            "qh_remaining":   qh_cnt,
            "qh_pair_prob":   round(p_qh      * 100, 4),
            "matched_prob":   round(p_matched  * 100, 3),
            "suited_prob":    round(p_suited   * 100, 3),
            "any_20_prob":    round((p_qh + p_matched + p_suited + p_any) * 100, 2),
            "recommended":    ev > 0,
            "emoji":          "✅" if ev > 0 else "❌",
        }

    def get_recommendations(self, shoe: Shoe, counter: CardCounter) -> Dict:
        """Get a summary of all side bet recommendations."""
        analysis = self.analyze_all(shoe, counter)
        profitable = {k: v for k, v in analysis.items() if v.get("recommended", False)}
        return {
            "all_bets":        analysis,
            "profitable_bets": list(profitable.keys()),
            "has_profitable":  len(profitable) > 0,
            "best_bet":        max(analysis.items(), key=lambda x: x[1].get("ev", -999))[0]
                               if analysis else None,
        }
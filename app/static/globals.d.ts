/**
 * globals.d.ts — TypeScript type declarations for VS Code
 * ─────────────────────────────────────────────────────────
 * WHAT THIS FILE IS:
 *   This file tells VS Code about variables that exist at runtime
 *   (loaded from CDN scripts in index.html) but are not imported
 *   via import statements. Without this file, VS Code shows red
 *   squiggly underlines under React, useState, io, etc. even
 *   though the code runs perfectly fine in the browser.
 *
 * WHY WE NEED IT:
 *   The project loads React and Socket.IO from CDN <script> tags,
 *   not from npm packages. VS Code's TypeScript checker can't see
 *   CDN scripts, so it thinks these variables don't exist.
 *   This file says "trust me, these exist at runtime."
 *
 * YOU DO NOT NEED TO EDIT THIS FILE unless you add a new global
 * variable from a new CDN script.
 */

// ── React (loaded from unpkg.com CDN in index.html) ──────────────
declare var React: any;
declare var ReactDOM: any;

// React hooks — these are destructured from React in each component:
//   const { useState, useEffect } = React;
// VS Code needs to know they exist as globals after that destructure.
declare var useState: any;
declare var useEffect: any;
declare var useRef: any;
declare var useCallback: any;
declare var useMemo: any;
declare var useContext: any;
declare var useReducer: any;

// ── Socket.IO (loaded from cdnjs CDN in index.html) ───────────────
// io() opens a WebSocket connection to the Flask server
declare var io: any;

// ── Game data constants (defined in constants.js) ─────────────────
declare var RANKS: string[];
declare var SUITS: { name: string; icon: string; isRed: boolean }[];
declare var HILO_TAG: Record<string, number>;
declare var DEALER_COLS: (number | string)[];
declare var HARD_TABLE: Record<number, string[]>;
declare var SOFT_TABLE: Record<number, string[]>;
declare var SOFT_LABELS: Record<number, string>;
declare var PAIR_TABLE: Record<string, string[]>;
declare var ALL_DEVIATIONS: any[];
declare var DEVIATION_TOOLTIPS: Record<string, any>;
declare var COUNTING_SYSTEMS: Record<string, any>;
declare var SHUFFLE_TYPES: Record<string, any>;
declare var CURRENCIES: any[];

// ── Helper functions (defined in utils.js) ────────────────────────
declare function countClass(val: number): string;
declare function cellClass(code: string): string;
declare function actionClass(action: string): string;
declare function showToast(msg: string, type?: string): void;
declare function formatMoney(n: number): string;
declare function buildExplanation(action: any, rec: any, count: any): string[];
declare function getDeviationTooltip(dev: any, action: any, basic: any, tc: any): any;

// ── React components (each defined in its own file) ───────────────
// These are global functions because we don't use ES modules —
// all component files are loaded as plain <script> tags and their
// functions become globals automatically.
declare function Widget(props: any): any;
declare function KV(props: any): any;
declare function TopBar(props: any): any;
declare function ActionPanel(props: any): any;
declare function BettingPanel(props: any): any;
declare function SideBetPanel(props: any): any;
declare function HandDisplay(props: any): any;
declare function CardGrid(props: any): any;
declare function StrategyRefTable(props: any): any;
declare function ShoePanel(props: any): any;
declare function EdgeMeter(props: any): any;
declare function SessionStats(props: any): any;
declare function ShuffleTrackerPanel(props: any): any;
declare function CountHistoryPanel(props: any): any;
declare function I18Panel(props: any): any;
declare function LiveOverlayPanel(props: any): any;
declare function CenterToolbar(props: any): any;
declare function SplitHandPanel(props: any): any;
declare function SideCountPanel(props: any): any;
declare function CasinoRiskMeter(props: any): any;
declare function StopAlerts(props: any): any;
declare function MiniCard(props: any): any;
declare function MiniCardBack(props: any): any;
declare function InfoTooltip(props: any): any;
declare function CountBlock(props: any): any;

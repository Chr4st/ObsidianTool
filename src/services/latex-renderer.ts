// ─── LaTeX to Unicode Conversion Service ────────────────────────────────────
//
// Converts LaTeX math notation to Unicode symbols for terminal display.
// Uses `unicodeit` as the base converter with supplementary mappings
// for symbols it does not handle.
//
// All functions are pure: no side effects, no mutation.
// ─────────────────────────────────────────────────────────────────────────────

import unicodeit from 'unicodeit';

// ─── Supplementary Symbol Mappings ──────────────────────────────────────────

const LOGIC_SYMBOLS: ReadonlyMap<string, string> = new Map([
  ['\\implies', '\u27F9'],
  ['\\iff', '\u27FA'],
  ['\\to', '\u2192'],
  ['\\mapsto', '\u21A6'],
  ['\\forall', '\u2200'],
  ['\\exists', '\u2203'],
  ['\\nexists', '\u2204'],
]);

const SET_SYMBOLS: ReadonlyMap<string, string> = new Map([
  ['\\in', '\u2208'],
  ['\\notin', '\u2209'],
  ['\\subset', '\u2282'],
  ['\\supset', '\u2283'],
  ['\\cup', '\u222A'],
  ['\\cap', '\u2229'],
  ['\\emptyset', '\u2205'],
]);

const CALCULUS_SYMBOLS: ReadonlyMap<string, string> = new Map([
  ['\\infty', '\u221E'],
  ['\\partial', '\u2202'],
  ['\\nabla', '\u2207'],
  ['\\int', '\u222B'],
  ['\\sum', '\u2211'],
  ['\\prod', '\u220F'],
]);

const BLACKBOARD_BOLD: ReadonlyMap<string, string> = new Map([
  ['\\mathbb{R}', '\u211D'],
  ['\\mathbb{N}', '\u2115'],
  ['\\mathbb{Z}', '\u2124'],
  ['\\mathbb{Q}', '\u211A'],
  ['\\mathbb{C}', '\u2102'],
]);

const GREEK_LETTERS: ReadonlyMap<string, string> = new Map([
  ['\\alpha', '\u03B1'],
  ['\\beta', '\u03B2'],
  ['\\gamma', '\u03B3'],
  ['\\delta', '\u03B4'],
  ['\\epsilon', '\u03B5'],
  ['\\lambda', '\u03BB'],
  ['\\mu', '\u03BC'],
  ['\\pi', '\u03C0'],
  ['\\sigma', '\u03C3'],
  ['\\theta', '\u03B8'],
  ['\\omega', '\u03C9'],
]);

const SUBSCRIPTS: ReadonlyMap<string, string> = new Map([
  ['_0', '\u2080'],
  ['_1', '\u2081'],
  ['_2', '\u2082'],
  ['_3', '\u2083'],
  ['_4', '\u2084'],
  ['_5', '\u2085'],
  ['_6', '\u2086'],
  ['_7', '\u2087'],
  ['_8', '\u2088'],
  ['_9', '\u2089'],
  ['_n', '\u2099'],
  ['_i', '\u1D62'],
]);

const SUPERSCRIPTS: ReadonlyMap<string, string> = new Map([
  ['^2', '\u00B2'],
  ['^3', '\u00B3'],
  ['^n', '\u207F'],
]);

/** Merged lookup of every supplementary mapping (built once at import). */
const ALL_SUPPLEMENTARY: ReadonlyMap<string, string> = new Map([
  ...LOGIC_SYMBOLS,
  ...SET_SYMBOLS,
  ...CALCULUS_SYMBOLS,
  ...BLACKBOARD_BOLD,
  ...GREEK_LETTERS,
  ...SUBSCRIPTS,
  ...SUPERSCRIPTS,
]);

// ─── Internal Helpers ───────────────────────────────────────────────────────

/** Escape a string for safe use inside a RegExp. */
const escapeRegExp = (s: string): string =>
  s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Build a single RegExp that matches any key in `map`, longest-first so that
 * e.g. `\implies` is tried before `\in`.
 */
const buildSupplementaryPattern = (
  map: ReadonlyMap<string, string>,
): RegExp => {
  const keys = [...map.keys()].sort((a, b) => b.length - a.length);
  return new RegExp(keys.map(escapeRegExp).join('|'), 'g');
};

const SUPPLEMENTARY_RE = buildSupplementaryPattern(ALL_SUPPLEMENTARY);

/** Replace `\frac{a}{b}` with `a/b`. */
const replaceFractions = (text: string): string =>
  text.replace(/\\frac\{([^}]*)}\{([^}]*)}/g, '$1/$2');

/** Replace `\sqrt{x}` with `\u221Ax`. Handles nested braces one level deep. */
const replaceSqrt = (text: string): string =>
  text.replace(/\\sqrt\{([^}]*)}/g, '\u221A$1');

/** Apply supplementary symbol mappings. */
const applySupplementary = (text: string): string =>
  text.replace(SUPPLEMENTARY_RE, (match) => ALL_SUPPLEMENTARY.get(match) ?? match);

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Convert a raw LaTeX expression (without dollar-sign delimiters) to Unicode.
 *
 * Processing order:
 *  1. Structural macros (`\frac`, `\sqrt`)
 *  2. Supplementary symbol table (longest-match-first)
 *  3. `unicodeit` for everything else
 *
 * If any step throws, the original string is returned unchanged.
 */
export const renderLatex = (latex: string): string => {
  try {
    const afterFractions = replaceFractions(latex);
    const afterSqrt = replaceSqrt(afterFractions);
    const afterSupplementary = applySupplementary(afterSqrt);
    return unicodeit.replace(afterSupplementary);
  } catch {
    return latex;
  }
};

/**
 * Find every inline LaTeX span (`$...$`, but not `$$`) in `text` and replace
 * it with its Unicode equivalent.
 */
export const renderInlineLatex = (text: string): string => {
  try {
    // Negative lookbehind/ahead for $ ensures we skip display-math delimiters.
    return text.replace(
      /(?<!\$)\$(?!\$)(.+?)(?<!\$)\$(?!\$)/g,
      (_match, inner: string) => renderLatex(inner),
    );
  } catch {
    return text;
  }
};

/**
 * Find every display-math block (`$$...$$`) in `text` and replace it with an
 * indented Unicode block.
 */
export const renderDisplayLatex = (text: string): string => {
  try {
    return text.replace(
      /\$\$([\s\S]+?)\$\$/g,
      (_match, inner: string) => {
        const rendered = renderLatex(inner.trim());
        return `\n    ${rendered}\n`;
      },
    );
  } catch {
    return text;
  }
};

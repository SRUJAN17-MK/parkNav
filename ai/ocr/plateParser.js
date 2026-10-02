'use strict';

/**
 * SmartPark - Indian number plate parser / validator.
 *
 * Indian plates follow:  SS RR LL NNNN
 *   SS   state code            (KA, MH, TN, DL, ...)
 *   RR   RTO / district code   (01 - 99)
 *   LL   letter series         (1-3 letters, vowels are not used)
 *   NNNN registration serial  (1-4 digits, usually 4)
 *
 * OCR engines confuse 0/O, 1/I, 8/B, 5/S ... Instead of guessing position by
 * position we generate the small set of possible single/double substitutions
 * and keep the first candidate that matches the SS RR LL NNNN grammar. A plate
 * that is already valid is returned untouched, so correct reads are never
 * "repaired" into something else.
 */

const STATE_CODES = [
  'AP', 'AR', 'AS', 'BR', 'CG', 'CH', 'DD', 'DL', 'GA', 'GJ', 'HP', 'HR', 'JH', 'JK',
  'KA', 'KL', 'LA', 'LD', 'MH', 'ML', 'MN', 'MP', 'MZ', 'NL', 'OD', 'PB', 'PY', 'RJ',
  'SK', 'TN', 'TR', 'TS', 'UK', 'UP', 'WB',
];

const VOWELS = new Set(['A', 'E', 'I', 'O', 'U']);
/**
 * Canonical Indian plate: SS RR LL NNNN (state, RTO, 1-2 letter series, 4 digit
 * serial). Kept strict on purpose - a loose pattern would happily re-split a
 * misread plate such as "TN99ZZI234" into a 3 letter series and a 3 digit
 * serial, so the plate would look valid while being wrong.
 */
const PLATE_PATTERN = /^([A-Z]{2})([0-9]{2})([A-Z]{1,2})([0-9]{4})$/;

/**
 * Letters an OCR engine commonly reports instead of a digit (8 -> B etc).
 * Repair is one-directional on purpose: the plate format already tells us which
 * positions must be digits, so a letter there is safely mapped back. Guessing the
 * other way (turning a stray digit in the series into some letter) would invent a
 * *different* valid plate, which is far worse than reporting an unreadable one.
 */
const CONFUSABLES = { O: '0', Q: '0', D: '0', I: '1', L: '1', Z: '2', S: '5', G: '6', T: '7', B: '8' };

/**
 * The only positions a letter may be turned into a digit: the RTO (2,3) and the
 * serial (6,7,8,9). Positions 4-5 are the series and always letters, so a digit
 * there is reported as an unreadable plate instead of being "repaired" into some
 * arbitrary letter that would produce a completely different - but valid looking -
 * number.
 */
const NUMERIC_POSITIONS = new Set([2, 3, 6, 7, 8, 9]);

/** Uppercases and removes every character that cannot appear on a plate. */
function normalise(raw) {
  return String(raw || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .replace(/^IND/, '');
}

/** All plausible repairs of a raw OCR string (original first, max 2 edits). */
function candidates(text) {
  const results = [text];
  const seen = new Set(results);
  let frontier = [text];

  for (let depth = 0; depth < 2; depth += 1) {
    const next = [];
    for (const value of frontier) {
      for (let i = 0; i < value.length; i += 1) {
        const replacement = CONFUSABLES[value[i]];
        if (!replacement || !NUMERIC_POSITIONS.has(i)) continue;
        const candidate = value.slice(0, i) + replacement + value.slice(i + 1);
        if (seen.has(candidate)) continue;
        seen.add(candidate);
        results.push(candidate);
        next.push(candidate);
      }
    }
    frontier = next;
    if (!frontier.length) break;
  }
  return results;
}

/**
 * Parses a (possibly noisy) OCR string into a structured plate.
 *
 * @returns {{valid:boolean, vehicleNumber:string|null, state:string|null,
 *   rto:string|null, series:string|null, serial:string|null, raw:string,
 *   normalised:string, repairedFrom:string|null, issues:string[]}}
 */
function parse(raw) {
  const normalised = normalise(raw);
  const base = {
    valid: false,
    vehicleNumber: null,
    state: null,
    rto: null,
    series: null,
    serial: null,
    raw: String(raw || ''),
    normalised,
    repairedFrom: null,
    issues: [],
  };

  let structurallyValid = null;
  for (const candidate of candidates(normalised)) {
    const match = PLATE_PATTERN.exec(candidate);
    if (!match) continue;
    const [, state, rto, series, serial] = match;
    const stateOk = STATE_CODES.includes(state);
    if (!stateOk) {
      // Keep looking for a candidate with a valid state code.
      structurallyValid = structurallyValid || { candidate, match, issues: [`state code ${state} is not a valid Indian state code`] };
      continue;
    }
    const issues = [];
    if (rto.length !== 2) issues.push('RTO code should be two digits');
    return {
      ...base,
      valid: issues.length === 0,
      vehicleNumber: candidate,
      state,
      rto,
      series,
      serial,
      repairedFrom: candidate === normalised ? null : normalised,
      issues,
    };
  }

  if (structurallyValid) {
    return {
      ...base,
      vehicleNumber: structurallyValid.candidate,
      state: structurallyValid.match[1],
      rto: structurallyValid.match[2],
      series: structurallyValid.match[3],
      serial: structurallyValid.match[4],
      repairedFrom: structurallyValid.candidate === normalised ? null : normalised,
      issues: structurallyValid.issues,
    };
  }

  return { ...base, issues: [`"${normalised}" does not match the SS RR LL NNNN plate format`] };
}

/** Best effort repair used for display / logging. */
function repair(raw) {
  const result = parse(raw);
  return result.vehicleNumber || normalise(raw);
}

function isValidNumber(value) {
  return parse(value).valid;
}

module.exports = {
  parse,
  repair,
  normalise,
  candidates,
  isValidNumber,
  STATE_CODES,
  PLATE_PATTERN,
  CONFUSABLES,
  NUMERIC_POSITIONS,
  VOWELS,
};

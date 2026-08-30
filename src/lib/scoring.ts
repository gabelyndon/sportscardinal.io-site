// Scoring for "Guess the Price". A Gaussian in log space: symmetric in
// *ratio* (guessing 2x high hurts the same as guessing 2x low), centered
// on an exact match, and pinned to exactly 0 at a tunable "zero boundary"
// ratio away from the comp.
//
// To retune where the score bottoms out, edit SCORING_CONFIG only — the
// math below derives SIGMA and FLOOR from it and shouldn't need touching.

export const SCORING_CONFIG = {
	/**
	 * The guess/actual ratio (in either direction) at which the score hits
	 * exactly 0. E.g. 4 means a 4x overguess or a 4x underguess (i.e. a
	 * guess at 1/4 of the comp, a 75% underguess) both score 0.
	 */
	zeroBoundaryRatio: 4,
	/**
	 * How many standard deviations out, in log space, the zero boundary
	 * above sits. Larger = a gentler curve (zero boundary pushed further
	 * out in effective terms, more of the curve stays above the floor
	 * before it's subtracted back to 0).
	 */
	zeroBoundarySigmas: 3,
};

const LN_ZERO_RATIO = Math.log(SCORING_CONFIG.zeroBoundaryRatio);
const SIGMA = LN_ZERO_RATIO / SCORING_CONFIG.zeroBoundarySigmas;
const FLOOR = Math.exp(-(SCORING_CONFIG.zeroBoundarySigmas ** 2) / 2);

/** Score >= this counts as a "good" guess and extends the streak. */
export const STREAK_THRESHOLD = 50;

/**
 * 0-100 score for a guess against the actual (comp) price.
 * Guards against bad input: guess <= 0 or non-numeric always returns 0,
 * never NaN.
 */
export function computeScore(guess: number, actual: number): number {
	if (!Number.isFinite(guess) || guess <= 0) return 0;
	if (!Number.isFinite(actual) || actual <= 0) return 0;

	const d = Math.abs(Math.log(guess / actual));
	const raw = Math.exp(-(d * d) / (2 * SIGMA * SIGMA));
	const s = (raw - FLOOR) / (1 - FLOOR);
	return Math.max(0, Math.round(100 * s));
}

/** Plain-language ratio readout, e.g. "you were 1.6x high". */
export function ratioInWords(guess: number, actual: number): string {
	if (!Number.isFinite(guess) || guess <= 0) return "no valid guess entered";
	if (Math.abs(guess - actual) < 0.005) return "spot on — exact match!";

	const over = guess > actual;
	const ratio = over ? guess / actual : actual / guess;
	const rounded = Math.round(ratio * 10) / 10;
	const display = Number.isInteger(rounded) ? rounded.toFixed(0) : rounded.toFixed(1);
	return `you were ${display}x ${over ? "high" : "low"}`;
}

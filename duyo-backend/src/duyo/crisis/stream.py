"""Streaming wrapper around Layer 1 crisis detection.

Live mode transcription arrives in small fragments (often a single word
or sub-word from Gemini's incremental STT). The plain
`KeywordCrisisDetector.check(text)` API would have to be invoked on
every growing prefix, and worse, a transient mis-transcription mid-turn
could downgrade a real signal — disastrous for a safety layer whose
whole job is to never miss a RED utterance.

`StreamCrisisDetector` accumulates fragments and ratchets the level
upwards only: once GREEN → ORANGE → RED, later fragments cannot reduce
it. The buffered text is still surfaced via `.text` so Layer 2 can
classify the full utterance once the turn closes.

Latency: Layer 1 is regex-on-bytes and runs <100ms per check (per TZ
§9.2). Re-checking on every fragment is fine.
"""

from __future__ import annotations

from duyo.crisis.detector import CrisisLevel, CrisisResult, KeywordCrisisDetector


_LEVEL_RANK: dict[CrisisLevel, int] = {
    CrisisLevel.GREEN: 0,
    CrisisLevel.YELLOW: 1,
    CrisisLevel.ORANGE: 2,
    CrisisLevel.RED: 3,
}


class StreamCrisisDetector:
    """Accumulates STT fragments and runs Layer 1 with monotonic escalation."""

    def __init__(self, detector: KeywordCrisisDetector | None = None) -> None:
        self._detector = detector or KeywordCrisisDetector()
        self._buffer: list[str] = []
        self._highest: CrisisResult = CrisisResult(level=CrisisLevel.GREEN)

    @property
    def text(self) -> str:
        return "".join(self._buffer)

    @property
    def result(self) -> CrisisResult:
        return self._highest

    def feed(self, fragment: str) -> CrisisResult:
        """Append `fragment` to the buffer and return the current highest result."""
        if not fragment:
            return self._highest

        self._buffer.append(fragment)
        fresh = self._detector.check(self.text)
        if _LEVEL_RANK[fresh.level] > _LEVEL_RANK[self._highest.level]:
            self._highest = fresh
        return self._highest

    def reset(self) -> None:
        """Clear all state — used between turns when reusing a detector instance."""
        self._buffer.clear()
        self._highest = CrisisResult(level=CrisisLevel.GREEN)

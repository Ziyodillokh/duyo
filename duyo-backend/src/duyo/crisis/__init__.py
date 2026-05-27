"""Crisis Detection — 4-layer architecture per TZ §9.

Layer 1: keyword + pattern matcher (this module — ready)
Layer 2: context-aware AI assessment (Claude classifier — planned)
Layer 3: fine-tuned multilingual BERT classifier (planned)
Layer 4: human review by safety officer (operational, not code)

Philosophy: false positive is safe, false negative costs a life.
When in doubt — alert.
"""

from duyo.crisis.detector import (
    CrisisCategory,
    CrisisLevel,
    CrisisMatch,
    KeywordCrisisDetector,
)

__all__ = ["CrisisCategory", "CrisisLevel", "CrisisMatch", "KeywordCrisisDetector"]

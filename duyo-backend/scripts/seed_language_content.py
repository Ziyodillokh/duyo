#!/usr/bin/env python3
"""CLI: seed a handful of sample "Til" (language) lessons into content_items.

STARTER CONTENT ONLY — mirrors seed_psychology.py's role: without at least a
few published ContentType.LANGUAGE rows, the mobile library's "Til" category
is empty and services/language.py's practice generator always falls back to
free generation (no grounding material). These 6 samples (3 English + 3
Russian, one per age segment) exist to unblock both; real content curation
(more topics, native-speaker review) is a content-ops task, not a code task.

Usage:
    python scripts/seed_language_content.py

Environment:
    DATABASE_URL must be set.
"""

from __future__ import annotations

import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

from duyo.core.database import get_session_factory
from duyo.models.content import ContentItem, ContentType, LicenseStatus, ReviewStatus

_LESSONS = [
    {
        "title": "Ingliz tili: Oilaviy so'zlar",
        "language": "en",
        "age_segment": "junior",
        "body": (
            "Oila a'zolari ingliz tilida:\n\n"
            "mother — ona\nfather — ota\nsister — opa/singil\nbrother — aka/uka\n"
            "grandmother — buvi\ngrandfather — bobo\n\n"
            "Misol gaplar:\n"
            "- This is my mother. (Bu — mening onam.)\n"
            "- I love my family. (Men oilamni yaxshi ko'raman.)"
        ),
    },
    {
        "title": "Ingliz tili: Kundalik fe'llar",
        "language": "en",
        "age_segment": "explorer",
        "body": (
            "Kundalik hayotda ko'p ishlatiladigan fe'llar:\n\n"
            "go — bormoq\neat — yemoq\nplay — o'ynamoq\nstudy — o'qimoq (dars)\n"
            "read — o'qimoq (kitob)\nsleep — uxlamoq\n\n"
            "Misol gaplar:\n"
            "- I go to school every day. (Men har kuni maktabga boraman.)\n"
            "- She reads a book in the evening. (U kechqurun kitob o'qiydi.)"
        ),
    },
    {
        "title": "Ingliz tili: Suhbat iboralari",
        "language": "en",
        "age_segment": "companion",
        "body": (
            "Kundalik suhbatda ishlatiladigan iboralar:\n\n"
            "How are you? — Qalaysiz?\n"
            "Nice to meet you. — Tanishganimdan xursandman.\n"
            "What do you think? — Fikringiz qanday?\n"
            "I agree / I disagree. — Roziman / Rozi emasman.\n\n"
            "Misol suhbat:\n"
            "- A: How are you today? B: I'm good, thank you! And you?"
        ),
    },
    {
        "title": "Rus tili: Oilaviy so'zlar",
        "language": "ru",
        "age_segment": "junior",
        "body": (
            "Семья (oila) so'zlari rus tilida:\n\n"
            "мама — ona\nпапа — ota\nсестра — opa/singil\nбрат — aka/uka\n"
            "бабушка — buvi\nдедушка — bobo\n\n"
            "Misol gaplar:\n"
            "- Это моя мама. (Bu — mening onam.)\n"
            "- Я люблю свою семью. (Men oilamni yaxshi ko'raman.)"
        ),
    },
    {
        "title": "Rus tili: Kundalik fe'llar",
        "language": "ru",
        "age_segment": "explorer",
        "body": (
            "Kundalik hayotda ko'p ishlatiladigan fe'llar:\n\n"
            "идти — bormoq\nесть — yemoq\nиграть — o'ynamoq\nучиться — o'qimoq (dars)\n"
            "читать — o'qimoq (kitob)\nспать — uxlamoq\n\n"
            "Misol gaplar:\n"
            "- Я иду в школу каждый день. (Men har kuni maktabga boraman.)\n"
            "- Она читает книгу вечером. (U kechqurun kitob o'qiydi.)"
        ),
    },
    {
        "title": "Rus tili: Suhbat iboralari",
        "language": "ru",
        "age_segment": "companion",
        "body": (
            "Kundalik suhbatda ishlatiladigan iboralar:\n\n"
            "Как дела? — Qalaysiz?\n"
            "Приятно познакомиться. — Tanishganimdan xursandman.\n"
            "Что ты думаешь? — Fikringiz qanday?\n"
            "Я согласен / Я не согласен. — Roziman / Rozi emasman.\n\n"
            "Misol suhbat:\n"
            "- A: Как дела? B: Хорошо, спасибо! А у тебя?"
        ),
    },
]


async def _run() -> None:
    session_factory = get_session_factory()
    async with session_factory() as session:
        written = 0
        for lesson in _LESSONS:
            item = ContentItem(
                type=ContentType.LANGUAGE,
                title=lesson["title"],
                body=lesson["body"],
                age_segment=lesson["age_segment"],
                language=lesson["language"],
                author="DUYO",
                review_status=ReviewStatus.APPROVED,
                license_status=LicenseStatus.APPROVED,
                published=True,
            )
            session.add(item)
            written += 1
        await session.commit()
        print(f"Seeded {written} language lesson(s).")


def main() -> None:
    asyncio.run(_run())


if __name__ == "__main__":
    main()

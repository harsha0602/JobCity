"""Role classification for ingested jobs.

We want a small, deterministic, explainable bucket so the 3D city shows
**only the roles the user actually cares about** (software + robotics).

⚠️  PATTERN ORDER IS LOAD-BEARING. ``management`` and ``business`` MUST be
checked before ``software``/``product``/``design`` so that titles like
"Engineering Manager" or "Talent Operations - Program Manager" don't get
mis-classified as IC roles. The final ``business`` catch-all (after the
technical buckets) traps loose "Lead/Manager/Director" titles — if you
move the ``software`` bucket above it, manager/lead leaks WILL return.

Categories
==========
- ``software``   — generic SWE / backend / frontend / full-stack / mobile / web / embedded
- ``robotics``   — robotics, autonomy, perception, SLAM, controls, manipulation, mechatronics
- ``ml``         — ML / AI / research scientist / applied scientist / NLP / CV / LLM
- ``data``       — data engineer / analytics engineer / data scientist / BI
- ``security``   — security / cryptography / appsec / red team
- ``infra``      — DevOps / SRE / platform / cloud / reliability
- ``hardware``   — hardware / asic / fpga / silicon / firmware (non-robotics)
- ``design``     — designer / UX / UI / product designer
- ``product``    — product manager / TPM / program manager
- ``management`` — engineering manager / director / VP / head of (people-leadership)
- ``business``   — sales / marketing / ops / finance / legal / hr / talent / recruiting / cs
- ``other``      — anything that didn't match (shouldn't happen often)

The default list of "include in JobCity" categories is :data:`TECHNICAL_IC`
which excludes ``management``, ``business``, ``design``, ``product``, ``other``.
"""
from __future__ import annotations

import re

# Order matters: management is checked BEFORE software so "Engineering Manager"
# doesn't get tagged as software just because it contains "engineer".
_PATTERNS: list[tuple[str, re.Pattern]] = [
    # ── people leaders (exclude from default) ───────────────────────────────
    (
        "management",
        re.compile(
            r"\b("
            r"engineering\s+manager|eng\s+manager|em\b|"
            r"director|vp\b|vice\s+president|"
            r"head\s+of(?!\s+engineering\s+productivity)|"
            r"chief\s+(technology|engineering|product|data|security|ai|information|operating|financial)\s+officer|"
            r"cto|cpo|coo|cio|ciso|cdo|cfo|"
            r"people\s+manager"
            r")\b",
            re.I,
        ),
    ),
    # ── Business / GTM / Talent (excluded — checked BEFORE product/design so
    # "Talent Operations - Program Manager" buckets as business, not product)
    (
        "business",
        re.compile(
            r"\b("
            r"sales|account\s+executive|ae\b|sdr|bdr|"
            r"customer\s+success|cs(m|e)?\b|account\s+manager|"
            r"customer\s+support|support\s+engineer(?!ing)|"  # "support engineer" alone is GTM
            r"marketing|growth\s+marketer|seo|content\s+writer|copywriter|editor|"
            r"finance|accounting|controller|treasury|"
            r"legal|counsel|compliance|paralegal|"
            r"hr\b|people\s+ops|people\s+partner|people\s+consultant|people\s+project|"
            r"talent|recruiter|recruiting|sourcer|"
            r"operations\s+(specialist|associate|coordinator|manager|analyst|insights)|"
            r"business\s+development|partnerships?|business\s+partner|"
            r"executive\s+assistant|administrative\s+assistant|"
            # risk / strategy / audit / tax / fraud / comms / brand
            r"risk\s+(analyst|strategist|strategy|operations|foundations|management)|"
            r"strategy\s+(and|&)\s+operations|company\s+strategy|"
            r"strategist(?!\s+engineer)|"
            r"\baudit\b|\btax\b|\bfraud\b|"
            r"corporate\s+communications|communications\s+(manager|lead|specialist)|"
            r"public\s+relations|\bpr\b|"
            r"brand\s+(lead|manager|specialist|partner)|"
            r"creative\s+(lead|director|producer)(?!\s+engineer)|"
            r"renewals|deal\s+pricing|pricing\s+strategist|"
            r"compensation(?!\s+engineer)|benefits|"
            r"event(s)?\s+(manager|coordinator|lead|producer)|"
            r"campaigns?\s+(manager|lead|specialist)|"
            r"alliance(s)?\s+(lead|manager)|"
            r"underwriter|investigator(?!\s+engineer)|"
            r"analyst\s+relations|investor\s+relations"
            r")\b",
            re.I,
        ),
    ),
    # ── PM / TPM / Program (excluded) ───────────────────────────────────────
    (
        "product",
        re.compile(
            r"\b("
            r"product\s+manager|tpm\b|technical\s+program\s+manager|"
            r"program\s+manager|product\s+marketing|"
            r"product\s+ops|product\s+lead"
            r")\b",
            re.I,
        ),
    ),
    # ── Designers (excluded) ────────────────────────────────────────────────
    (
        "design",
        re.compile(
            r"\b("
            r"product\s+designer|visual\s+designer|"
            r"brand\s+designer|content\s+designer|"
            r"motion\s+designer|graphic\s+designer|"
            r"interaction\s+designer|"
            r"design\s+lead|"
            r"\bux\b|ui\s+designer|"
            r"senior\s+designer|staff\s+designer|principal\s+designer"
            r")\b",
            re.I,
        ),
    ),
    # ── Robotics (INCLUDED — explicit before broader software) ──────────────
    (
        "robotics",
        re.compile(
            r"\b("
            r"robotics?|"
            r"autonomy|autonomous\s+(systems?|vehicles?|driving)|"
            r"slam\b|sensor\s+fusion|"
            r"motion\s+planning|"
            r"manipulation\s+engineer|"
            r"controls?\s+engineer|"
            r"perception\s+engineer|"
            r"mechatronics?|"
            r"actuator|"
            r"drone|uav|uas"
            r")\b",
            re.I,
        ),
    ),
    # ── ML / AI research (INCLUDED) ─────────────────────────────────────────
    (
        "ml",
        re.compile(
            r"\b("
            r"machine\s+learning|ml\s+(engineer|scientist|researcher|infrastructure)|"
            r"deep\s+learning|"
            r"applied\s+(scientist|researcher)|"
            r"research\s+(scientist|engineer|intern)|"
            r"ai\s+(engineer|scientist|researcher|safety)|"
            r"nlp\s+(engineer|scientist)|"
            r"computer\s+vision|cv\s+engineer|"
            r"llm\s+(engineer|scientist|researcher)|"
            r"reinforcement\s+learning"
            r")\b",
            re.I,
        ),
    ),
    # ── Data (INCLUDED) ─────────────────────────────────────────────────────
    (
        "data",
        re.compile(
            r"\b("
            r"data\s+(engineer|scientist|analyst|architect|platform)|"
            r"analytics\s+engineer|"
            r"bi\s+(engineer|analyst|developer)|"
            r"business\s+intelligence"
            r")\b",
            re.I,
        ),
    ),
    # ── Security (INCLUDED) ─────────────────────────────────────────────────
    (
        "security",
        re.compile(
            r"\b("
            r"security\s+(engineer|architect|researcher|specialist|analyst|operations)|"
            r"appsec|application\s+security|"
            r"infosec|information\s+security|"
            r"red\s+team|offensive\s+security|"
            r"cryptography|cryptographer|"
            r"siem|"
            r"penetration\s+tester|pentester"
            r")\b",
            re.I,
        ),
    ),
    # ── Infrastructure / DevOps (INCLUDED) ──────────────────────────────────
    (
        "infra",
        re.compile(
            r"\b("
            r"devops|"
            r"site\s+reliability|sre\b|"
            r"platform\s+engineer|"
            r"infrastructure\s+engineer|"
            r"cloud\s+(engineer|architect)|"
            r"reliability\s+engineer|"
            r"build\s+engineer|"
            r"release\s+engineer"
            r")\b",
            re.I,
        ),
    ),
    # ── Hardware / Embedded / Firmware (INCLUDED) ───────────────────────────
    (
        "hardware",
        re.compile(
            r"\b("
            r"hardware\s+(engineer|design)|"
            r"electrical\s+engineer|"
            r"mechanical\s+engineer|"
            r"asic|fpga|verilog|systemverilog|"
            r"silicon\s+(engineer|design)|"
            r"firmware|"
            r"embedded\s+(engineer|software|systems?)"
            r")\b",
            re.I,
        ),
    ),
    # ── Generic software (INCLUDED — must be LAST technical bucket) ─────────
    (
        "software",
        re.compile(
            r"\b("
            r"software\s+engineer|swe\b|"
            r"backend|back-?end|frontend|front-?end|"
            r"full\s*stack|fullstack|full-?stack|"
            r"mobile\s+engineer|ios\s+engineer|android\s+engineer|"
            r"web\s+engineer|"
            r"systems?\s+engineer|"
            r"developer|programmer|"
            r"engineer(?!\s+manager)|engineering\s+(intern|lead)|"
            r"architect(?!\s+lead\s+sales)"
            r")\b",
            re.I,
        ),
    ),
    # ── Non-technical catch-all (excluded) ──────────────────────────────────
    # Anything that looks like an Analyst/Specialist/Consultant/Coordinator/
    # Investigator/Producer/Manager without an engineering qualifier ends up
    # here so it can be filtered out of the technical-IC view.
    (
        "business",
        re.compile(
            r"\b("
            r"analyst|specialist|consultant|coordinator|investigator|"
            r"producer|strategist|partner|operations|administrator|"
            # generic non-engineering leadership titles
            r"manager|director|lead|head|principal|fellow|"
            r"reporter|accountant|sourcing|community|evangelist|"
            r"writer|journalist|editor|paralegal|trainer|onboarding"
            r")\b",
            re.I,
        ),
    ),
]

#: Categories shown in the 3D city + default `/api/jobs` listing.
TECHNICAL_IC: frozenset[str] = frozenset({
    "software",
    "robotics",
    "ml",
    "data",
    "security",
    "infra",
    "hardware",
})

ALL_CATEGORIES: frozenset[str] = TECHNICAL_IC | frozenset(
    {"design", "product", "management", "business", "other"}
)


def classify(title: str) -> str:
    """Return one of the categories above. Defaults to ``other``."""
    if not title:
        return "other"
    for cat, pat in _PATTERNS:
        if pat.search(title):
            return cat
    return "other"

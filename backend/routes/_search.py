"""Shared helpers for safe user-driven search."""
import re

# Cap query length to bound regex work and avoid pathological inputs.
MAX_Q_LEN = 100


def literal_regex(q: str) -> str:
    """Escape a user-supplied search term so it matches literally.

    Mongo ``$regex`` runs the value as a live PCRE pattern. Passing raw user
    input enables regex/ReDoS injection (e.g. ``(a+)+$`` pins CPU, ``.*``
    matches everything). Escaping turns the input into a literal substring
    match, which is what the UI actually wants.
    """
    return re.escape((q or "")[:MAX_Q_LEN])

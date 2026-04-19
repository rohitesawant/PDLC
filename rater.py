import json
import os
import re
from dataclasses import dataclass

from anthropic import Anthropic

from fetcher import Article

MODEL = "claude-opus-4-7"

SYSTEM_PROMPT = """You are an AI news editor. Rate each article on two axes:
- relevance (0-10): how clearly it's about frontier AI / ML research, products, policy, or industry
- impact (0-10): how consequential the news is for practitioners, investors, or the public

Score conservatively: reserve 9-10 for genuinely landmark stories. Penalise duplicates, thin rewrites, and pure hype.

Return STRICT JSON with shape:
{"ratings":[{"id":<int>,"relevance":<int>,"impact":<int>,"reason":"<one sentence>"}]}
No prose outside JSON."""


@dataclass
class Rating:
    article: Article
    relevance: int
    impact: int
    reason: str

    @property
    def score(self) -> float:
        return 0.5 * self.relevance + 0.5 * self.impact


def _extract_json(text: str) -> dict:
    match = re.search(r"\{.*\}", text, re.DOTALL)
    if not match:
        raise ValueError(f"No JSON object in model response: {text[:200]}")
    return json.loads(match.group(0))


def rate_articles(articles: list[Article]) -> list[Rating]:
    if not articles:
        return []

    client = Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])
    blocks = "\n\n".join(a.to_prompt_block(i) for i, a in enumerate(articles))
    user_msg = (
        f"Rate the following {len(articles)} articles. "
        f"Respond with JSON only.\n\n{blocks}"
    )

    response = client.messages.create(
        model=MODEL,
        max_tokens=4096,
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": user_msg}],
    )
    text = "".join(b.text for b in response.content if b.type == "text")
    data = _extract_json(text)

    ratings: list[Rating] = []
    for item in data.get("ratings", []):
        idx = item.get("id")
        if not isinstance(idx, int) or not (0 <= idx < len(articles)):
            continue
        ratings.append(
            Rating(
                article=articles[idx],
                relevance=int(item.get("relevance", 0)),
                impact=int(item.get("impact", 0)),
                reason=str(item.get("reason", "")).strip(),
            )
        )
    ratings.sort(key=lambda r: r.score, reverse=True)
    return ratings

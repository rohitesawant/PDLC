import html
import re
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from email.utils import parsedate_to_datetime
from typing import Iterable

import feedparser

from feeds import FEEDS


@dataclass
class Article:
    title: str
    link: str
    summary: str
    source: str
    published: datetime

    def to_prompt_block(self, idx: int) -> str:
        return (
            f"[{idx}] Title: {self.title}\n"
            f"Source: {self.source}\n"
            f"Published: {self.published.isoformat()}\n"
            f"Summary: {self.summary[:600]}\n"
        )


_TAG_RE = re.compile(r"<[^>]+>")


def _clean(text: str | None) -> str:
    if not text:
        return ""
    return html.unescape(_TAG_RE.sub("", text)).strip()


def _parse_date(entry) -> datetime:
    for key in ("published", "updated", "created"):
        value = entry.get(key)
        if not value:
            continue
        try:
            dt = parsedate_to_datetime(value)
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            return dt
        except (TypeError, ValueError):
            continue
    return datetime.now(timezone.utc)


def fetch_articles(max_age_hours: int, feeds: Iterable[str] = FEEDS) -> list[Article]:
    cutoff = datetime.now(timezone.utc) - timedelta(hours=max_age_hours)
    articles: list[Article] = []
    seen_links: set[str] = set()

    for feed_url in feeds:
        parsed = feedparser.parse(feed_url)
        source = _clean(parsed.feed.get("title")) or feed_url
        for entry in parsed.entries:
            link = entry.get("link", "").strip()
            if not link or link in seen_links:
                continue
            published = _parse_date(entry)
            if published < cutoff:
                continue
            seen_links.add(link)
            articles.append(
                Article(
                    title=_clean(entry.get("title")),
                    link=link,
                    summary=_clean(entry.get("summary") or entry.get("description")),
                    source=source,
                    published=published,
                )
            )

    articles.sort(key=lambda a: a.published, reverse=True)
    return articles

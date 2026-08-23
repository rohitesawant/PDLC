import argparse
import os
import sys
from datetime import datetime, timezone

from dotenv import load_dotenv

from fetcher import fetch_articles
from rater import Rating, rate_articles
from whatsapp import send_text


def format_digest(ratings: list[Rating], top_n: int) -> str:
    header = f"AI news digest — {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')}"
    if not ratings:
        return f"{header}\n\nNo fresh AI stories met the rating threshold."

    lines = [header, ""]
    for i, r in enumerate(ratings[:top_n], start=1):
        lines.append(
            f"{i}. {r.article.title}  "
            f"[rel {r.relevance}/10 · impact {r.impact}/10]"
        )
        lines.append(f"   {r.article.source} — {r.reason}")
        lines.append(f"   {r.article.link}")
        lines.append("")
    return "\n".join(lines).rstrip()


def main() -> int:
    load_dotenv()
    parser = argparse.ArgumentParser(description="AI news digest to WhatsApp.")
    parser.add_argument(
        "--max-age-hours",
        type=int,
        default=int(os.environ.get("MAX_AGE_HOURS", "24")),
    )
    parser.add_argument(
        "--top-n",
        type=int,
        default=int(os.environ.get("TOP_N", "5")),
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print digest instead of sending to WhatsApp.",
    )
    args = parser.parse_args()

    articles = fetch_articles(max_age_hours=args.max_age_hours)
    print(f"Fetched {len(articles)} articles.", file=sys.stderr)
    if not articles:
        print("Nothing fresh to rate.", file=sys.stderr)
        return 0

    ratings = rate_articles(articles)
    print(f"Rated {len(ratings)} articles.", file=sys.stderr)

    digest = format_digest(ratings, top_n=args.top_n)
    if args.dry_run:
        print(digest)
        return 0

    result = send_text(digest)
    message_id = result.get("messages", [{}])[0].get("id", "?")
    print(f"Sent WhatsApp message {message_id}.", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

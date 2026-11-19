#!/usr/bin/env python3
"""Cortex SCOUT scraping CLI — thin wrapper over Scrapling fetchers.

Usage:
  uv run --project tools/scrapling python tools/scrapling/scrape.py <url> [--stealth] [--css SELECTOR] [--markdown]

Outputs JSON to stdout: {url, status, title, text, links?, error?}
Exit 0 on success, 1 on fetch failure.
"""
import argparse
import json
import sys


def extract(page, css_sel: str | None, want_markdown: bool) -> dict:
    out = {}
    try:
        title = page.css("title::text").get()
        out["title"] = title.strip() if title else None
    except Exception:
        out["title"] = None

    if css_sel:
        try:
            els = page.css(css_sel)
            out["matches"] = [
                " ".join(els[i].get_all_text(separator=" ", strip=True).split())[:500]
                for i in range(min(len(els), 50))
            ]
            out["match_count"] = len(els)
        except Exception as e:
            out["matches_error"] = str(e)[:200]
        return out

    if want_markdown:
        try:
            md = page.get_all_text(separator="\n", strip=True)
            out["text"] = md[:20000]
        except Exception:
            try:
                out["text"] = page.body.get_all_text(separator="\n", strip=True)[:20000]
            except Exception as e:
                out["text_error"] = str(e)[:200]
    else:
        try:
            out["text"] = page.get_all_text(separator="\n", strip=True)[:12000]
        except Exception:
            out["text"] = ""
    return out


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("url")
    ap.add_argument("--stealth", action="store_true", help="use StealthyFetcher (headless Chromium, anti-bot)")
    ap.add_argument("--css", dest="css_sel", help="CSS selector; returns matching text nodes instead of body")
    ap.add_argument("--markdown", action="store_true", help="alias for full-text extraction (default)")
    args = ap.parse_args()

    result = {"url": args.url}
    try:
        if args.stealth:
            from scrapling.fetchers import StealthyFetcher
            page = StealthyFetcher.fetch(args.url, headless=True)
        else:
            from scrapling.fetchers import Fetcher
            page = Fetcher.get(args.url)
        result.update(extract(page, args.css_sel, True))
        result["status"] = "ok"
    except Exception as e:
        result["status"] = "error"
        result["error"] = str(e)[:500]
        print(json.dumps(result))
        return 1

    print(json.dumps(result))
    return 0


if __name__ == "__main__":
    sys.exit(main())

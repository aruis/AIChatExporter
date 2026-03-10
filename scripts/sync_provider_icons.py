#!/usr/bin/env python3
"""Sync provider SVG icons into local extension resources.

This script vendors community-maintained brand icons so the extension can keep
using local assets without hand-maintaining SVG files provider by provider.
"""

from __future__ import annotations

import argparse
import pathlib
import subprocess
import sys
import urllib.error
import urllib.request
from dataclasses import dataclass


PROJECT_ROOT = pathlib.Path(__file__).resolve().parent.parent
ICON_DIR = PROJECT_ROOT / "AIChatExporter Extension" / "Resources" / "images" / "providers"
SIMPLE_ICONS_RAW = "https://raw.githubusercontent.com/simple-icons/simple-icons/develop/icons"


@dataclass(frozen=True)
class IconSpec:
    provider_id: str
    source_url: str
    output_name: str

    @property
    def output_path(self) -> pathlib.Path:
        return ICON_DIR / self.output_name


ICON_SPECS = (
    IconSpec(
        "kimi",
        "https://moonshotai.github.io/Branding-Guide/scenarios/04-k-only/k-only-color.svg",
        "kimi-logo.svg",
    ),
    IconSpec(
        "chatgpt",
        "https://commons.wikimedia.org/wiki/Special:FilePath/ChatGPT-Logo.svg",
        "chatgpt-logo.svg",
    ),
    IconSpec(
        "claude",
        f"{SIMPLE_ICONS_RAW}/claude.svg",
        "claude-logo.svg",
    ),
    IconSpec(
        "gemini",
        f"{SIMPLE_ICONS_RAW}/googlegemini.svg",
        "gemini-logo.svg",
    ),
    IconSpec(
        "perplexity",
        f"{SIMPLE_ICONS_RAW}/perplexity.svg",
        "perplexity-logo.svg",
    ),
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Sync local provider SVG icons from curated community sources.")
    parser.add_argument(
        "--provider",
        action="append",
        dest="providers",
        help="Only sync specific provider IDs. Can be passed multiple times.",
    )
    parser.add_argument(
        "--list",
        action="store_true",
        help="List supported provider IDs and exit.",
    )
    return parser.parse_args()


def list_supported_specs() -> None:
    for spec in ICON_SPECS:
        print(f"{spec.provider_id}: {spec.source_url} -> {spec.output_path}")


def select_specs(provider_ids: list[str] | None) -> list[IconSpec]:
    if not provider_ids:
        return list(ICON_SPECS)

    wanted = {item.strip().lower() for item in provider_ids if item.strip()}
    selected = [spec for spec in ICON_SPECS if spec.provider_id in wanted]
    missing = sorted(wanted - {spec.provider_id for spec in selected})
    if missing:
        available = ", ".join(spec.provider_id for spec in ICON_SPECS)
        raise SystemExit(f"Unknown provider IDs: {', '.join(missing)}. Available: {available}")
    return selected


def fetch_svg(url: str) -> str:
    request = urllib.request.Request(url, headers={"User-Agent": "AIChatExporter/1.0"})
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            content_type = response.headers.get("Content-Type", "")
            payload = response.read().decode("utf-8")
    except urllib.error.URLError:
        try:
          completed = subprocess.run(
              ["curl", "-fsSL", url],
              check=True,
              capture_output=True,
              text=True,
          )
          content_type = "image/svg+xml"
          payload = completed.stdout
        except subprocess.CalledProcessError as error:
          raise SystemExit(f"Failed to download {url}: {error}") from error

    if "<svg" not in payload:
        raise SystemExit(f"Unexpected response for {url}: not an SVG payload ({content_type})")
    return payload.strip() + "\n"


def sync_spec(spec: IconSpec) -> None:
    svg = fetch_svg(spec.source_url)
    spec.output_path.parent.mkdir(parents=True, exist_ok=True)
    spec.output_path.write_text(svg, encoding="utf-8")
    print(f"synced {spec.provider_id} -> {spec.output_path}")


def main() -> None:
    args = parse_args()
    if args.list:
        list_supported_specs()
        return

    specs = select_specs(args.providers)
    for spec in specs:
        sync_spec(spec)


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        sys.exit(130)

#!/usr/bin/env python3
"""Generate logo variants via domestic AI image providers.

Supports:
- Doubao/Ark image generation API style (`/api/v3/images/generations`)
- Generic OpenAI-compatible image generation endpoints
"""

from __future__ import annotations

import argparse
import base64
import json
import os
import pathlib
import sys
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass
from typing import Any


DEFAULT_SIZE = "2K"
DEFAULT_FORMAT = "png"
DEFAULT_QUALITY = "high"

DEFAULT_BRAND_PROMPT = (
    "Design a modern, minimal app logo for 'AIChatExporter'. "
    "Theme: exporting AI conversations into clean documents. "
    "Visual hints: chat bubble + export arrow + document edge. "
    "Flat icon style, strong silhouette, centered composition, no watermark, no mockup background."
)


@dataclass(frozen=True)
class ProviderConfig:
    name: str
    api_key_env: str
    base_url_env: str
    model_env: str
    endpoint_path: str
    default_base_url: str
    default_response_format: str


PROVIDERS: dict[str, ProviderConfig] = {
    "qwen": ProviderConfig(
        name="Qwen-Compatible",
        api_key_env="DASHSCOPE_API_KEY",
        base_url_env="DASHSCOPE_BASE_URL",
        model_env="DASHSCOPE_IMAGE_MODEL",
        endpoint_path="/images/generations",
        default_base_url="",
        default_response_format="b64_json",
    ),
    "doubao": ProviderConfig(
        name="Doubao/Ark",
        api_key_env="ARK_API_KEY",
        base_url_env="ARK_BASE_URL",
        model_env="ARK_IMAGE_MODEL",
        endpoint_path="/api/v3/images/generations",
        default_base_url="https://ark.cn-beijing.volces.com",
        default_response_format="url",
    ),
    "compatible": ProviderConfig(
        name="OpenAI-Compatible",
        api_key_env="IMAGE_API_KEY",
        base_url_env="IMAGE_API_BASE_URL",
        model_env="IMAGE_API_MODEL",
        endpoint_path="/images/generations",
        default_base_url="",
        default_response_format="b64_json",
    ),
}


def die(message: str, code: int = 1) -> None:
    print(f"Error: {message}", file=sys.stderr)
    raise SystemExit(code)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Generate logo variants with domestic AI providers.")
    parser.add_argument("--provider", choices=sorted(PROVIDERS.keys()), default="qwen")
    parser.add_argument("--prompt", default=DEFAULT_BRAND_PROMPT)
    parser.add_argument("--size", default=DEFAULT_SIZE)
    parser.add_argument("--quality", default=DEFAULT_QUALITY)
    parser.add_argument("--n", type=int, default=4)
    parser.add_argument("--format", choices=["png", "jpeg", "webp"], default=DEFAULT_FORMAT)
    parser.add_argument("--response-format", choices=["url", "b64_json"], default=None)
    parser.add_argument("--sequential-image-generation", choices=["disabled", "enabled"], default="disabled")
    parser.add_argument("--watermark", choices=["true", "false"], default="true")
    parser.add_argument("--stream", choices=["true", "false"], default="false")
    parser.add_argument("--out-dir", default="output/imagegen")
    parser.add_argument("--prefix", default="aichatexporter-logo")
    parser.add_argument("--dry-run", action="store_true")
    return parser.parse_args()


def read_provider_runtime(config: ProviderConfig) -> tuple[str, str, str]:
    api_key = os.getenv(config.api_key_env, "").strip()
    # Be tolerant to common Volcengine env naming in local shells.
    if config.api_key_env == "ARK_API_KEY" and not api_key:
        api_key = (
            os.getenv("VOLCENGINE_KEY", "").strip()
            or os.getenv("volcengine_key", "").strip()
        )
    base_url = os.getenv(config.base_url_env, "").strip() or config.default_base_url
    model = os.getenv(config.model_env, "").strip()

    missing = []
    if not api_key:
        missing.append(config.api_key_env)
    if not base_url:
        missing.append(config.base_url_env)
    if not model:
        missing.append(config.model_env)

    if missing:
        die(
            f"Missing env vars for {config.name}: {', '.join(missing)}. "
            "Set them and retry."
        )

    return api_key, base_url.rstrip("/"), model


def build_payload(args: argparse.Namespace, model: str, provider: str) -> dict[str, Any]:
    payload: dict[str, Any] = {
        "model": model,
        "prompt": args.prompt,
        "size": args.size,
        "quality": args.quality,
        "n": args.n,
        "response_format": args.response_format,
        "output_format": args.format,
    }
    if provider == "doubao":
        payload["sequential_image_generation"] = args.sequential_image_generation
        payload["stream"] = args.stream == "true"
        payload["watermark"] = args.watermark == "true"
    return payload


def post_json(url: str, api_key: str, payload: dict[str, Any]) -> dict[str, Any]:
    request = urllib.request.Request(
        url=url,
        method="POST",
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {api_key}",
        },
        data=json.dumps(payload).encode("utf-8"),
    )

    try:
        with urllib.request.urlopen(request, timeout=120) as response:
            body = response.read().decode("utf-8")
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")
        die(f"HTTP {exc.code}: {detail}")
    except urllib.error.URLError as exc:
        die(f"Network error: {exc}")

    try:
        return json.loads(body)
    except json.JSONDecodeError:
        die(f"Non-JSON response: {body[:500]}")


def download_binary(url: str) -> bytes:
    try:
        with urllib.request.urlopen(url, timeout=120) as response:
            return response.read()
    except urllib.error.URLError as exc:
        die(f"Failed to download image URL: {exc}")


def extract_images(response_json: dict[str, Any]) -> list[bytes]:
    data = response_json.get("data")
    if not isinstance(data, list) or not data:
        die(f"Unexpected response format: missing 'data' list. Raw: {json.dumps(response_json)[:800]}")

    images: list[bytes] = []
    for item in data:
        if not isinstance(item, dict):
            continue

        b64_json = item.get("b64_json")
        if isinstance(b64_json, str) and b64_json:
            images.append(base64.b64decode(b64_json))
            continue

        url = item.get("url")
        if isinstance(url, str) and url:
            images.append(download_binary(url))
            continue

    if not images:
        die(f"No decodable images found in response. Raw: {json.dumps(response_json)[:800]}")

    return images


def save_images(images: list[bytes], out_dir: pathlib.Path, prefix: str, ext: str) -> None:
    out_dir.mkdir(parents=True, exist_ok=True)
    for idx, image_bytes in enumerate(images, start=1):
        out_path = out_dir / f"{prefix}-{idx}.{ext}"
        out_path.write_bytes(image_bytes)
        print(str(out_path))


def main() -> None:
    args = parse_args()

    if args.n < 1 or args.n > 10:
        die("--n must be in range [1, 10]")

    config = PROVIDERS[args.provider]
    api_key, base_url, model = read_provider_runtime(config)
    response_format = args.response_format or config.default_response_format
    args.response_format = response_format
    endpoint = f"{base_url.rstrip('/')}{config.endpoint_path}"
    payload = build_payload(args, model, args.provider)

    if args.dry_run:
        print(json.dumps({"endpoint": endpoint, "payload": payload}, indent=2, ensure_ascii=False))
        return

    result = post_json(endpoint, api_key, payload)
    images = extract_images(result)
    save_images(images, pathlib.Path(args.out_dir), args.prefix, args.format)


if __name__ == "__main__":
    main()

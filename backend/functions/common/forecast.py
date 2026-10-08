"""Fetch the hourly PM2.5 forecast from Open-Meteo, with a DynamoDB cache.

The cache is skipped when TABLE_NAME is not set (local runs).
"""

import json
import os
import time
import urllib.error
import urllib.request
from datetime import datetime, timedelta, timezone

from core import openmeteo

CACHE_SECONDS = 3 * 3600   # CAMS updates about twice a day
FORECAST_DAYS = 3          # today, tomorrow, and a spare day


class UpstreamError(Exception):
    """Open-Meteo could not be reached or returned an error."""


def fetch_json(url, timeout=20):
    try:
        with urllib.request.urlopen(url, timeout=timeout) as resp:
            return json.load(resp)
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as e:
        raise UpstreamError(f"Open-Meteo request failed: {e}") from e


def cache_key(lat, lon, tz):
    """Points within about 1 km share a key; the model grid is ~45 km anyway."""
    return f"FORECAST#{lat:.2f}#{lon:.2f}#{tz}"


def iso_utc(ts):
    return datetime.fromtimestamp(ts, timezone.utc).isoformat(timespec="seconds")


def local_tomorrow(utc_offset_seconds, now=None):
    """Tomorrow's date at the school, from the offset Open-Meteo reports."""
    local = datetime.fromtimestamp(now if now is not None else time.time(), timezone.utc) \
        + timedelta(seconds=utc_offset_seconds)
    return (local.date() + timedelta(days=1)).isoformat()


def get_forecast(lat, lon, tz, cache=None, fetch=fetch_json, now=None):
    """{"days": {date: [24 values]}, "utc_offset_seconds", "grid_point", "fetched_at",
    "source", "url", "cached"}"""
    now = now if now is not None else time.time()
    key = cache_key(lat, lon, tz)
    if cache:
        hit = cache.get(key)
        if hit and hit["expires_at"] > now:
            return {**hit["data"], "cached": True}

    url = openmeteo.forecast_url(lat, lon, days=FORECAST_DAYS, timezone=tz)
    raw = fetch(url)
    try:
        days = openmeteo.hourly_by_date(raw)
    except ValueError as e:
        raise UpstreamError(str(e)) from e
    data = {
        "days": {d: [hours.get(h) for h in range(24)] for d, hours in sorted(days.items())},
        "utc_offset_seconds": raw["utc_offset_seconds"],
        "grid_point": {"latitude": raw.get("latitude"), "longitude": raw.get("longitude")},
        "fetched_at": iso_utc(now),
        "source": openmeteo.ATTRIBUTION,
        "url": url,
    }
    if cache:
        cache.put(key, data, now + CACHE_SECONDS)
    return {**data, "cached": False}


class DynamoCache:
    """ForecastCache items in the single table: pk=FORECAST#..., sk=LATEST."""

    def __init__(self, table_name, client=None):
        if client is None:
            import boto3  # in the Lambda runtime; not needed for local tests
            client = boto3.client("dynamodb")
        self.table, self.client = table_name, client

    def get(self, key):
        item = self.client.get_item(TableName=self.table,
                                    Key={"pk": {"S": key}, "sk": {"S": "LATEST"}}).get("Item")
        if not item:
            return None
        return {"data": json.loads(item["data"]["S"]), "expires_at": int(item["expires_at"]["N"])}

    def put(self, key, data, expires_at):
        self.client.put_item(TableName=self.table, Item={
            "pk": {"S": key}, "sk": {"S": "LATEST"},
            "data": {"S": json.dumps(data)},
            "expires_at": {"N": str(int(expires_at))},
        })


def cache_from_env():
    name = os.environ.get("TABLE_NAME")
    return DynamoCache(name) if name else None

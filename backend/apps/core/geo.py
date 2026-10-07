"""Geofence helpers."""

import math

EARTH_RADIUS_M = 6_371_000


def haversine_m(lat1, lng1, lat2, lng2) -> float:
    """Great-circle distance in metres between two lat/lng points."""
    p1, p2 = math.radians(float(lat1)), math.radians(float(lat2))
    dp = p2 - p1
    dl = math.radians(float(lng2) - float(lng1))
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * EARTH_RADIUS_M * math.asin(math.sqrt(a))


def within_geofence(site_lat, site_lng, radius_m, lat, lng) -> bool:
    if site_lat is None or site_lng is None:
        return True  # site without coordinates: no geofence configured
    if lat is None or lng is None:
        return False
    return haversine_m(site_lat, site_lng, lat, lng) <= float(radius_m or 0)

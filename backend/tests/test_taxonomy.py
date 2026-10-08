"""Ops trade taxonomy + /ref/trades filtering — docs/CONTRACT-EXTENSIONS.md §2."""

import pytest

from apps.audit.models import AuditLog
from apps.workers.models import Trade

pytestmark = pytest.mark.django_db


def test_list_requires_staff(owner_client):
    assert owner_client.get("/api/v1/ops/taxonomy/trades").status_code == 403


def test_list_with_counts_and_filters(staff_client):
    res = staff_client.get("/api/v1/ops/taxonomy/trades", {"page_size": 100})
    assert res.status_code == 200
    rows = res.json()["results"]
    assert any(r["code"] == "cook" for r in rows)
    assert {"workers_count", "jobs_count", "category_label", "is_active"} <= set(rows[0])
    res = staff_client.get("/api/v1/ops/taxonomy/trades", {"category": "security"})
    assert all(r["category"] == "security" for r in res.json()["results"])


def test_create_trade(staff_client):
    body = {
        "code": "solar_tech",
        "name_en": "Solar technician",
        "name_ne": "सोलार प्राविधिक",
        "category": "general",
    }
    res = staff_client.post("/api/v1/ops/taxonomy/trades", body, format="json")
    assert res.status_code == 201, res.content
    assert res.json()["is_active"] is True
    assert AuditLog.objects.filter(action="ops.taxonomy.trade.create", object_id="solar_tech").exists()
    dup = staff_client.post("/api/v1/ops/taxonomy/trades", body, format="json")
    assert dup.status_code == 400 and dup.json()["error"]["code"] == "duplicate"


def test_patch_code_is_immutable(staff_client):
    res = staff_client.patch(
        "/api/v1/ops/taxonomy/trades/cook", {"code": "chef", "name_en": "Cook / Chef"}, format="json"
    )
    assert res.status_code == 200, res.content
    assert res.json()["code"] == "cook"
    assert Trade.objects.get(code="cook").name_en == "Cook / Chef"
    assert not Trade.objects.filter(code="chef").exists()


def test_deactivated_trade_hidden_from_ref(staff_client, api):
    res = staff_client.patch("/api/v1/ops/taxonomy/trades/cook", {"is_active": False}, format="json")
    assert res.status_code == 200
    assert AuditLog.objects.filter(action="ops.taxonomy.trade.update", object_id="cook").exists()
    codes = [t["code"] for t in api.get("/api/v1/ref/trades").json()]
    assert "cook" not in codes and codes
    all_codes = [t["code"] for t in api.get("/api/v1/ref/trades", {"all": "1"}).json()]
    assert "cook" in all_codes
    inactive = staff_client.get("/api/v1/ops/taxonomy/trades", {"is_active": "false"}).json()["results"]
    assert [t["code"] for t in inactive] == ["cook"]

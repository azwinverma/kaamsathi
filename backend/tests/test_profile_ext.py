"""Worker spoken languages (E004), profile completeness (E008), trade aliases (F004)."""

import pytest

from apps.audit.models import AuditLog
from apps.workers.models import TradeAlias, WorkerLanguage
from apps.workers.services import matching_trade_codes, profile_completeness
from tests import factories as f
from tests.conftest import auth_client

pytestmark = pytest.mark.django_db


@pytest.fixture
def me():
    user = f.UserFactory()
    worker = f.WorkerFactory(user=user, phone=user.phone)
    return worker, auth_client(user)


def test_me_worker_languages_roundtrip_and_completeness(me):
    worker, client = me
    r = client.get("/api/v1/me/worker")
    assert r.status_code == 200
    assert r.json()["languages"] == []
    pc = r.json()["profile_completeness"]
    assert pc["percent"] == 0
    assert "languages" in pc["missing"] and len(pc["items"]) == 8

    r = client.patch(
        "/api/v1/me/worker",
        {
            "languages": [
                {"language": "ne", "proficiency": "native"},
                {"language": "hi", "proficiency": "basic"},
            ]
        },
        format="json",
    )
    assert r.status_code == 200, r.json()
    langs = {x["language"]: x for x in r.json()["languages"]}
    assert langs["ne"]["proficiency"] == "native" and langs["ne"]["language_label"] == "Nepali"
    assert "languages" not in r.json()["profile_completeness"]["missing"]
    assert r.json()["profile_completeness"]["percent"] == 12  # 1 of 8

    # replace: hi removed, en added
    r = client.patch("/api/v1/me/worker", {"languages": [{"language": "en"}]}, format="json")
    assert [x["language"] for x in r.json()["languages"]] == ["en"]
    assert WorkerLanguage.objects.filter(worker=worker).count() == 1


@pytest.mark.parametrize(
    "payload,field",
    [
        ({"languages": [{"language": "xx"}]}, "languages.0.language"),
        ({"languages": [{"language": "ne", "proficiency": "expert"}]}, "languages.0.proficiency"),
        ({"languages": [{"language": "ne"}, {"language": "ne"}]}, "languages"),
    ],
)
def test_language_validation(me, payload, field):
    _, client = me
    r = client.patch("/api/v1/me/worker", payload, format="json")
    assert r.status_code == 400
    assert field in r.json()["error"]["fields"]


def test_ops_worker_edit_languages_and_passport(staff_client):
    w = f.WorkerFactory()
    r = staff_client.patch(
        f"/api/v1/ops/workers/{w.id}",
        {"languages": [{"language": "ko", "proficiency": "fluent"}]},
        format="json",
    )
    assert r.status_code == 200, r.json()
    d = staff_client.get(f"/api/v1/ops/workers/{w.id}").json()
    assert d["languages"][0]["language"] == "ko"
    assert "profile_completeness" in d
    r = staff_client.get("/api/v1/ops/workers", {"language": "ko"})
    assert [x["id"] for x in r.json()["results"]] == [str(w.id)]

    from apps.credentials.services import passport_payload

    payload = passport_payload(w, include_contact=False, verify_url="x")
    assert payload["languages"][0]["proficiency"] == "fluent"


def test_profile_completeness_full():
    from decimal import Decimal

    from django.core.files.uploadedfile import SimpleUploadedFile

    from apps.credentials.models import Credential

    w = f.WorkerFactory(
        citizenship_no="12-34",
        expected_monthly_wage=Decimal("20000"),
        payment_method="esewa",
        wallet_id="9800000000",
    )
    w.photo = SimpleUploadedFile("p.png", b"x")
    w.id_front = SimpleUploadedFile("i.png", b"x")
    w.save()
    f.WorkerSkillFactory(worker=w)
    WorkerLanguage.objects.create(worker=w, language="ne", proficiency="native")
    f.EmploymentFactory(worker=w)
    assert profile_completeness(w)["missing"] == ["verified_credential"]
    Credential.objects.create(worker=w, kind="safety", title="Safety", issuer="X", status="verified")
    pc = profile_completeness(w)
    assert pc["percent"] == 100 and pc["missing"] == []


def test_payment_details_rules():
    w = f.WorkerFactory(payment_method="cash")
    assert "payment_details" in profile_completeness(w)["missing"]
    w.payment_method, w.bank_name, w.bank_account_no = "bank", "NIC Asia", "0011"
    w.save()
    assert "payment_details" not in profile_completeness(w)["missing"]


# --------------------------------------------------------------------------- aliases
def test_ops_taxonomy_aliases_crud_and_search(staff_client):
    r = staff_client.post(
        "/api/v1/ops/taxonomy/trades/cook/aliases", {"alias": "Bhanse", "language": "ne_rom"}
    )
    assert r.status_code == 201, r.json()
    alias_id = r.json()["id"]
    assert r.json()["language_label"]
    assert AuditLog.objects.filter(action="ops.taxonomy.alias.create").exists()
    # duplicate (case-insensitive) on the same trade
    r = staff_client.post("/api/v1/ops/taxonomy/trades/cook/aliases", {"alias": "bhanse"})
    assert r.status_code == 400 and r.json()["error"]["code"] == "duplicate"
    lst = staff_client.get("/api/v1/ops/taxonomy/trades/cook/aliases").json()
    assert [a["alias"] for a in lst] == ["Bhanse"]
    trades = staff_client.get("/api/v1/ops/taxonomy/trades", {"q": "cook"}).json()
    cook = next(t for t in (trades.get("results", trades)) if t["code"] == "cook")
    assert cook["aliases"][0]["alias"] == "Bhanse"

    assert "cook" in matching_trade_codes("bhan")
    # ops worker search by alias
    w = f.WorkerFactory()
    f.WorkerSkillFactory(worker=w, trade=f.trade("cook"))
    other = f.WorkerFactory()
    f.WorkerSkillFactory(worker=other, trade=f.trade("mason"))
    ids = [x["id"] for x in staff_client.get("/api/v1/ops/workers", {"trade_q": "bhanse"}).json()["results"]]
    assert str(w.id) in ids and str(other.id) not in ids
    # public reference search
    from rest_framework.test import APIClient

    codes = [t["code"] for t in APIClient().get("/api/v1/ref/trades", {"q": "BHANSE"}).json()]
    assert codes == ["cook"]

    r = staff_client.delete(f"/api/v1/ops/taxonomy/trades/cook/aliases/{alias_id}")
    assert r.status_code == 204
    assert not TradeAlias.objects.exists()


def test_job_search_matches_alias(owner_client, org):
    TradeAlias.objects.create(trade=f.trade("cook"), alias="bhanse", language="ne_rom")
    job = f.JobFactory(organization=org, title="Kitchen staff", trade=f.trade("cook"))
    f.JobFactory(organization=org, title="Builder", trade=f.trade("mason"))
    r = owner_client.get("/api/v1/org/jobs", {"q": "bhanse"})
    assert [j["id"] for j in r.json()["results"]] == [str(job.id)]


def test_alias_endpoints_need_superadmin(db):
    from apps.accounts.models import StaffProfile

    user = f.UserFactory(is_staff=True)
    StaffProfile.objects.create(user=user, roles=["verifier"])
    r = auth_client(user).post("/api/v1/ops/taxonomy/trades/cook/aliases", {"alias": "x1"})
    assert r.status_code == 403

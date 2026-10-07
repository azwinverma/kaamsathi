import pytest
from django.core.management import call_command
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from tests import factories as f


@pytest.fixture(scope="session")
def django_db_setup(django_db_setup, django_db_blocker):
    """Seed provinces, districts, trades, minimum wage, tax slabs, national holidays once."""
    with django_db_blocker.unblock():
        call_command("seed_reference", verbosity=0)


@pytest.fixture
def api():
    return APIClient()


def auth_client(user, org=None):
    client = APIClient()
    token = RefreshToken.for_user(user)
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {token.access_token}")
    if org is not None:
        client.credentials(HTTP_AUTHORIZATION=f"Bearer {token.access_token}", HTTP_X_ORG_ID=str(org.id))
    return client


@pytest.fixture
def org(db):
    return f.OrganizationFactory()


@pytest.fixture
def site(org):
    return f.SiteFactory(organization=org)


@pytest.fixture
def owner(org):
    return f.MembershipFactory(organization=org, role="owner").user


@pytest.fixture
def owner_client(owner, org):
    return auth_client(owner, org)


@pytest.fixture
def make_member(org):
    def _make(role, sites=()):
        m = f.MembershipFactory(organization=org, role=role, sites=list(sites))
        return m.user, auth_client(m.user, org)

    return _make


@pytest.fixture
def staff_client(db):
    user = f.UserFactory(is_staff=True)
    return auth_client(user)

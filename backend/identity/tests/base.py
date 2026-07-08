from django.contrib.auth import get_user_model
from django.core.management import call_command

from hierarchy import services
from hierarchy.models import NodeType

User = get_user_model()


def make_user(username, **kwargs):
    return User.objects.create_user(
        username=username, email=f'{username}@example.com', password='x',
        first_name=username.title(), last_name='T', **kwargs,
    )


def build_tree():
    """National -> Region 63 -> Prov 9 -> Zone 1 -> {Area A -> Parish A, Area B},
    plus a second Region 30 for isolation tests."""
    national = services.create_root('RCCG National')
    r1 = services.add_child(national, NodeType.REGION, 'Region 63')
    r2 = services.add_child(national, NodeType.REGION, 'Region 30')
    prov = services.add_child(r1, NodeType.PROVINCE, 'Prov 9')
    zone = services.add_child(prov, NodeType.ZONE, 'Zone 1')
    area_a = services.add_child(zone, NodeType.AREA, 'Area A')
    area_b = services.add_child(zone, NodeType.AREA, 'Area B')
    parish_a = services.add_child(area_a, NodeType.PARISH, 'Parish A')
    return dict(national=national, r1=r1, r2=r2, prov=prov, zone=zone,
                area_a=area_a, area_b=area_b, parish_a=parish_a)


def seed_rbac():
    call_command('seed_rbac', verbosity=0)

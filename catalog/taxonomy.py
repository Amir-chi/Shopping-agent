"""Top-level shopping departments over the dataset's 3,428 flat leaf categories.

taxonomy.json maps every leaf category to one department. It was re-classified on 2026-10-23 with the Codex CLI
from each category's name plus its three best-stocked product titles; `manage.py classify_categories` fills in new
leaves. It is reviewed as data, so runtime needs no AI."""
import json
from functools import lru_cache
from pathlib import Path

# (id, Persian name, icon name in catalog.js)
GROUPS = [
    ('mobile', 'موبایل و تبلت', 'mobile'), ('digital', 'کالای دیجیتال', 'laptop'),
    ('appliances', 'لوازم خانگی برقی', 'appliance'), ('home', 'خانه و آشپزخانه', 'sofa'),
    ('fashion', 'مد و پوشاک', 'shirt'), ('jewelry', 'طلا، جواهر و ساعت', 'gem'),
    ('beauty', 'آرایشی، بهداشتی و عطر', 'beauty'),
    ('lighting', 'روشنایی و نورپردازی', 'bulb'), ('electrical', 'برق ساختمان و تأسیسات', 'plug'),
    ('industrial', 'ابزار و تجهیزات صنعتی', 'tool'), ('auto', 'خودرو و موتورسیکلت', 'car'),
    ('health', 'سلامت و پزشکی', 'heart'), ('sports', 'ورزش، سفر و سرگرمی', 'ball'),
    ('kids', 'کودک، نوزاد و اسباب‌بازی', 'toy'), ('office', 'کتاب، لوازم‌التحریر و اداری', 'book'),
    ('food', 'سوپرمارکت', 'basket'), ('other', 'حیوانات خانگی و سایر', 'grid'),
]
GROUP_IDS = {g[0] for g in GROUPS}
PATH = Path(__file__).with_name('taxonomy.json')


@lru_cache(maxsize=1)
def mapping():
    return json.loads(PATH.read_text(encoding='utf-8')) if PATH.is_file() else {}


def group_of(category):
    return mapping().get(category, 'other')


def leaves(group):
    if group not in GROUP_IDS:
        raise ValueError('Unknown department')
    return [leaf for leaf, g in mapping().items() if g == group]


# Sellers sometimes file a product under a wrong leaf (a body gel under «کتاب چاپی»). product_departments.json lists
# such products with their real department; it was built on 2026-10-23 from titles that share no common word with
# their own category, each judged by the Codex CLI. Only real moves are listed.
MOVED = Path(__file__).with_name('product_departments.json')


@lru_cache(maxsize=1)
def moved():
    return json.loads(MOVED.read_text(encoding='utf-8')) if MOVED.is_file() else {}


def department(product_id, category):
    return moved().get(product_id) or group_of(category)


def moved_out(category):
    """Listings filed under this leaf that really belong to another department."""
    return [pid for pid, g in moved().items() if g != group_of(category)]


def in_department(group):
    """ORM filter for a department's products: its leaves, minus listings moved out, plus listings moved in."""
    from django.db.models import Q
    out = [pid for pid, g in moved().items() if g != group]
    into = [pid for pid, g in moved().items() if g == group]
    return (Q(category__in=leaves(group)) & ~Q(pk__in=out)) | Q(pk__in=into)

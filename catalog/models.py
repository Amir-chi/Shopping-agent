from django.contrib.postgres.indexes import GinIndex
from django.contrib.postgres.search import SearchVectorField
from django.db import models


class Product(models.Model):
    id = models.CharField(primary_key=True, max_length=80)
    title = models.TextField()
    category = models.TextField(db_index=True)
    brand = models.TextField(null=True, blank=True)
    raw = models.JSONField()
    search_text = models.TextField(blank=True)
    search_document = SearchVectorField(null=True)
    low = models.BigIntegerField(null=True)
    high = models.BigIntegerField(null=True)
    stores = models.PositiveIntegerField(default=0)

    class Meta:
        indexes = [GinIndex(fields=['search_document'], name='product_search_gin')]

    def __str__(self):
        return self.title


class VideoReviewCache(models.Model):
    """Shared, expiring results and a short lease to deduplicate paid provider calls."""
    key = models.CharField(primary_key=True, max_length=64)
    payload = models.JSONField(default=dict)
    expires_at = models.DateTimeField(db_index=True)
    locked_until = models.DateTimeField(null=True)


class Shop(models.Model):
    id = models.CharField(primary_key=True, max_length=80)
    name = models.TextField()
    area = models.TextField(db_index=True)
    lat = models.FloatField()
    lon = models.FloatField()
    installment = models.BooleanField(default=False)
    address = models.TextField(blank=True)
    categories = models.JSONField(default=list)
    raw = models.JSONField()

    class Meta:
        indexes = [GinIndex(fields=['categories'], name='shop_categories_gin')]

    def __str__(self):
        return self.name


class Offer(models.Model):
    id = models.CharField(primary_key=True, max_length=80)
    product = models.ForeignKey(Product, on_delete=models.PROTECT, related_name='offers')
    shop = models.ForeignKey(Shop, on_delete=models.PROTECT, related_name='offers')
    price = models.BigIntegerField(null=True)
    changed = models.TextField(blank=True)
    raw = models.JSONField()

    class Meta:
        indexes = [models.Index(fields=['product', 'price'], name='offer_product_price'),
                   models.Index(fields=['shop', 'product'], name='offer_shop_product')]


class Garment(models.Model):
    product = models.OneToOneField(Product, primary_key=True, on_delete=models.CASCADE, related_name='garment')
    slot = models.CharField(max_length=12)
    audience = models.CharField(max_length=12)
    color = models.TextField(null=True)
    attributes = models.JSONField()

    class Meta:
        indexes = [models.Index(fields=['slot', 'audience'], name='garment_slot_audience')]


class OfferState(models.Model):
    offer = models.OneToOneField(Offer, primary_key=True, on_delete=models.CASCADE, related_name='state')
    price_toman = models.BigIntegerField()
    availability = models.CharField(max_length=16)
    observed_at = models.DateTimeField()
    valid_until = models.DateTimeField()
    source = models.CharField(max_length=24, default='merchant_feed')
    product_url = models.URLField(max_length=2000, null=True, blank=True)
    event_id = models.CharField(max_length=64)


class PriceEvent(models.Model):
    id = models.CharField(primary_key=True, max_length=64)
    offer = models.ForeignKey(Offer, on_delete=models.PROTECT, related_name='events')
    shop = models.ForeignKey(Shop, on_delete=models.PROTECT)
    price_toman = models.BigIntegerField()
    availability = models.CharField(max_length=16)
    observed_at = models.DateTimeField()
    valid_until = models.DateTimeField()
    received_at = models.DateTimeField()
    product_url = models.URLField(max_length=2000, null=True, blank=True)

    class Meta:
        indexes = [models.Index(fields=['offer', '-observed_at'], name='price_event_history')]


class Metadata(models.Model):
    key = models.CharField(primary_key=True, max_length=80)
    value = models.TextField()


class Inquiry(models.Model):
    """A buyer's question to one shop, sent through Nazdika. No name or phone: the buyer keeps a secret token, stored here only as a hash."""
    id = models.CharField(primary_key=True, max_length=32)
    token_hash = models.CharField(max_length=64, db_index=True)
    shop = models.ForeignKey(Shop, on_delete=models.CASCADE, related_name='inquiries')
    product = models.ForeignKey(Product, null=True, on_delete=models.CASCADE)
    questions = models.JSONField(default=list)
    note = models.CharField(max_length=200, blank=True)
    created_at = models.DateTimeField(db_index=True)
    answered_at = models.DateTimeField(null=True)
    available = models.BooleanField(null=True)
    price = models.BigIntegerField(null=True)
    reply = models.CharField(max_length=200, blank=True)
    seller_unread = models.BooleanField(default=True)
    updated_at = models.DateTimeField(null=True)

    class Meta:
        indexes = [models.Index(fields=['shop', '-created_at'], name='inquiry_shop_recent')]


class InquiryMessage(models.Model):
    """One message in an inquiry thread, from the buyer or the shop."""
    inquiry = models.ForeignKey(Inquiry, on_delete=models.CASCADE, related_name='messages')
    sender = models.CharField(max_length=6)
    text = models.CharField(max_length=500, blank=True)
    available = models.BooleanField(null=True)
    price = models.BigIntegerField(null=True)
    created_at = models.DateTimeField()

    class Meta:
        ordering = ['created_at', 'id']


class SellerAccess(models.Model):
    """A shop's panel access code, issued by an admin (`manage.py seller_code`); only its hash is stored."""
    shop = models.OneToOneField(Shop, primary_key=True, on_delete=models.CASCADE)
    code_hash = models.CharField(max_length=64)
    created_at = models.DateTimeField()


class SellerSession(models.Model):
    """A logged-in panel session; the browser keeps the token, the DB only its hash."""
    token_hash = models.CharField(primary_key=True, max_length=64)
    shop = models.ForeignKey(Shop, on_delete=models.CASCADE)
    demo = models.BooleanField(default=False)
    expires_at = models.DateTimeField(db_index=True)


class SearchMiss(models.Model):
    """Searches that found nothing, aggregated: normalized text and a count, never who searched or from where."""
    query = models.CharField(primary_key=True, max_length=80)
    category = models.TextField(null=True)
    count = models.PositiveIntegerField(default=0)
    last_seen = models.DateTimeField(db_index=True)

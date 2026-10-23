from django.contrib import admin
from .models import Product, Shop, Offer, Metadata, PriceEvent, OfferState


class SnapshotAdmin(admin.ModelAdmin):
    """Imported records are inspectable, not casually editable in the admin."""
    list_per_page = 30
    show_full_result_count = False

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(Product)
class ProductAdmin(SnapshotAdmin):
    list_display = ['id', 'title', 'category', 'low', 'stores']
    search_fields = ['=id', 'title']


@admin.register(Shop)
class ShopAdmin(SnapshotAdmin):
    list_display = ['id', 'name', 'area', 'installment']
    search_fields = ['=id', 'name', 'area']


@admin.register(Offer)
class OfferAdmin(SnapshotAdmin):
    list_display = ['id', 'product_id', 'shop_id', 'price']
    search_fields = ['=id', '=product_id', '=shop_id']


admin.site.register([Metadata, PriceEvent, OfferState], SnapshotAdmin)

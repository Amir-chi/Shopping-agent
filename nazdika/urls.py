from django.contrib import admin
from django.urls import path, re_path
from catalog import seller_views, views

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/health', views.health),
    path('api/merchant-feed/<str:shop_id>', views.merchant_feed),
    path('api/color-advice', views.color_advice),
    path('api/photo-search', views.photo_search),
    path('api/inquiries/new', views.new_inquiry),
    path('api/inquiries/reply', seller_views.buyer_reply),
    path('api/seller/config', seller_views.config),
    path('api/seller/login', seller_views.login),
    path('api/seller/logout', seller_views.logout),
    re_path(r'^api/seller/(?P<shop_id>shop_[a-zA-Z0-9]+)/(?P<section>[a-z]+)$', seller_views.panel),
    re_path(r'^api/seller/', views.not_found),
    re_path(r'^api/(?P<resource>.*)$', views.api),
    path('', views.index),
    path('index.html', views.index),
    path('favicon.ico', views.asset, {'asset': 'favicon.svg'}),
    re_path(r'^(?P<asset>ui\.css|catalog\.js|shopping\.js|reviews\.js|seller\.js|sw\.js|manifest\.webmanifest)$', views.frontend_asset),
    re_path(r'^assets/(?P<asset>[a-zA-Z0-9_.-]+\.(?:jpg|woff2|svg))$', views.asset),
]

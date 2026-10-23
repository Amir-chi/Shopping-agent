from unittest import mock

from django.core.cache import cache
from django.test import TestCase

from .fixtures import seed


class MovedProductTests(TestCase):
    """A listing a seller filed under the wrong leaf follows its real department everywhere."""
    @classmethod
    def setUpTestData(cls):
        seed()

    def setUp(self):
        cache.clear()

    def test_listing_moves_department(self):
        with mock.patch('catalog.taxonomy.moved', return_value={'product_shoes': 'beauty'}):
            fashion = {p['id'] for p in self.client.get('/api/products', {'group': 'fashion', 'limit': 30}).json()['items']}
            beauty = {p['id'] for p in self.client.get('/api/products', {'group': 'beauty', 'limit': 30}).json()['items']}
            leaf = {p['id'] for p in self.client.get('/api/products', {'category': 'کتانی و کفش اسپرت'}).json()['items']}
            shown = self.client.get('/api/products/product_shoes').json()
        self.assertNotIn('product_shoes', fashion)
        self.assertIn('product_shoes', beauty)
        self.assertNotIn('product_shoes', leaf, 'nor does it stay in the leaf it was misfiled under')
        self.assertEqual(shown['group'], 'beauty')
        self.assertIn('product_top', fashion, 'the rest of the department is unchanged')

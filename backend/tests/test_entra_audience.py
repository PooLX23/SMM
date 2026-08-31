import unittest

from app.deps import _get_valid_audiences


class EntraAudienceTests(unittest.TestCase):
    def test_client_id_accepts_v1_and_v2_audience_forms(self):
        client_id = "11111111-2222-3333-4444-555555555555"

        self.assertEqual(
            _get_valid_audiences(client_id),
            [client_id, f"api://{client_id}"],
        )

    def test_api_uri_with_client_id_accepts_plain_client_id(self):
        client_id = "11111111-2222-3333-4444-555555555555"

        self.assertEqual(
            _get_valid_audiences(f"api://{client_id}"),
            [f"api://{client_id}", client_id],
        )

    def test_custom_uri_does_not_gain_unrelated_aliases(self):
        self.assertEqual(
            _get_valid_audiences("api://shipments.example.com"),
            ["api://shipments.example.com"],
        )

    def test_multiple_explicit_audiences_are_supported(self):
        self.assertEqual(
            _get_valid_audiences("api://legacy, api://current"),
            ["api://legacy", "api://current"],
        )

    def test_empty_configuration_is_rejected_by_caller(self):
        self.assertEqual(_get_valid_audiences(" , "), [])


if __name__ == "__main__":
    unittest.main()

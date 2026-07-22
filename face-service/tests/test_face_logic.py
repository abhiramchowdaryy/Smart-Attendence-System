"""Unit tests for face_logic — run: python -m unittest discover -s tests

Stdlib-only (no DeepFace, numpy, or FastAPI needed), mirroring the framework-
free unit tests on the Next.js side. These cover the parts a reviewer must
trust: the match decision and the payload guards.
"""

import base64
import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from face_logic import (  # noqa: E402
    ImageDecodeError,
    build_verify_result,
    cosine_distance,
    decode_image_payload,
    euclidean_distance,
    find_distance,
    find_threshold,
    is_valid_embedding,
    is_verified,
    l2_normalize,
)


class ThresholdTests(unittest.TestCase):
    def test_known_model_metric(self):
        self.assertEqual(find_threshold("Facenet512", "cosine"), 0.30)
        self.assertEqual(find_threshold("VGG-Face", "euclidean"), 1.17)

    def test_unknown_model_falls_back_by_metric(self):
        self.assertEqual(find_threshold("MysteryNet", "cosine"), 0.40)
        self.assertEqual(find_threshold("MysteryNet", "euclidean_l2"), 0.80)


class DistanceTests(unittest.TestCase):
    def test_cosine_identical_is_zero(self):
        self.assertAlmostEqual(cosine_distance([1, 0, 0], [1, 0, 0]), 0.0)

    def test_cosine_orthogonal_is_one(self):
        self.assertAlmostEqual(cosine_distance([1, 0], [0, 1]), 1.0)

    def test_cosine_opposite_is_two(self):
        self.assertAlmostEqual(cosine_distance([1, 0], [-1, 0]), 2.0)

    def test_cosine_scale_invariant(self):
        # Same direction, different magnitude → still distance 0.
        self.assertAlmostEqual(cosine_distance([1, 2, 3], [2, 4, 6]), 0.0)

    def test_euclidean_3_4_5(self):
        self.assertEqual(euclidean_distance([0, 0], [3, 4]), 5.0)

    def test_length_mismatch_raises(self):
        with self.assertRaises(ValueError):
            cosine_distance([1, 2], [1, 2, 3])
        with self.assertRaises(ValueError):
            euclidean_distance([1], [1, 2])

    def test_l2_normalize_unit_length(self):
        n = l2_normalize([3, 4])
        self.assertAlmostEqual(n[0], 0.6)
        self.assertAlmostEqual(n[1], 0.8)

    def test_l2_normalize_zero_vector_unchanged(self):
        self.assertEqual(l2_normalize([0, 0, 0]), [0.0, 0.0, 0.0])

    def test_find_distance_dispatch(self):
        self.assertAlmostEqual(find_distance([1, 0], [0, 1], "cosine"), 1.0)
        self.assertEqual(find_distance([0, 0], [3, 4], "euclidean"), 5.0)
        # euclidean_l2 of unit vectors pointing the same way is ~0.
        self.assertAlmostEqual(
            find_distance([1, 2, 3], [2, 4, 6], "euclidean_l2"), 0.0
        )

    def test_find_distance_unknown_metric_raises(self):
        with self.assertRaises(ValueError):
            find_distance([1], [1], "manhattan")


class DecisionTests(unittest.TestCase):
    def test_is_verified_boundary(self):
        self.assertTrue(is_verified(0.2, 0.3))
        self.assertTrue(is_verified(0.3, 0.3))  # at threshold matches
        self.assertFalse(is_verified(0.31, 0.3))

    def test_build_verify_result_uses_table_threshold(self):
        res = build_verify_result(distance=0.25, model_name="Facenet512", metric="cosine")
        self.assertTrue(res["verified"])
        self.assertEqual(res["threshold"], 0.30)
        self.assertEqual(res["model"], "Facenet512")
        self.assertEqual(res["metric"], "cosine")

    def test_build_verify_result_rejects_distant(self):
        res = build_verify_result(distance=0.9, model_name="Facenet512", metric="cosine")
        self.assertFalse(res["verified"])

    def test_build_verify_result_explicit_threshold_override(self):
        res = build_verify_result(
            distance=0.5, model_name="Facenet512", metric="cosine", threshold=0.6
        )
        self.assertTrue(res["verified"])
        self.assertEqual(res["threshold"], 0.6)


class EmbeddingValidationTests(unittest.TestCase):
    def test_accepts_finite_number_list(self):
        self.assertTrue(is_valid_embedding([0.1, -0.2, 3.0]))

    def test_rejects_empty(self):
        self.assertFalse(is_valid_embedding([]))

    def test_rejects_non_list(self):
        self.assertFalse(is_valid_embedding("nope"))
        self.assertFalse(is_valid_embedding(None))
        self.assertFalse(is_valid_embedding({"a": 1}))

    def test_rejects_nan_and_inf(self):
        self.assertFalse(is_valid_embedding([0.1, float("nan")]))
        self.assertFalse(is_valid_embedding([0.1, float("inf")]))

    def test_rejects_booleans(self):
        # bool is a subclass of int; an embedding of booleans is malformed.
        self.assertFalse(is_valid_embedding([True, False]))


class ImageDecodeTests(unittest.TestCase):
    def _jpeg_data_url(self, nbytes=200):
        blob = b"\xff\xd8\xff" + b"\x00" * nbytes  # JPEG magic + filler
        return "data:image/jpeg;base64," + base64.b64encode(blob).decode()

    def test_decodes_valid_data_url(self):
        data = decode_image_payload(self._jpeg_data_url())
        self.assertTrue(data.startswith(b"\xff\xd8\xff"))

    def test_decodes_bare_base64(self):
        blob = b"\xff\xd8\xff" + b"x" * 200
        data = decode_image_payload(base64.b64encode(blob).decode())
        self.assertEqual(data, blob)

    def test_rejects_empty(self):
        for bad in ("", "   ", None, 123):
            with self.assertRaises(ImageDecodeError):
                decode_image_payload(bad)

    def test_rejects_unsupported_mime(self):
        with self.assertRaises(ImageDecodeError):
            decode_image_payload("data:image/gif;base64,AAAA")

    def test_rejects_non_base64_data_url(self):
        with self.assertRaises(ImageDecodeError):
            decode_image_payload("data:image/jpeg,notbase64")

    def test_rejects_bad_base64(self):
        with self.assertRaises(ImageDecodeError):
            decode_image_payload("data:image/jpeg;base64,@@@notbase64@@@")

    def test_rejects_too_small(self):
        tiny = base64.b64encode(b"\xff\xd8").decode()
        with self.assertRaises(ImageDecodeError):
            decode_image_payload("data:image/jpeg;base64," + tiny)

    def test_rejects_too_large(self):
        big = "data:image/jpeg;base64," + "A" * (9 * 1024 * 1024)
        with self.assertRaises(ImageDecodeError):
            decode_image_payload(big)


if __name__ == "__main__":
    unittest.main()

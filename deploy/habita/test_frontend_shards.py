"""El crecimiento de la suite no debe omitir pruebas ni producir lotes vacíos."""
import importlib.util
from pathlib import Path
import unittest
import tempfile

spec = importlib.util.spec_from_file_location("frontend_shards", Path(__file__).with_name("frontend-shards.py"))
planner = importlib.util.module_from_spec(spec)
spec.loader.exec_module(planner)


class FrontendShardsTests(unittest.TestCase):
    def test_automatic_growth(self):
        for files, expected in [(1, 1), (40, 1), (41, 2), (160, 4), (161, 5), (400, 10)]:
            with self.subTest(files=files):
                plan = planner.plan([{"file": f"test/{index}.spec.ts"} for index in range(files)])
                self.assertEqual(plan["shard_count"], expected)
                self.assertEqual(plan["matrix"], {"shard": list(range(1, expected + 1))})

    def test_all_sizes_are_balanced_without_omissions(self):
        for files in range(1, 1001):
            result = planner.plan([{"file": f"test/{index}.spec.tsx"} for index in range(files)])
            sizes = result["sizes"]
            self.assertEqual(sum(sizes), files)
            self.assertLessEqual(max(sizes) - min(sizes), 1)
            self.assertLessEqual(max(sizes), 40)
            self.assertGreater(min(sizes), 0)

    def test_bad_inventory_fails_closed(self):
        for value in [[], {}, None, ["test/a.spec.ts"], [{"file": ""}], [{"file": "a"}, {"file": "a"}]]:
            with self.subTest(value=value), self.assertRaises(ValueError):
                planner.plan(value)

    def test_actions_matrix_limit_fails_instead_of_silently_dropping_tests(self):
        with self.assertRaises(ValueError):
            planner.plan([{"file": str(index)} for index in range(10241)])

    def test_partial_or_empty_reports_cannot_be_merged(self):
        with tempfile.TemporaryDirectory() as temporary:
            directory = Path(temporary)
            (directory / "shard-1.json").write_text("blob", encoding="utf-8")
            with self.assertRaises(ValueError):
                planner.verify_reports(directory, 2)
            (directory / "shard-2.json").write_text("", encoding="utf-8")
            with self.assertRaises(ValueError):
                planner.verify_reports(directory, 2)
            (directory / "shard-2.json").write_text("blob", encoding="utf-8")
            planner.verify_reports(directory, 2)
            (directory / "unexpected.json").write_text("blob", encoding="utf-8")
            with self.assertRaises(ValueError):
                planner.verify_reports(directory, 2)


if __name__ == "__main__":
    unittest.main()

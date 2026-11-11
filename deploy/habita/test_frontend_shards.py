"""El crecimiento de la suite no debe omitir pruebas ni producir lotes vacíos."""
import importlib.util
from pathlib import Path
import unittest
import tempfile
from unittest.mock import patch
from types import SimpleNamespace

spec = importlib.util.spec_from_file_location("frontend_shards", Path(__file__).with_name("frontend-shards.py"))
planner = importlib.util.module_from_spec(spec)
spec.loader.exec_module(planner)


class FrontendShardsTests(unittest.TestCase):
    def test_invalid_or_excessive_history_values_use_fallback(self):
        inventory = [{"file": "test/a.spec.ts"}]
        for value in [None, True, -1, 0, float("nan"), float("inf"), 10**400, "1000", []]:
            with self.subTest(value=str(value)[:20]):
                self.assertEqual(planner.plan(inventory, durations={"test/a.spec.ts": value})["weights"]["test/a.spec.ts"], 1000)
    def test_timing_export_requires_every_planned_file_exactly_once(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            manifest = {"groups": [["test/a.spec.ts", "test/b.spec.ts"]]}
            results = [{"name": str(root / "test/a.spec.ts"), "startTime": 10, "endTime": 30}, {"name": str(root / "test/b.spec.ts"), "startTime": 10, "endTime": 50}]
            destination = root / "timings.json"
            planner.export_timings({"testResults": results}, manifest, root, destination)
            self.assertTrue(destination.is_file())
            for invalid in [results[:1], results + results[:1]]:
                with self.assertRaises(ValueError):
                    planner.export_timings({"testResults": invalid}, manifest, root, destination)
            with self.assertRaises(ValueError):
                planner.export_timings({"testResults": results, "numFailedTests": 1}, manifest, root, destination)

    def test_history_uses_only_successful_release_runs_and_matching_artifact(self):
        calls = []
        def api(path):
            calls.append(path)
            if path.startswith("/actions/workflows/"):
                return {"workflow_runs": [{"id": 5}, {"id": 4}]}
            return {"artifacts": [{"name": "ci-timings-api", "expired": path.endswith("5/artifacts?per_page=100")}]}
        fake = SimpleNamespace(api=api)
        spec = SimpleNamespace(loader=SimpleNamespace(exec_module=lambda module: None))
        with patch.dict(planner.os.environ, {"RELEASE_BRANCH": "release/habita"}), patch.object(planner.importlib.util, "spec_from_file_location", return_value=spec), patch.object(planner.importlib.util, "module_from_spec", return_value=fake):
            self.assertEqual(planner.history_run("api"), "4")
        self.assertIn("event=push", calls[0])
        self.assertIn("status=success", calls[0])
        self.assertIn("branch=release%2Fhabita", calls[0])

    def test_slow_files_are_distributed_by_measured_duration(self):
        inventory = [{"file": f"test/{index}.spec.ts"} for index in range(80)]
        history = {item["file"]: 1000 for item in inventory}
        history["test/0.spec.ts"] = 60000
        history["test/1.spec.ts"] = 55000
        result = planner.plan(inventory, durations=history)
        self.assertNotEqual(next(i for i, group in enumerate(result["groups"]) if "test/0.spec.ts" in group), next(i for i, group in enumerate(result["groups"]) if "test/1.spec.ts" in group))
        # Con 40 archivos por lote, los dos archivos pesados dejan una diferencia mínima de 5 s.
        self.assertLessEqual(max(result["estimated_ms"]) - min(result["estimated_ms"]), 5000)
        self.assertEqual(sorted(file for group in result["groups"] for file in group), sorted(history))

    def test_duration_growth_adds_batches_without_losing_new_files(self):
        inventory = [{"file": f"test/{index}.spec.ts"} for index in range(8)]
        result = planner.plan(inventory, durations={item["file"]: 60000 for item in inventory})
        self.assertEqual(result["shard_count"], 3)
        self.assertEqual(sum(result["sizes"]), 8)

    def test_duration_balancing_also_respects_file_capacity(self):
        inventory = [{"file": f"test/{index}.spec.ts"} for index in range(160)]
        history = {item["file"]: 1000 for item in inventory}
        history["test/0.spec.ts"] = 39000
        result = planner.plan(inventory, durations=history)
        self.assertLessEqual(max(result["sizes"]), 40)
        self.assertEqual(sum(result["sizes"]), 160)

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

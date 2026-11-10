"""Casos de alcance para evitar builds omitidos o reconstrucciones innecesarias."""
import importlib.util
from pathlib import Path
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location("changes", Path(__file__).with_name("detect-ci-changes.py"))
changes = importlib.util.module_from_spec(spec)
spec.loader.exec_module(changes)


class ChangedAppsTests(unittest.TestCase):
    def test_api_only(self):
        self.assertEqual(changes.changed_apps(["apps/api/src/main.ts"]), ["api"])

    def test_frontend_only(self):
        self.assertEqual(changes.changed_apps(["apps/frontend/src/App.tsx"]), ["frontend"])

    def test_both_apps(self):
        self.assertEqual(changes.changed_apps(["apps/api/pnpm-lock.yaml", "apps/frontend/package.json"]), ["api", "frontend"])

    def test_shared_changes_require_both(self):
        for path in [".github/workflows/quality.yml", "deploy/habita/activate-release.sh", "package.json", "apps/shared/types.ts"]:
            with self.subTest(path=path):
                self.assertEqual(changes.changed_apps([path]), ["api", "frontend"])

    def test_root_documentation_skips_runtime(self):
        self.assertEqual(changes.changed_apps(["README.md", "docs/architecture.md"]), [])

    def test_renames_are_classified_as_both_paths(self):
        self.assertEqual(changes.changed_apps(["apps/api/old.ts", "apps/frontend/new.ts"]), ["api", "frontend"])

    def test_reuses_only_successful_ancestor_with_both_live_artifacts(self):
        run = {"id": 7, "head_sha": "ancestor"}
        artifacts = {"artifacts": [
            {"name": "habita-build-api", "expired": False},
            {"name": "habita-build-frontend", "expired": False},
        ]}
        with patch.object(changes, "api", side_effect=[{"workflow_runs": [run]}, artifacts]), \
                patch.object(changes.subprocess, "run") as ancestor:
            ancestor.return_value.returncode = 0
            self.assertEqual(changes.reusable_baseline("release/habita", "current"), ("ancestor", "7"))
            ancestor.assert_called_once_with(["git", "merge-base", "--is-ancestor", "ancestor", "current"],
                                             capture_output=True, check=False)

    def test_non_ancestor_never_supplies_a_build(self):
        with patch.object(changes, "api", return_value={"workflow_runs": [{"id": 7, "head_sha": "other"}]}) as api, \
                patch.object(changes.subprocess, "run") as ancestor:
            ancestor.return_value.returncode = 1
            self.assertEqual(changes.reusable_baseline("release/habita", "current"), ("", ""))
            self.assertEqual(api.call_count, 1)

    def test_missing_or_expired_artifacts_force_rebuilding(self):
        for artifacts in [[], [{"name": "habita-build-api", "expired": False}],
                          [{"name": "habita-build-api", "expired": False},
                           {"name": "habita-build-frontend", "expired": True}]]:
            with self.subTest(artifacts=artifacts), \
                    patch.object(changes, "api", side_effect=[
                        {"workflow_runs": [{"id": 7, "head_sha": "ancestor"}]},
                        {"artifacts": artifacts},
                    ]), patch.object(changes.subprocess, "run") as ancestor:
                ancestor.return_value.returncode = 0
                self.assertEqual(changes.reusable_baseline("release/habita", "current"), ("", ""))


if __name__ == "__main__":
    unittest.main()

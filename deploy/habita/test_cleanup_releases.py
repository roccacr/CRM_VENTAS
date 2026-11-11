"""Pruebas aisladas: nunca usan rutas del servidor."""
import importlib.util
import os
from pathlib import Path
import random
import tempfile
import unittest

spec = importlib.util.spec_from_file_location("cleanup_releases", Path(__file__).with_name("cleanup-releases.py"))
cleanup = importlib.util.module_from_spec(spec)
spec.loader.exec_module(cleanup)


@unittest.skipIf(os.name == "nt", "Retención POSIX: ejecutar estas pruebas en Linux/CI.")
class CleanupTests(unittest.TestCase):
    def setUp(self):
        self.fixture = tempfile.TemporaryDirectory()
        self.addCleanup(self.fixture.cleanup)
        self.root = Path(self.fixture.name) / "habita"
        (self.root / "shared").mkdir(parents=True)
        self.old = self.release("20261110100000-aaaaaaa-local")
        self.active = self.release("20261111100000-bbbbbbb-local")
        self.future = self.release("20261112100000-ccccccc-local")
        (self.root / "current").symlink_to(self.active, target_is_directory=True)
        self.env = self.root / "shared/api.env"
        self.env.write_text("synthetic fixture")

    def release(self, name):
        folder = self.root / "releases" / name
        for entry in ("apps/api/dist/main.js", "apps/frontend/dist/index.html"):
            file = folder / entry
            file.parent.mkdir(parents=True, exist_ok=True)
            file.write_text("synthetic fixture")
        return folder

    def test_only_old_releases_and_packages_are_removed(self):
        archive = self.root / "shared" / (self.old.name + ".tar.gz")
        archive.write_text("old")
        upcoming = self.root / "shared" / (self.future.name + ".tar.gz")
        upcoming.write_text("future")
        candidates = cleanup.plan(self.root, self.active.name)
        self.assertEqual(set(candidates), {self.old, archive})
        cleanup.remove(self.root, candidates)
        self.assertFalse(self.old.exists())
        self.assertFalse(archive.exists())
        self.assertTrue(self.active.exists())
        self.assertTrue(self.future.exists())
        self.assertTrue(upcoming.exists())
        self.assertEqual(self.env.read_text(), "synthetic fixture")

    def test_dry_plan_does_not_delete_anything(self):
        cleanup.plan(self.root, self.active.name)
        self.assertTrue(self.old.exists())

    def test_active_release_is_protected_even_if_passed_as_candidate(self):
        with self.assertRaises(ValueError):
            cleanup.remove(self.root, [self.active])
        self.assertTrue(self.active.exists())

    def test_other_projects_and_symlinks_are_never_followed(self):
        other = Path(self.fixture.name) / "other-project"
        other.mkdir()
        (other / "keep").write_text("keep")
        link = self.root / "releases/20261109000000-eeeeeee-local"
        link.symlink_to(other, target_is_directory=True)
        with self.assertRaises(ValueError):
            cleanup.remove(self.root, [other])
        with self.assertRaises(ValueError):
            cleanup.remove(self.root, [link])
        self.assertNotIn(link, cleanup.plan(self.root, self.active.name))
        self.assertTrue((other / "keep").exists())

    def test_symlink_inside_old_release_does_not_delete_shared_environment(self):
        (self.old / "apps/api/.env").symlink_to(self.env)
        cleanup.remove(self.root, [self.old])
        self.assertTrue(self.env.exists())

    def test_current_outside_release_root_is_rejected(self):
        (self.root / "current").unlink()
        (self.root / "current").symlink_to(self.root / "shared", target_is_directory=True)
        with self.assertRaises(ValueError):
            cleanup.plan(self.root, self.active.name)

    def test_symlink_in_root_ancestor_cannot_select_current(self):
        alias = Path(self.fixture.name) / "ancestor-alias"
        alias.symlink_to(self.root.parent, target_is_directory=True)
        indirect = alias / self.root.name
        candidates = cleanup.plan(indirect, self.active.name)
        self.assertNotIn(self.active, candidates)
        cleanup.remove(indirect, candidates)
        self.assertTrue(self.active.exists())

    def test_same_second_future_upload_is_not_selected_by_hash_order(self):
        next_id = self.active.name[:14] + "-aaaaaaa-local"
        archive = self.root / "shared" / (next_id + ".tar.gz")
        archive.write_text("future upload")
        other = self.release(next_id)
        candidates = cleanup.plan(self.root, self.active.name)
        self.assertNotIn(archive, candidates)
        self.assertNotIn(other, candidates)

    def test_new_current_is_rechecked_before_removal(self):
        candidates = cleanup.plan(self.root, self.active.name)
        (self.root / "current").unlink()
        (self.root / "current").symlink_to(self.old, target_is_directory=True)
        with self.assertRaises(ValueError):
            cleanup.remove(self.root, candidates)
        self.assertTrue(self.old.exists())

    def test_generated_release_inventory_always_preserves_active(self):
        randomizer = random.Random(20261111)
        for _ in range(100):
            stamp = f"202611{randomizer.randint(1, 28):02d}120000"
            self.release(stamp + f"-{randomizer.randrange(16**7):07x}-local")
        for boundary in (self.old.name, self.active.name, self.future.name):
            candidates = cleanup.plan(self.root, boundary)
            self.assertNotIn(self.active, candidates)
            self.assertTrue(all(path.parent in (self.root / "releases", self.root / "shared") for path in candidates))

    def test_fuzz_candidates_reject_shared_data_and_path_traversal(self):
        for candidate in (
            self.env, self.root / "shared", self.root / "current",
            self.root / "releases/../shared/api.env", self.root,
        ):
            with self.assertRaises(ValueError):
                cleanup.remove(self.root, [candidate])
            self.assertEqual(self.env.read_text(), "synthetic fixture")


if __name__ == "__main__":
    unittest.main()

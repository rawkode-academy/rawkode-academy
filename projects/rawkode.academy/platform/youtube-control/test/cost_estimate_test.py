"""Arithmetic regression checks against official pricing examples and limits."""
import importlib.util
from pathlib import Path
import sys
import unittest

path = Path(__file__).parents[1] / "scripts" / "cost_estimate.py"
spec = importlib.util.spec_from_file_location("cost_estimate", path)
module = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = module
spec.loader.exec_module(module)


class CostEstimateTests(unittest.TestCase):
    def test_documented_pipeline_example(self):
        # Cloudflare's 500GB transform / 300GB Iceberg example costs $33.
        self.assertAlmostEqual(module.pipeline_cost(500, 300), 33)

    def test_r2_rounding_after_allowance(self):
        self.assertEqual(module.rounded_charge(1_000_001, 1_000_000, 1_000_000, 4.50), 4.50)
        self.assertEqual(module.rounded_charge(10.1, 10, 1, 0.015), 0.015)
        self.assertEqual(module.rounded_charge(10, 10, 1, 0.015), 0)

    def test_minimum_query_scan(self):
        result = module.estimate(0.00001, "best", query_count=1000)
        self.assertEqual(result["usage"]["sql_scanned_gb"], 10)
        self.assertEqual(result["charges"]["basin_sql"], 0)
        self.assertAlmostEqual(module.estimate(0.00001, "best", query_count=2000)["charges"]["basin_sql"], 0.025)

    def test_k2_charges_pointer_bytes_not_full_reports(self):
        result = module.estimate(1, "best")
        self.assertLess(result["usage"]["k2_produced_gb"], 0.005)
        self.assertEqual(result["charges"]["k2_beta"], 0)
        self.assertGreater(result["proposed_k2_addition_usd"], 0)

    def test_replay_amplifies_cost_without_changing_fresh_volume(self):
        result = module.estimate(1, "worst")
        self.assertEqual(result["usage"]["pipeline_gb"], 3)
        self.assertAlmostEqual(result["usage"]["k2_consumed_gb"] / result["usage"]["k2_produced_gb"], 1.5)

    def test_scenario_totals_and_account_subscription(self):
        for scale in [0.01, 1, 10, 100, 1000]:
            best = module.estimate(scale, "best")
            worst = module.estimate(scale, "worst")
            self.assertAlmostEqual(sum(worst["charges"].values()), worst["incremental_usd"])
            self.assertAlmostEqual(worst["new_paid_account_usd"], worst["incremental_usd"] + 5)
            self.assertGreaterEqual(worst["incremental_usd"], best["incremental_usd"])

    def test_invocation_logs_disabled_and_custom_logs_are_optional(self):
        for scenario in ["best", "worst"]:
            baseline = module.estimate(1000, scenario)
            self.assertEqual(baseline["usage"]["log_events"], 0)
            self.assertEqual(baseline["charges"]["workers_logs_current"], 0)
            self.assertEqual(baseline["december_observability_change_usd"], 0)
        sensitivity = module.estimate(1000, "worst", logs_per_invocation=3)
        self.assertGreater(sensitivity["charges"]["workers_logs_current"], 0)
        self.assertGreater(sensitivity["december_observability_change_usd"], 0)


if __name__ == "__main__":
    unittest.main()

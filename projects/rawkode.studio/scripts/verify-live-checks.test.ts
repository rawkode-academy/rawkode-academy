import { describe, expect, it } from "vitest";
import {
	checkCloudflareApiSuccess,
	checkCloudflareCollectionHas,
	checkD1DatabaseOutput,
	checkD1SchemaOutput,
	checkDeploymentOutput,
	checkExpectedText,
	checkR2BucketOutput,
	checkRealtimeKitPresetCoverage,
	checkStreamLiveInputs,
	checkWorkerBindings,
	getCloudflareCollection,
} from "./verify-live-checks";

describe("live verification output checks", () => {
	it("checks command metadata without including provider output in failures", () => {
		expect(checkExpectedText("namespace studio-id", ["namespace", "studio-id"])).toEqual({
			ok: true,
		});
		const result = checkExpectedText("Bearer secret-provider-value", ["expected-name"]);
		expect(result.ok).toBe(false);
		expect(result.detail).toContain("expected-name");
		expect(result.detail).not.toContain("secret-provider-value");
	});

	it("requires an active Worker deployment version", () => {
		expect(
			checkDeploymentOutput(JSON.stringify({ versions: [{ percentage: 100 }] })),
		).toEqual({ ok: true });
		expect(checkDeploymentOutput(JSON.stringify({ versions: [] })).ok).toBe(false);
	});

	it("finds the expected D1 database identity", () => {
		const output = JSON.stringify([
			{ name: "another-db", uuid: "another-id" },
			{ name: "studio", uuid: "studio-id" },
		]);
		expect(checkD1DatabaseOutput(output, "studio", "studio-id")).toEqual({ ok: true });
		expect(checkD1DatabaseOutput(output, "studio", "wrong-id").ok).toBe(false);
	});

	it("checks every D1 migration and schema flag", () => {
		const output = JSON.stringify([
			{
				results: [
					{
						control_state: 1,
						lease_index: "1",
						migration: true,
						migration_0006: 1,
						migration_0007: 1,
						migration_0008: 1,
						canonical_recording_index: 1,
						canonical_recording_no_duplicates: 1,
						recording_heartbeat: 1,
						recording_lease_grace: 1,
						recording_lease_id: 1,
						recording_lease_index: 1,
						realtimekit_participant_identity: 1,
						realtimekit_participant_identity_index: 1,
					},
				],
			},
		]);
		expect(
			checkD1SchemaOutput(output, [
				"migration",
				"migration_0006",
				"migration_0007",
				"migration_0008",
				"canonical_recording_index",
				"canonical_recording_no_duplicates",
				"control_state",
				"lease_index",
				"realtimekit_participant_identity",
				"realtimekit_participant_identity_index",
				"recording_lease_id",
				"recording_heartbeat",
				"recording_lease_grace",
				"recording_lease_index",
			]),
		).toEqual({ ok: true });
		const missing = checkD1SchemaOutput(output, ["migration", "stream_heartbeat"]);
		expect(missing.ok).toBe(false);
		expect(missing.detail).toContain("stream_heartbeat");
	});

	it("does not echo invalid JSON that may contain credentials", () => {
		const result = checkDeploymentOutput("not-json secret-provider-value");
		expect(result.ok).toBe(false);
		expect(result.detail).not.toContain("secret-provider-value");
	});

	it("checks R2 bucket identity", () => {
		expect(checkR2BucketOutput('{"name":"recordings"}', "recordings")).toEqual({
			ok: true,
		});
		expect(checkR2BucketOutput('{"name":"other"}', "recordings").ok).toBe(false);
	});
});

describe("live verification Cloudflare API checks", () => {
	it("unwraps data, result, and keyed result collections", () => {
		expect(getCloudflareCollection({ data: [{ id: "app" }] })).toEqual([
			{ id: "app" },
		]);
		expect(getCloudflareCollection({ result: [{ queue_name: "queue" }] })).toEqual([
			{ queue_name: "queue" },
		]);
		expect(
			getCloudflareCollection({ result: { liveInputs: [] } }, "liveInputs"),
		).toEqual([]);
	});

	it("requires Cloudflare API success when explicitly reported", () => {
		expect(checkCloudflareApiSuccess({ success: true })).toEqual({ ok: true });
		expect(checkCloudflareApiSuccess({ success: false }).ok).toBe(false);
	});

	it("checks queue visibility by resource name", () => {
		const queues = {
			result: [{ queue_name: "rawkode-academy-notifications" }],
			success: true,
		};
		expect(
			checkCloudflareCollectionHas(
				queues,
				"queue_name",
				"rawkode-academy-notifications",
			),
		).toEqual({ ok: true });
	});

	it("checks exact deployed binding types and resources", () => {
		const payload = {
			result: {
				bindings: [
					{ name: "SESSION", namespace_id: "kv-id", type: "kv_namespace" },
					{ name: "STUDIO_DB", id: "db-id", type: "d1" },
					{
						name: "STREAM_NOTIFICATIONS",
						queue_name: "notifications",
						type: "queue",
					},
				],
			},
			success: true,
		};
		expect(
			checkWorkerBindings(payload, [
				{ fields: { namespace_id: "kv-id" }, name: "SESSION", type: "kv_namespace" },
				{ fields: { id: "db-id" }, name: "STUDIO_DB", type: "d1" },
				{
					fields: { queue_name: "notifications" },
					name: "STREAM_NOTIFICATIONS",
					type: "queue",
				},
			]),
		).toEqual({ ok: true });
		expect(
			checkWorkerBindings(payload, [
				{
					fields: { queue_name: "wrong-queue" },
					name: "STREAM_NOTIFICATIONS",
					type: "queue",
				},
			]),
		).toMatchObject({ ok: false });
	});

	it("requires all RealtimeKit presets on one app", () => {
		const required = ["host", "producer", "guest", "program"];
		expect(
			checkRealtimeKitPresetCoverage(
				[{ appId: "studio", presetNames: required }],
				required,
			),
		).toEqual({ ok: true });
		expect(
			checkRealtimeKitPresetCoverage(
				[
					{ appId: "one", presetNames: ["host", "producer"] },
					{ appId: "two", presetNames: ["guest", "program"] },
				],
				required,
			).ok,
		).toBe(false);
	});

	it("accepts an empty but readable Stream live-input collection", () => {
		expect(
			checkStreamLiveInputs({ result: { liveInputs: [] }, success: true }),
		).toEqual({ ok: true });
		expect(checkStreamLiveInputs({ result: {}, success: true }).ok).toBe(false);
	});
});

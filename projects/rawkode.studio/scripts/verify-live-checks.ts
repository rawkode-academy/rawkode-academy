export interface CheckResult {
	detail?: string;
	ok: boolean;
}

export interface ExpectedWorkerBinding {
	fields?: Record<string, string>;
	name: string;
	type: string;
}

export interface RealtimeKitAppPresetSummary {
	appId: string;
	presetNames: string[];
}

const passed: CheckResult = { ok: true };

function failed(detail: string): CheckResult {
	return { detail, ok: false };
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function parseJson(output: string, label: string): { error?: CheckResult; value?: unknown } {
	try {
		return { value: JSON.parse(output) };
	} catch {
		return { error: failed(`${label} did not return valid JSON.`) };
	}
}

function valueIsPresent(value: unknown): boolean {
	return value === true || value === 1 || value === "1";
}

function recordsIn(value: unknown): Record<string, unknown>[] {
	if (Array.isArray(value)) {
		return value.flatMap(recordsIn);
	}
	if (!isRecord(value)) {
		return [];
	}
	return [value, ...Object.values(value).flatMap(recordsIn)];
}

export function checkExpectedText(
	output: string,
	expectedValues: string[],
): CheckResult {
	const missing = expectedValues.filter((expected) => !output.includes(expected));
	return missing.length === 0
		? passed
		: failed(`Missing expected metadata: ${missing.join(", ")}.`);
}

export function checkDeploymentOutput(output: string): CheckResult {
	const parsed = parseJson(output, "Worker deployment status");
	if (parsed.error) return parsed.error;
	if (!isRecord(parsed.value)) {
		return failed("Worker deployment status was not an object.");
	}
	if (!Array.isArray(parsed.value.versions) || parsed.value.versions.length === 0) {
		return failed("Worker deployment has no active version.");
	}
	return passed;
}

export function checkD1DatabaseOutput(
	output: string,
	databaseName: string,
	databaseId: string,
): CheckResult {
	const parsed = parseJson(output, "D1 database list");
	if (parsed.error) return parsed.error;
	const found = recordsIn(parsed.value).some(
		(record) =>
			record.name === databaseName &&
			(record.uuid === databaseId || record.id === databaseId),
	);
	return found
		? passed
		: failed(`D1 database ${databaseName} (${databaseId}) was not visible.`);
}

export function checkD1SchemaOutput(
	output: string,
	requiredFlags: string[],
): CheckResult {
	const parsed = parseJson(output, "D1 schema query");
	if (parsed.error) return parsed.error;
	const rows = Array.isArray(parsed.value)
		? parsed.value.flatMap((entry) =>
				isRecord(entry) && Array.isArray(entry.results)
					? entry.results.filter(isRecord)
					: [],
			)
		: [];
	const row = rows.find((candidate) =>
		requiredFlags.some((flag) => Object.hasOwn(candidate, flag)),
	);
	if (!row) {
		return failed("D1 schema query returned no verification row.");
	}
	const missing = requiredFlags.filter((flag) => !valueIsPresent(row[flag]));
	return missing.length === 0
		? passed
		: failed(`D1 schema is missing: ${missing.join(", ")}.`);
}

export function checkR2BucketOutput(
	output: string,
	bucketName: string,
): CheckResult {
	const parsed = parseJson(output, "R2 bucket info");
	if (parsed.error) return parsed.error;
	return isRecord(parsed.value) && parsed.value.name === bucketName
		? passed
		: failed(`R2 bucket ${bucketName} was not visible.`);
}

export function checkCloudflareApiSuccess(payload: unknown): CheckResult {
	if (!isRecord(payload)) {
		return failed("Cloudflare API response was not an object.");
	}
	if (payload.success === false) {
		return failed("Cloudflare API reported an unsuccessful response.");
	}
	return passed;
}

export function getCloudflareCollection(
	payload: unknown,
	resultKey?: string,
): unknown[] | null {
	if (!isRecord(payload)) return null;
	if (Array.isArray(payload.data)) return payload.data;
	if (Array.isArray(payload.result)) return payload.result;
	if (resultKey && isRecord(payload.result) && Array.isArray(payload.result[resultKey])) {
		return payload.result[resultKey];
	}
	return null;
}

export function checkCloudflareCollectionHas(
	payload: unknown,
	field: string,
	expectedValue: string,
	resultKey?: string,
): CheckResult {
	const success = checkCloudflareApiSuccess(payload);
	if (!success.ok) return success;
	const collection = getCloudflareCollection(payload, resultKey);
	if (!collection) {
		return failed("Cloudflare API response did not contain the expected collection.");
	}
	return collection.some((item) => isRecord(item) && item[field] === expectedValue)
		? passed
		: failed(`Cloudflare resource ${expectedValue} was not visible.`);
}

export function checkWorkerBindings(
	payload: unknown,
	expectedBindings: ExpectedWorkerBinding[],
): CheckResult {
	const success = checkCloudflareApiSuccess(payload);
	if (!success.ok) return success;
	if (!isRecord(payload) || !isRecord(payload.result) || !Array.isArray(payload.result.bindings)) {
		return failed("Worker settings did not contain production bindings.");
	}
	const bindings = payload.result.bindings.filter(isRecord);
	const missing: string[] = [];
	for (const expected of expectedBindings) {
		const binding = bindings.find((candidate) => candidate.name === expected.name);
		if (!binding || binding.type !== expected.type) {
			missing.push(`${expected.name}:${expected.type}`);
			continue;
		}
		for (const [field, value] of Object.entries(expected.fields ?? {})) {
			if (binding[field] !== value) {
				missing.push(`${expected.name}.${field}`);
			}
		}
	}
	return missing.length === 0
		? passed
		: failed(`Worker bindings are missing or incorrect: ${missing.join(", ")}.`);
}

export function checkRealtimeKitPresetCoverage(
	apps: RealtimeKitAppPresetSummary[],
	requiredPresetNames: string[],
): CheckResult {
	const matchingApp = apps.find((app) => {
		const names = new Set(app.presetNames);
		return requiredPresetNames.every((name) => names.has(name));
	});
	if (matchingApp) return passed;
	return failed(
		`No visible RealtimeKit app contains every required preset: ${requiredPresetNames.join(", ")}.`,
	);
}

export function checkStreamLiveInputs(payload: unknown): CheckResult {
	const success = checkCloudflareApiSuccess(payload);
	if (!success.ok) return success;
	const liveInputs = getCloudflareCollection(payload, "liveInputs");
	return liveInputs
		? passed
		: failed("Cloudflare Stream response did not contain a live-input collection.");
}

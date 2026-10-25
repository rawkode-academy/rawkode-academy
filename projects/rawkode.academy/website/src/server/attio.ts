// Shared Attio CRM calls for public forms (partnership enquiries, cohort
// invoice requests). Every failure carries a caller-chosen code so each form
// can report its own error vocabulary.
//
// This module has no imports so tests can load it directly.

export const ATTIO_API_URL = "https://api.attio.com/v2";
export const DEAL_OWNER = "david@rawkode.academy";

interface AttioRecordResponse {
	data?: {
		id?: {
			record_id?: string;
		};
	};
}

interface AttioQueryResponse {
	data?: Array<{
		id?: {
			record_id?: string;
		};
	}>;
}

export const attioHeaders = (apiKey: string) => ({
	Authorization: `Bearer ${apiKey}`,
	"Content-Type": "application/json",
});

export const attioCallFailure = async (response: Response, code: string) => {
	let attioCode: string | undefined;
	try {
		const body = (await response.json()) as { code?: unknown };
		if (typeof body.code === "string" && /^[a-z0-9_:-]+$/i.test(body.code)) {
			attioCode = body.code;
		}
	} catch {
		attioCode = undefined;
	}
	return Object.assign(new Error(code), {
		code,
		status: response.status,
		attioCode,
	});
};

export const codedFailure = (code: string) =>
	Object.assign(new Error(code), { code });

export const attioRequest = async <Response>(
	apiKey: string,
	path: string,
	values: Record<string, unknown>,
): Promise<Response> => {
	const response = await fetch(`${ATTIO_API_URL}${path}`, {
		method: "POST",
		headers: attioHeaders(apiKey),
		body: JSON.stringify({ data: { values } }),
	});

	if (!response.ok) {
		throw await attioCallFailure(response, "crm_write_failed");
	}

	return response.json() as Promise<Response>;
};

export const attioRecordId = (response: AttioRecordResponse): string => {
	const recordId = response.data?.id?.record_id;
	if (!recordId) {
		throw codedFailure("crm_write_failed");
	}
	return recordId;
};

export const findRecordId = async (
	apiKey: string,
	object: "companies" | "people",
	filter: Record<string, Record<string, { $eq: string }>>,
): Promise<string | undefined> => {
	const response = await fetch(
		`${ATTIO_API_URL}/objects/${object}/records/query`,
		{
			method: "POST",
			headers: attioHeaders(apiKey),
			body: JSON.stringify({ filter, limit: 1 }),
		},
	);
	if (!response.ok) {
		throw await attioCallFailure(response, "crm_lookup_failed");
	}
	const body = (await response.json()) as AttioQueryResponse;
	if (!Array.isArray(body.data)) {
		throw codedFailure("crm_lookup_failed");
	}
	const [match] = body.data;
	if (!match) return undefined;
	const recordId = match.id?.record_id;
	if (!recordId) {
		throw codedFailure("crm_lookup_failed");
	}
	return recordId;
};

export const createNote = async (
	apiKey: string,
	parentObject: "companies" | "people",
	parentRecordId: string,
	title: string,
	content: string,
) => {
	const response = await fetch(`${ATTIO_API_URL}/notes`, {
		method: "POST",
		headers: attioHeaders(apiKey),
		body: JSON.stringify({
			data: {
				parent_object: parentObject,
				parent_record_id: parentRecordId,
				title,
				format: "plaintext",
				content,
			},
		}),
	});
	if (!response.ok) {
		throw await attioCallFailure(response, "crm_note_failed");
	}
};

export const attioAttributeExists = async (
	apiKey: string,
	attribute: string,
): Promise<boolean> => {
	try {
		const response = await fetch(
			`${ATTIO_API_URL}/objects/deals/attributes/${encodeURIComponent(attribute)}`,
			{
				headers: {
					Authorization: `Bearer ${apiKey}`,
				},
			},
		);
		return response.ok;
	} catch {
		return false;
	}
};

/** A hashed, per-form rate-limit key so raw IPs never reach the limiter. */
export const rateLimitKey = async (
	request: Request,
	scope: string,
): Promise<string> => {
	const address =
		request.headers.get("CF-Connecting-IP") ??
		request.headers.get("x-forwarded-for") ??
		"unknown";
	const source = new TextEncoder().encode(`${scope}:${address}`);
	const digest = await crypto.subtle.digest("SHA-256", source);
	return Array.from(new Uint8Array(digest), (byte) =>
		byte.toString(16).padStart(2, "0"),
	).join("");
};

/**
 * Finds the company by email domain and the person by email, creating either
 * when missing. Matches are by unverified form input, so callers add a review
 * note when they reuse an existing record.
 */
export const upsertCompanyAndPerson = async (
	apiKey: string,
	input: { name: string; email: string; company: string },
) => {
	const emailAddress = input.email.toLowerCase();
	const emailDomain = emailAddress.split("@")[1];
	if (!emailDomain) throw codedFailure("invalid_email");

	const existingCompanyId = await findRecordId(apiKey, "companies", {
		domains: { domain: { $eq: emailDomain } },
	});
	const companyId =
		existingCompanyId ??
		attioRecordId(
			await attioRequest<AttioRecordResponse>(
				apiKey,
				"/objects/companies/records",
				{ name: input.company, domains: [emailDomain] },
			),
		);

	const existingPersonId = await findRecordId(apiKey, "people", {
		email_addresses: { email_address: { $eq: emailAddress } },
	});
	const personId =
		existingPersonId ??
		attioRecordId(
			await attioRequest<AttioRecordResponse>(
				apiKey,
				"/objects/people/records",
				{
					name: [{ full_name: input.name }],
					email_addresses: [input.email],
					company: [
						{ target_object: "companies", target_record_id: companyId },
					],
				},
			),
		);

	return {
		emailDomain,
		companyId,
		existingCompanyId,
		personId,
		existingPersonId,
	};
};

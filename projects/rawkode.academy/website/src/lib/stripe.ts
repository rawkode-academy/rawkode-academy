// Minimal Stripe Checkout client over the REST API. The Stripe SDK is not
// needed for two calls, and fetch keeps the Worker bundle small.
//
// This module has no imports so tests can load it directly.

const STRIPE_API_URL = "https://api.stripe.com/v1";

export interface CohortCheckoutInput {
	intakeId: string;
	productName: string;
	productDescription: string;
	unitAmountUsd: number;
	seats: number;
	maxSeatsPerOrder: number;
	successUrl: string;
	cancelUrl: string;
	clientReferenceId?: string | undefined;
	customerEmail?: string | undefined;
}

export interface CheckoutSessionSummary {
	id: string;
	url: string | null;
	status: string | null;
	paymentStatus: string | null;
	customerEmail: string | null;
	quantity: number | null;
}

export class StripeError extends Error {
	constructor(
		message: string,
		readonly status: number,
		readonly stripeCode?: string,
	) {
		super(message);
	}
}

/** Stripe's form encoding: nested keys as a[b][c]=value. */
export const checkoutSessionParams = (
	input: CohortCheckoutInput,
): URLSearchParams => {
	const params = new URLSearchParams();
	const set = (key: string, value: string | number | boolean) =>
		params.append(key, String(value));
	const item = "line_items[0]";

	set("mode", "payment");
	set(`${item}[price_data][currency]`, "usd");
	set(
		`${item}[price_data][unit_amount]`,
		Math.round(input.unitAmountUsd * 100),
	);
	set(`${item}[price_data][product_data][name]`, input.productName);
	set(
		`${item}[price_data][product_data][description]`,
		input.productDescription,
	);
	set(`${item}[quantity]`, input.seats);
	set(`${item}[adjustable_quantity][enabled]`, true);
	set(`${item}[adjustable_quantity][minimum]`, 1);
	set(`${item}[adjustable_quantity][maximum]`, input.maxSeatsPerOrder);
	// Employer-paid seats need a company address, VAT/tax ID and an invoice
	// PDF for expenses; Stripe collects all three.
	set("billing_address_collection", "required");
	set("tax_id_collection[enabled]", true);
	set("invoice_creation[enabled]", true);
	set("invoice_creation[invoice_data][metadata][intake]", input.intakeId);
	set("customer_creation", "always");
	set("allow_promotion_codes", true);
	set("custom_fields[0][key]", "company");
	set("custom_fields[0][label][type]", "custom");
	set("custom_fields[0][label][custom]", "Company (for the invoice)");
	set("custom_fields[0][type]", "text");
	set("custom_fields[0][optional]", true);
	set("metadata[intake]", input.intakeId);
	set("payment_intent_data[metadata][intake]", input.intakeId);
	set("success_url", input.successUrl);
	set("cancel_url", input.cancelUrl);
	if (input.clientReferenceId) {
		set("client_reference_id", input.clientReferenceId);
	}
	if (input.customerEmail) {
		set("customer_email", input.customerEmail);
	}
	return params;
};

const stripeFailure = async (response: Response) => {
	let message = `Stripe request failed with ${response.status}`;
	let code: string | undefined;
	try {
		const body = (await response.json()) as {
			error?: { message?: string; code?: string };
		};
		if (body.error?.message) message = body.error.message;
		code = body.error?.code;
	} catch {
		// Keep the status-only message.
	}
	return new StripeError(message, response.status, code);
};

const summarise = (body: Record<string, unknown>): CheckoutSessionSummary => {
	const details = body.customer_details as { email?: string } | null;
	const lineItems = body.line_items as
		| { data?: Array<{ quantity?: number }> }
		| undefined;
	return {
		id: String(body.id),
		url: typeof body.url === "string" ? body.url : null,
		status: typeof body.status === "string" ? body.status : null,
		paymentStatus:
			typeof body.payment_status === "string" ? body.payment_status : null,
		customerEmail: details?.email ?? null,
		quantity: lineItems?.data?.[0]?.quantity ?? null,
	};
};

export const createCheckoutSession = async (
	secretKey: string,
	input: CohortCheckoutInput,
): Promise<CheckoutSessionSummary> => {
	const response = await fetch(`${STRIPE_API_URL}/checkout/sessions`, {
		method: "POST",
		headers: {
			Authorization: `Bearer ${secretKey}`,
			"Content-Type": "application/x-www-form-urlencoded",
		},
		body: checkoutSessionParams(input),
	});
	if (!response.ok) throw await stripeFailure(response);
	return summarise((await response.json()) as Record<string, unknown>);
};

/** Checkout session ids are "cs_test_…" or "cs_live_…". */
export const isCheckoutSessionId = (value: string | null): value is string =>
	value !== null && /^cs_(test|live)_[A-Za-z0-9]{10,200}$/.test(value);

export const getCheckoutSession = async (
	secretKey: string,
	sessionId: string,
): Promise<CheckoutSessionSummary> => {
	const url = `${STRIPE_API_URL}/checkout/sessions/${encodeURIComponent(sessionId)}?expand[]=line_items`;
	const response = await fetch(url, {
		headers: { Authorization: `Bearer ${secretKey}` },
	});
	if (!response.ok) throw await stripeFailure(response);
	return summarise((await response.json()) as Record<string, unknown>);
};

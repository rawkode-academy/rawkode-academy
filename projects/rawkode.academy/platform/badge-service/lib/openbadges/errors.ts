export class OpenBadgeError extends Error {
	public readonly code: string;

	constructor(message: string, code: string) {
		super(message);
		this.name = "OpenBadgeError";
		this.code = code;
	}
}

export class KeyManagementError extends OpenBadgeError {
	constructor(message: string) {
		super(message, "KEY_MANAGEMENT_ERROR");
		this.name = "KeyManagementError";
	}
}

export class CredentialValidationError extends OpenBadgeError {
	public readonly validationErrors: unknown[];

	constructor(message: string, validationErrors: unknown[] = []) {
		super(message, "CREDENTIAL_VALIDATION_ERROR");
		this.name = "CredentialValidationError";
		this.validationErrors = validationErrors;
	}
}

export class SigningError extends OpenBadgeError {
	constructor(message: string) {
		super(message, "SIGNING_ERROR");
		this.name = "SigningError";
	}
}

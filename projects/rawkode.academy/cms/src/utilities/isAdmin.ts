import { Access, FieldAccess } from "payload/types";
import type { Person } from "../payload-types";

export const isAdmin: Access = (accessArgs) => {
	const user = accessArgs.req.user as Person | undefined;

	if (!user) {
		return false;
	}

	if (user.role === "admin") {
		return true;
	}

	return false;
};

export const isFieldAdmin: FieldAccess<{ id: string }, unknown, Person> = ({
	req: { user },
}) => {
	if (!user) {
		return false;
	}

	if (user.role === "admin") {
		return true;
	}
};

export const isAdminOrSelf: Access = (args) => {
	const user = args.req.user as Person | undefined;

	if (!user) {
		return false;
	}

	if (isAdmin(args)) {
		return true;
	}

	return {
		id: {
			equals: user.id,
		},
	};
};

export const isFieldAdminOrSelf: FieldAccess<{ id: string }, unknown, Person> =
	({ req: { user }, id }) => {
		if (!user) {
			return false;
		}

		if (user.id === id) {
			return true;
		}

		if (user.role === "admin") {
			return true;
		}
	};

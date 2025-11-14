import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import {
	account,
	passkey,
	session,
	user,
	verification,
} from "../schema";

// User schemas
export const SelectUser = createSelectSchema(user);
export const InsertUser = createInsertSchema(user);

// Session schemas
export const SelectSession = createSelectSchema(session);
export const InsertSession = createInsertSchema(session);

// Account schemas (GitHub OAuth)
export const SelectAccount = createSelectSchema(account);
export const InsertAccount = createInsertSchema(account);

// Passkey schemas
export const SelectPasskey = createSelectSchema(passkey);
export const InsertPasskey = createInsertSchema(passkey);

// Verification schemas
export const SelectVerification = createSelectSchema(verification);
export const InsertVerification = createInsertSchema(verification);

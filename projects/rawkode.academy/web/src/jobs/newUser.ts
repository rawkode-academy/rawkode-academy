import { Resend } from "@trigger.dev/resend";
import { SupabaseManagement } from "@trigger.dev/supabase";
import type { Database } from "../database.types";
import { client } from "../trigger";

const supabaseManagement = new SupabaseManagement({
	id: "supabase-management",
	apiKey: import.meta.env.SUPABASE_SERVICE_KEY!,
});

const db = supabaseManagement.db<Database>(
	import.meta.env.SUPABASE_URL!
);

const resend = new Resend({
	id: "resend",
	apiKey: import.meta.env.RESEND_API_KEY!,
});

client.defineJob({
	id: "new-user-welcome",
	name: "Send New Users a Welcome Email",
	version: "0.0.1",
	integrations: {
		resend,
	},
	trigger: db.onUpdated({
		schema: "auth",
		table: "users",
		filter: {
			old_record: {
				email_confirmed_at: [{ $isNull: true }],
			},
			record: {
				email_confirmed_at: [{ $isNull: false }],
			},
		},
	}),
	run: async (payload, io, ctx) => {
		if (!payload.record.email) {
			return;
		}

		const isTestOrDev =
			ctx.run.isTest || ctx.environment.type === "DEVELOPMENT";

		await io.wait("wait-1", isTestOrDev ? 10 : 60 * 60);

		const email1 = await io.resend.emails.send("email-1", {
			to: payload.record.email,
			subject: `Welcome to the Rawkode Academy`,
			text: `Email: 1`,
			from: import.meta.env.EMAIL_FROM!,
		});

		await io.wait("wait-2", isTestOrDev ? 10 : 60 * 60 * 12); // 12 hours

		const email2 = await io.resend.sendEmail("email-2", {
			to: payload.record.email,
			subject: `Follow-up Email from the Rawkode Academy`,
			text: `Email 2`,
			from: import.meta.env.EMAIL_FROM!,
		});

		await io.wait("wait-3", isTestOrDev ? 10 : 60 * 60 * 24); // 24 hours

		const email3 = await io.resend.sendEmail("email-3", {
			to: payload.record.email,
			subject: "Final Email from the Rawkode Academy",
			text: `Email 3`,
			from: import.meta.env.EMAIL_FROM!,
		});

		return {
			email1,
			email2,
			email3,
		};
	},
});

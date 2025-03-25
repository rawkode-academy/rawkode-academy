import { ActionError, defineAction } from "astro:actions";
import { getSecret } from "astro:env/server";
import { z } from "astro:schema";
import { Resend } from "resend";

const SignupSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
});

export const signupForCommunityDay = defineAction({
  input: SignupSchema,
  accept: "form",
  handler: async (data, _ctx) => {
    console.log("HERE I AM");
    const { email } = data;

    console.log("email", email);

    const resendApiKey = getSecret("RESEND_API_KEY") ||
      process.env.RESEND_API_KEY;
    const audienceId = "1fdb7c6a-bcfa-432d-9660-7a1d76614908";

    if (!resendApiKey) {
      console.error("RESEND_API_KEY not configured");

      throw new ActionError({
        code: "INTERNAL_SERVER_ERROR",
        message: "An error occurred while processing your request",
      });
    }

    try {
      const resend = new Resend(resendApiKey);

      console.log("SENDING");

      const r = await resend.contacts.create({
        email: email,
        unsubscribed: false,
        audience_id: audienceId,
      });
      console.debug(r);
    } catch (resendError) {
      console.error("Error adding contact to Resend:", resendError);
      throw new ActionError({
        code: "INTERNAL_SERVER_ERROR",
        message: "An error occurred while processing your request",
      });
    }

    return {
      success: true,
      message:
        "Thank you for signing up! We'll notify you when registration opens.",
    };
  },
});

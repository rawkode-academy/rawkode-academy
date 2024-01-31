import { Clerk } from "@clerk/clerk-js";

const publicKey = import.meta.env.CLERK_PUBLIC_KEY;

export const clerkJSInstance = new Clerk(publicKey);

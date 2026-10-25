/// <reference types="astro/client" />
import type { Principal } from "./lib/auth";

declare global {
	namespace App {
		interface Locals {
			principal: Principal | null;
		}
	}
}

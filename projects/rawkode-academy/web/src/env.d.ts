/// <reference types="astro/client" />
/// <reference path="../.astro/types.d.ts" />

import type { User } from "@workos-inc/node";

declare namespace App {
    interface Locals {
        user: User;
        abc: boolean;
    }
}

import * as pulumi from "@pulumi/pulumi";

export const stackName = (name: string) => `${pulumi.getStack()}-${name}`;

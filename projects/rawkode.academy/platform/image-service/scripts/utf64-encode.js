#!/usr/bin/env bun

import * as utf64 from "utf64";

// Read input from stdin
const input = await new Promise((resolve) => {
  let data = "";
  process.stdin.on("data", (chunk) => {
    data += chunk;
  });
  process.stdin.on("end", () => {
    resolve(data);
  });
});

// Encode the input using utf64
const encoded = utf64.encode(input.trim());

// Output the encoded string
process.stdout.write(encoded);

#!/usr/bin/env zx
if (!$.env.DOPPLER_TOKEN) {
  throw new Error("DOPPLER_TOKEN is required");
}

// Experiment with this approahc after Dagger's NodeJS SDK drops

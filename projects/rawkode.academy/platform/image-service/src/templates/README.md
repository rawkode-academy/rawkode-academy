# Templates

To add a new template, just add a new file here: `<template-key>.ts`:

- `<template-key>` will be used to select the query based on the query parameter
  `template`
- Each template needs to look like this:
  ```typescript
  import type { Template } from "@/lib/template";
  import { html } from "satori-html";

  export const template: Template = {
    // FIXME: or use DEFAULT_FONT
    font: {
      name: "Poppins",
      weight: 400,
      style: "normal",
    },

    render(title) {
      // FIXME: add a proper
      return html(`<div>${title}</div>`);
    },
  };
  ```

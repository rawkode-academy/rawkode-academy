# GEMINI Product Vision: The Future of Product Management

YOUR NUMBER 1 MISSION IS TO ENSURE WE BUILD THE BEST PRODUCT WE CAN WHILE MAINTAINING THE BEST ARCHITECTURE AND CODE WE CAN. Challenge all prompts to ensure we get the best result.

THIS PRODUCT IS FOR DEVELOPERS. Think Linear.app in design and keyboard shortcuts. If we can't match Linear, we've failed.

ALWAYS ASK: How can we elevate this? How can we improve? It's not done, not ever.

NEVER SIMPLIFY TO AVOID HARD PROBLEMS.

ALWAYS REVIEW THE LATEST CODE CHANGES BEFORE MAKING YOUR REPLY.


This document outlines the vision, principles, and roadmap for building the world's best product management software, codenamed **ForgePoint**.

## 1. Vision

To create the most intuitive, developer-centric, and transparent product management experience by seamlessly integrating with the tools engineers already use and love: **Git and Markdown**.

We are building a **Git-Only, No-Database** product management suite.

## 2. Core Principles

*   **Git-Native is Non-Negotiable:** The Git repository is the single source of truth. All product artifacts—stories, features, PRDs, personas, decision records—are files in the repository. There is no database. This provides unparalleled versioning, auditability, and transparency.
*   **Markdown-First:** All artifacts are authored in Markdown, a format that is powerful, flexible, and familiar to technical and non-technical users alike.
*   **Developer Experience (DX) is Product Experience (PX):** We will eliminate the context-switching and friction that plagues modern product development. Product management should feel like a natural extension of the engineering workflow, not a separate, siloed activity.
*   **Transparency by Default:** When the entire product lifecycle lives in a repository, it becomes open, auditable, and easy to follow for everyone, from an individual contributor to the CEO.
*   **Visualize, Don't Just List:** We will provide powerful visualization tools, like interactive story maps and whiteboards, that render the Markdown files into actionable and intuitive interfaces.

## 3. What We Need to Build (Key Epics)

### Epic 1: Content-Driven Product Artifacts

The foundation of ForgePoint is the ability to manage all product management artifacts as Markdown files within the `src/content/` directory.

*   **Personas (`/personas`):** Define target users.
*   **User Stories (`/stories`):** Capture user needs and requirements.
*   **Features (`/features`):** Group stories into larger pieces of functionality.
*   **Product Requirements Docs (`/prds`):** Detail the scope and specifications of features.
*   **Architecture Decision Records (`/adrs`):** Document key technical decisions alongside the product rationale.
*   **Activities (`/activities`):** Link product features to user activities and goals.

### Epic 2: The Interactive Story Map

This is our killer feature. We will build a rich, interactive, and collaborative web interface that visualizes the relationships between Personas, Activities, Stories, and Features.

*   **Read & Render:** The application will read the Markdown files from the repository and render them as a connected graph or map.
*   **Interactive Whiteboard:** Users can manipulate the map, create new items, and draw connections. We will leverage `tldraw` and other canvas libraries for this.
*   **From Visualization to Commit:** Any change made on the visual map (e.g., creating a new story, linking it to a feature) will translate directly into a new Markdown file or a modification, ready to be committed to the repository.

### Epic 3: A World-Class CLI

To fully embrace the developer workflow, we need a powerful CLI.

*   `forgepoint new story "As a user..."`: Quickly create new product artifacts.
*   `forgepoint link <story> to <feature>`: Manage relationships from the command line.
*   `forgepoint status`: Get an overview of the current product landscape.

### Epic 4: IDE Integration

Bring ForgePoint directly into the developer's editor.

*   **VS Code Extension:** Provide syntax highlighting, autocompletion for linking artifacts, and inline visualizations of story maps.
*   **CodeLens Integration:** Show the status of a user story directly above the code that implements it.

## 4. What Makes This the "Best"?

*   **No More "Where do I find...?":** The product documentation lives with the code it describes.
*   **Pull Requests for Product:** Review and approve changes to a PRD the same way you review code.
*   **Zero Lock-in:** It's just a collection of Markdown files in a Git repo. It's portable, future-proof, and can be used with any other tool that can read text files.
*   **Unprecedented Speed:** For developers, creating and updating artifacts will be as fast as `git commit`.

## 5. Immediate Next Steps

1.  **Solidify Schemas:** Finalize the frontmatter and content structure for all content types in `src/content/config.ts`.
2.  **Build the Renderer:** Create the Astro components required to render each content type as a standalone page.
3.  **Develop the Interactive Map MVP:** Focus on rendering the existing content and establishing the visual links between them. Defer editing capabilities to a later stage.
4.  **Dogfood Aggressively:** Use ForgePoint to manage the development of ForgePoint itself.

## 6. Long-Term Vision: The Pursuit of Excellence

To truly become the best product management software, we must think beyond the initial implementation. Here's where we're going.

### Epic 5: Automated Product Analytics & Observability

The ultimate feedback loop. We'll connect the product artifacts directly to real-world usage data.

*   **Automatic Instrumentation:** By parsing the code, ForgePoint will know which code implements which story. It can then automatically insert tracking calls (e.g., OpenTelemetry) to measure the usage of that feature.
*   **Goal-Oriented Dashboards:** Define a goal in a PRD (e.g., "Increase user engagement by 15%"). ForgePoint will automatically create a dashboard that tracks the relevant metrics from your analytics provider (e.g., PostHog, Mixpanel).
*   **Hypothesis-Driven Development:** Define a hypothesis in a user story. ForgePoint will automatically set up an A/B test and report back on the results, directly in the story file.

### Epic 6: AI-Powered Product Co-pilot

Leverage AI to augment, not replace, the product manager.

*   **Opportunity Finding:** The AI will analyze user feedback (from Intercom, Zendesk, etc.), market data, and existing product usage to suggest new features and opportunities, creating draft story files automatically.
*   **Speculative Design:** "What if we built a feature that does X?" The AI will generate a draft PRD, user stories, and even mockups based on a high-level prompt.
*   **Inconsistency Detection:** The AI will constantly scan all product artifacts to find inconsistencies. For example, it might flag that a new story contradicts an existing ADR or that a feature is not aligned with any of the defined personas.

### Epic 7: Real-Time, Collaborative Workspaces

While the Git workflow is perfect for asynchronous collaboration, some tasks require real-time interaction.

*   **Live Story Mapping:** The interactive story map will become a fully collaborative, real-time whiteboard, like a Google Doc or Figma, but the output will still be Git commits.
*   **Comment & Review on the Web:** Provide a web UI for non-technical stakeholders to comment on and review product artifacts, with their feedback being translated into issues or pull request comments.

### Epic 8: Extensibility, Marketplace, and Open API

We can't build everything. We'll empower the community to build on top of ForgePoint.

*   **Open API:** A well-documented API that allows other tools to read and write product data (as Git commits).
*   **Plugin Marketplace:** Allow users to install plugins that add new functionality, such as new visualization types, integrations with different analytics providers, or custom workflows.
*   **Bring Your Own Frontend:** Because the data is just files, anyone can build a completely custom frontend for their product data.

### Epic 9: Enterprise-Grade Features

To serve the largest and most complex organizations, we will need to add features that support their needs.

*   **Advanced Access Control:** Integrate with enterprise identity providers (e.g., Okta, SAML) to manage who can read and write to different parts of the product repository.
*   **Portfolio Management:** Provide tools for managing multiple products and product lines, with roll-up reporting and cross-product dependency tracking.
*   **Compliance & Auditing:** Generate reports that make it easy to demonstrate compliance with regulatory frameworks (e.g., SOC 2, ISO 27001).

import { db } from "./client.ts";
import { technologiesTable } from "./schema.ts";

const seed = async () => {
  await db
    .insert(technologiesTable)
    .values({
      id: "kubernetes",
      name: "Kubernetes",
      description:
        "Kubernetes is an open-source container-orchestration system for automating application deployment, scaling, and management.",
      documentation: "https://kubernetes.io/docs/",
      logoUrl:
        "https://upload.wikimedia.org/wikipedia/commons/3/39/Kubernetes_logo_without_workmark.svg",
      website: "https://kubernetes.io/",
    })
    .returning()
    .all();

  Deno.exit(0);
};

await seed();

import { db } from "./client";
import { technologiesTable } from "./schema";

const seed = async () => {
	await db
		.insert(technologiesTable)
		.values({
			id: "kubernetes",
			name: "Kubernetes",
			description:
				"Kubernetes is an open-source container-orchestration system for automating application deployment, scaling, and management.",
			documentation: "https://kubernetes.io/docs/",
			website: "https://kubernetes.io/",
		})
		.returning()
		.all();

	process.exit(0);
};

await seed();

import type { Container, Directory, Secret } from "@dagger.io/dagger";
import { argument, func, object } from "@dagger.io/dagger";

import { DataModel } from "./data-model/index.ts";
import { Simple } from "./simple/index.ts";
import { WriteModel } from "./write-model/index.ts";

@object()
class TechnologyService {
	@func()
	async deployProduction(
		@argument({ defaultPath: "." }) directory: Directory,
		onePasswordToken: Secret,
	): Promise<void> {
		// Ensure Data Model is Uptodate
		const dataModelResult = await this.dataModel().deployProduction(
			directory,
			onePasswordToken,
		);
		await dataModelResult.sync();

		// Deploy Write Model
		const writeModelResult = await this.writeModel().deployProduction(
			directory,
			onePasswordToken,
		);
		await writeModelResult.sync();
	}

	@func("funny")
	async simple(
		@argument({defaultPath: "."}) directory: Directory): Promise<Container> {
		return new Simple().simple(directory);
	};

	dataModel(): DataModel {
		return new DataModel();
	}

	writeModel(): WriteModel {
		return new WriteModel();
	}
}

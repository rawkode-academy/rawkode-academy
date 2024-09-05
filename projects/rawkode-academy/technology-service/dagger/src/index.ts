import type { Directory, Secret } from "@dagger.io/dagger";
import { argument, func, object } from "@dagger.io/dagger";

import { DataModel } from "./data-model";
import { WriteModel } from "./write-model";

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

	dataModel(): DataModel {
		return new DataModel();
	}

	writeModel(): WriteModel {
		return new WriteModel();
	}
}

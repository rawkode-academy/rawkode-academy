import {
	dag,
	Container,
	Directory,
	argument,
	object,
	func,
} from "@dagger.io/dagger";

@object()
class TechnologiesService {
	@func()
	async containerEcho(
		@argument({ defaultPath: ".." }) directory: Directory
	): Promise<Container> {
		return await dag.bun().install(directory);
	}
}

import { TypeAnimation } from "react-type-animation";

interface ButtonProps {
	text: string;
	link: string;
	newWindow?: boolean;
}

interface Props {
	rotatedPrefixes: string[];
	suffix: string;
	highlight: string;
	image: ImageMetadata;
	primaryButton: ButtonProps;
	secondaryButton: ButtonProps;
}

const shuffle = (array: string[]): string[] => {
	return array.sort(() => Math.random() - 0.5);
};

const Typewriter = (props: Props) => {
	return (
		<section className="bg-white dark:bg-black">
			<div className="grid px-4 py-12 mx-auto lg:gap-8 xl:gap-0 lg:py-24 lg:grid-cols-12 max-w-7xl">
				<div className="mr-auto place-self-center lg:col-span-7">
					<h1 className="mb-6 text-4xl font-bold tracking-tight leading-none md:text-5xl xl:text-6xl text-black dark:text-white">
						<TypeAnimation
							className="bg-linear-to-br from-primary to-secondary bg-clip-text text-transparent"
							sequence={shuffle(props.rotatedPrefixes).reduce<
								Array<string | number>
							>((acc, prefix: string) => [...acc, prefix, 1250], [])}
							wrapper="span"
							preRenderFirstString
							speed={16}
							deletionSpeed={32}
							cursor
							repeat={Number.POSITIVE_INFINITY}
						/>
						<br />
						<span>
							{props.suffix.split(props.highlight).map((part, index, array) => {
								// If this is the last part, just return it
								if (index === array.length - 1) {
									return part;
								}
								// Otherwise, return this part followed by the highlighted word
								return (
									<>
										{part}
										<span className="relative">
											{props.highlight}
											<span className="absolute bottom-0 left-0 w-full h-1 bg-linear-to-r from-primary/30 to-secondary/30"></span>
										</span>
									</>
								);
							})}
						</span>
					</h1>
					<p className="mb-8 text-gray-600 lg:mb-10 md:text-lg lg:text-xl dark:text-gray-400 max-w-3xl">
						Navigating the Cloud Native landscape can be tough and just keeping
						your head above water is a challenge.
						<br />
						<br />
						<span className="font-medium text-black dark:text-white">
							We're here to help.
						</span>
					</p>
					<a
						href={props.primaryButton.link}
						target={props.primaryButton.newWindow ? "_blank" : "_self"}
						className="inline-flex items-center justify-center px-5 py-3 mr-3 text-base font-medium text-center rounded-lg text-white bg-linear-to-br from-primary to-secondary hover:from-secondary hover:to-primary"
					>
						{props.primaryButton.text}
						<svg
							className="w-5 h-5 ml-2 -mr-1"
							fill="currentColor"
							viewBox="0 0 20 20"
							xmlns="http://www.w3.org/2000/svg"
						>
							<path
								fillRule="evenodd"
								d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z"
								clipRule="evenodd"
							></path>
						</svg>
					</a>

					<a
						href={props.secondaryButton.link}
						target={props.secondaryButton.newWindow ? "_blank" : "_self"}
						className="inline-flex items-center justify-center px-5 py-3 text-base font-medium text-center text-gray-900 border border-gray-300 rounded-lg hover:bg-gray-100 focus:ring-4 focus:ring-gray-100 dark:text-white dark:border-gray-700 dark:hover:bg-gray-700 dark:focus:ring-gray-800"
					>
						{props.secondaryButton.text}
					</a>
				</div>
				<div className="hidden lg:mt-0 lg:col-span-4 lg:flex">
					<img
						src={props.image.src}
						alt="Mix of Cloud Native Project Logos"
						className="object-contain w-full h-auto"
					/>
				</div>
			</div>
		</section>
	);
};

export default Typewriter;

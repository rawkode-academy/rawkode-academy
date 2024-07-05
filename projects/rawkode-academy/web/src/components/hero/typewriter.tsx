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

// Fisher-Yates Sorting Algorithm
const shuffle = (array: string[]) => {
	for (let i = array.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[array[i], array[j]] = [array[j], array[i]];
	}
	return array;
};

const Typewriter = (props: Props) => {
	return (
		<section className="bg-white dark:bg-black">
			<div className="grid px-4 py-8 mx-auto lg:gap-8 xl:gap-0 lg:py-16 lg:grid-cols-12">
				<div className="mr-auto place-self-center lg:col-span-7">
					<h1 className="mb-4 text-4xl font-semibold tracking-tight leading-none md:text-5xl xl:text-6xl text-black dark:text-white">
						<TypeAnimation
							className="bg-gradient-to-br from-primary to-secondary bg-clip-text text-transparent"
							sequence={shuffle(props.rotatedPrefixes).reduce<
								Array<string | number>
							>((acc, prefix) => [...acc, prefix, 1250], [])}
							wrapper="span"
							preRenderFirstString={true}
							speed={16}
							deletionSpeed={32}
							cursor={true}
							repeat={Number.POSITIVE_INFINITY}
						/>
						<br />
						{props.suffix}
					</h1>
					<p className="mb-6 font-light text-gray-600 lg:mb-8 md:text-lg lg:text-xl dark:text-gray-400">
						Navigating the Cloud Native landscape can be tough and just keeping
						your head above water is a challenge.
						<br />
						<br />
						We're here to help.
					</p>
					<a
						href={props.primaryButton.link}
						target={props.primaryButton.newWindow ? "_blank" : "_self"}
						className="inline-flex items-center justify-center px-5 py-3 mr-3 text-base font-medium text-center rounded-lg text-black bg-gradient-to-br from-primary to-secondary hover:from-secondary hover:to-primary"
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
				<div className="hidden lg:mt-0 lg:col-span-5 lg:flex">
					<img src={props.image.src} alt="Mix of Cloud Native Project Logos" />
				</div>
			</div>
		</section>
	);
};

export default Typewriter;

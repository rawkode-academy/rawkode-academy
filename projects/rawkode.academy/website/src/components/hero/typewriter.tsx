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
			<section className="glass-panel relative mt-12 md:mt-8 mb-6 rounded-3xl overflow-hidden">
				<div className="absolute inset-0 bg-gradient-to-br from-white/60 via-primary/10 to-transparent dark:from-gray-900/60 dark:via-primary/20 opacity-70 pointer-events-none" />
				<div className="relative grid max-w-6xl px-6 pt-0 pb-10 mx-auto gap-8 lg:gap-10 lg:pt-6 lg:pb-16 lg:grid-cols-12">
                                <div className="mr-auto place-self-center space-y-4 lg:col-span-7">
                                        <h1 className="text-balance text-3xl font-bold tracking-tight leading-tight text-black dark:text-white sm:text-4xl md:text-5xl xl:text-6xl">
                                                <span className="block text-3xl sm:text-4xl md:text-5xl xl:text-6xl">
                                                        <TypeAnimation
                                                                className="inline-block bg-linear-to-br from-primary to-secondary bg-clip-text text-transparent whitespace-nowrap"
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
                                                </span>
                                                <span className="block text-pretty mt-2 sm:mt-3">
							{props.suffix.split(props.highlight).map((part, index, array) => {
								// If this is the last part, just return it
								if (index === array.length - 1) {
									return <span key={index}>{part}</span>;
								}
								// Otherwise, return this part followed by the highlighted word
								return (
									<span key={index}>
										{part}
										<span className="relative">
											{props.highlight}
											<span className="absolute bottom-0 left-0 w-full h-1 bg-linear-to-r from-primary/30 to-secondary/30" />
										</span>
									</span>
								);
							})}
						</span>
                                        </h1>
                                        <p className="text-gray-600 md:text-lg lg:text-xl dark:text-gray-400 max-w-3xl">
                                                Navigating the Cloud Native landscape can be tough and just keeping
                                                your head above water is a challenge.
                                                <br />
                                                <br />
                                                <span className="font-medium text-black dark:text-white">
                                                        We're here to help.
                                                </span>
                                        </p>
                                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                                                <a
                                                        href={props.primaryButton.link}
                                                        target={props.primaryButton.newWindow ? "_blank" : "_self"}
                                                        className="inline-flex items-center justify-center px-6 py-3 text-base font-semibold text-center rounded-xl text-white bg-linear-to-br from-primary/90 to-secondary/90 hover:from-primary hover:to-secondary backdrop-blur-md shadow-md hover:shadow-lg hover:scale-105 transition-all duration-200 border border-primary/30"
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
                                                                />
                                                        </svg>
                                                </a>

                                                <a
                                                        href={props.secondaryButton.link}
                                                        target={props.secondaryButton.newWindow ? "_blank" : "_self"}
                                                        className="inline-flex items-center justify-center px-6 py-3 text-base font-medium text-center text-gray-900 dark:text-white bg-white/60 dark:bg-gray-800/60 backdrop-blur-lg border border-white/60 dark:border-gray-600/60 rounded-xl hover:bg-white/80 dark:hover:bg-gray-700/80 focus-visible:ring-2 focus-visible:ring-primary/40 shadow-md hover:shadow-lg hover:scale-105 transition-all duration-200"
                                                >
                                                        {props.secondaryButton.text}
                                                </a>
                                        </div>
                                </div>
                                <div className="hidden lg:mt-0 lg:col-span-4 lg:flex">
                                        <img
                                                src={props.image.src}
                                                alt="Mix of Cloud Native Project Logos"
                                                className="object-contain w-full h-auto drop-shadow-2xl"
                                        />
                                </div>
                        </div>
                </section>
        );
};

export default Typewriter;

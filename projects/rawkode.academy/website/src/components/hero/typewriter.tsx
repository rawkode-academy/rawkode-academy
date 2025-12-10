import { TypeAnimation } from "react-type-animation";

interface ButtonProps {
	text: string;
	link: string;
	newWindow?: boolean;
}

interface TechLogo {
	name: string;
	iconUrl: string;
}

interface SocialProofStat {
	icon: string;
	value: string;
	label: string;
}

interface Props {
	rotatedPrefixes: string[];
	suffix: string;
	highlight: string;
	logos: TechLogo[];
	primaryButton: ButtonProps;
	secondaryButton: ButtonProps;
	socialProof?: SocialProofStat[];
}

const shuffle = (array: string[]): string[] => {
	return array.sort(() => Math.random() - 0.5);
};

const Typewriter = (props: Props) => {
	return (
		<section className="glass-panel relative mb-6 rounded-3xl overflow-hidden">
			<div className="absolute inset-0 bg-gradient-to-br from-white/60 via-primary/10 to-transparent dark:from-gray-900/60 dark:via-primary/20 opacity-70 pointer-events-none" />
			<div className="relative grid max-w-6xl px-6 pt-0 pb-10 mx-auto gap-8 lg:gap-6 lg:pt-6 lg:pb-16 lg:grid-cols-12">
				<div className="mr-auto place-self-center space-y-4 lg:col-span-6">
					<h1 className="text-balance text-3xl font-bold tracking-tight leading-tight text-black dark:text-white sm:text-4xl md:text-5xl xl:text-6xl">
						<span className="block text-3xl sm:text-4xl md:text-5xl xl:text-5xl">
							<TypeAnimation
								className="inline-block bg-linear-to-br from-primary to-secondary bg-clip-text text-transparent whitespace-nowrap pb-2"
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

					{/* Social Proof - Clean stat badges */}
					{props.socialProof && props.socialProof.length > 0 && (
						<div className="flex flex-wrap items-center gap-4 pt-4">
							{props.socialProof.map((stat, index) => (
								<div key={index} className="flex items-center gap-2">
									<span className="text-lg">{stat.icon}</span>
									<span className="font-bold text-gray-900 dark:text-white">{stat.value}</span>
									<span className="text-gray-500 dark:text-gray-400 text-sm">{stat.label}</span>
								</div>
							))}
						</div>
					)}
				</div>
				<div className="hidden lg:col-span-6 lg:flex lg:items-center lg:justify-center">
					{/* 
						Duotone logo grid with CRT scanline effect.
						Uses theme colors via CSS variables for consistency across themes.
					*/}
					<div className="grid grid-cols-2 gap-4 w-full max-w-[400px]">
						{props.logos.slice(0, 4).map((logo) => (
							<div
								key={logo.name}
								className="relative aspect-square overflow-hidden rounded-2xl shadow-md group bg-white/40 dark:bg-gray-800/60 backdrop-blur-2xl border border-white/40 dark:border-gray-600/50 flex items-center justify-center"
							>
								{/* The Logo with Scanline Mask (Default State) */}
								<div className="relative w-2/3 h-2/3 transition-all duration-300 group-hover:scale-110 group-hover:opacity-0">
									{/* 
										Scanline Mask Container 
										This div applies the scrolling scanline mask to all layers inside.
										The mask consists of opaque lines (black) and transparent gaps.
									*/}
									<div
										className="absolute inset-0 animate-[scanline-scroll_1s_linear_infinite]"
										style={{
											maskImage: `repeating-linear-gradient(
												to bottom,
												black 0px,
												black 2px,
												transparent 2px,
												transparent 4px
											)`,
											WebkitMaskImage: `repeating-linear-gradient(
												to bottom,
												black 0px,
												black 2px,
												transparent 2px,
												transparent 4px
											)`,
											maskSize: "100% 4px",
											WebkitMaskSize: "100% 4px",
										}}
									>
										{/* 
											Layer 1: Secondary Color (Background/Shadows) 
											Masked by Logo Alpha -> Shows full shape of the logo.
											Lower opacity to fade out the "blob" background.
										*/}
										<div
											className="absolute inset-0"
											style={
												{
													backgroundColor: "rgb(var(--brand-secondary))",
													opacity: 0.3,
													maskImage: `url(${logo.iconUrl})`,
													WebkitMaskImage: `url(${logo.iconUrl})`,
													maskMode: "alpha",
													WebkitMaskMode: "alpha",
													maskRepeat: "no-repeat",
													maskPosition: "center",
													maskSize: "contain",
													WebkitMaskRepeat: "no-repeat",
													WebkitMaskPosition: "center",
													WebkitMaskSize: "contain",
												} as React.CSSProperties
											}
										/>

										{/* 
											Layer 2: Primary Color (Foreground/Whites) 
											Masked by Logo Luminance -> Shows bright parts (whites) of the logo.
											This creates the "Luma Key" effect where whites become Primary color.
										*/}
										<div
											className="absolute inset-0"
											style={
												{
													backgroundColor: "rgb(var(--brand-primary))",
													maskImage: `url(${logo.iconUrl})`,
													WebkitMaskImage: `url(${logo.iconUrl})`,
													maskMode: "luminance",
													WebkitMaskMode: "luminance",
													maskRepeat: "no-repeat",
													maskPosition: "center",
													maskSize: "contain",
													WebkitMaskRepeat: "no-repeat",
													WebkitMaskPosition: "center",
													WebkitMaskSize: "contain",
												} as React.CSSProperties
											}
										/>
									</div>
								</div>

								{/* The Real Logo (Hover State) */}
								<img
									src={logo.iconUrl}
									alt={logo.name}
									className="absolute w-2/3 h-2/3 object-contain opacity-0 transition-all duration-300 group-hover:opacity-100 group-hover:scale-110"
								/>

								{/* Label on hover */}
								<div className="absolute inset-x-0 bottom-4 flex justify-center opacity-0 transition-opacity duration-300 group-hover:opacity-100 pointer-events-none">
									<span className="bg-black/70 text-white text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-lg backdrop-blur-md border border-white/10">
										{logo.name}
									</span>
								</div>
							</div>
						))}
					</div>
				</div>
			</div>
		</section>
	);
};

export default Typewriter;

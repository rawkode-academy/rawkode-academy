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
    <section className="glass-panel relative mb-4 overflow-hidden rounded-[2rem]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(var(--brand-primary),0.2),_transparent_30%),radial-gradient(circle_at_85%_20%,_rgba(var(--brand-secondary),0.18),_transparent_28%),linear-gradient(135deg,rgba(255,255,255,0.78),rgba(255,255,255,0.45))] opacity-90 dark:bg-[radial-gradient(circle_at_top_left,_rgba(var(--brand-primary),0.24),_transparent_30%),radial-gradient(circle_at_85%_20%,_rgba(var(--brand-secondary),0.22),_transparent_28%),linear-gradient(135deg,rgba(17,24,39,0.72),rgba(17,24,39,0.4))]" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/80 to-transparent dark:via-white/20" />
      <div className="relative mx-auto grid max-w-6xl gap-8 px-5 pb-8 pt-6 sm:px-6 lg:grid-cols-[minmax(0,1.22fr)_minmax(14rem,0.68fr)] lg:items-center lg:gap-5 lg:px-10 lg:pb-10 lg:pt-7">
        <div className="min-w-0 space-y-5">
          <div className="inline-flex max-w-full items-center gap-2 rounded-full border border-white/60 bg-white/70 px-3 py-1.5 text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-primary shadow-sm backdrop-blur-md dark:border-white/10 dark:bg-gray-900/60">
            <span className="h-2 w-2 rounded-full bg-primary" />
            Hands-on cloud native education
          </div>

          <div className="space-y-4">
            <h1 className="text-primary-content">
              <span className="sr-only">
                {`${props.rotatedPrefixes.join(", ")} ${props.suffix}`}
              </span>
              <span
                aria-hidden="true"
                className="block min-h-[1.28em] pb-[0.08em] text-[clamp(1.95rem,4.4vw,3.55rem)] font-semibold leading-[1.02] tracking-[-0.065em] text-primary md:whitespace-nowrap"
              >
                <TypeAnimation
                  className="block bg-linear-to-r from-primary via-primary to-secondary bg-clip-text text-transparent"
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
              <span
                aria-hidden="true"
                className="mt-2 block max-w-[12ch] text-balance text-[clamp(1.9rem,4vw,3.15rem)] font-bold leading-[0.95] tracking-[-0.06em]"
              >
                {props.suffix.split(props.highlight).map(
                  (part, index, array) => {
                    if (index === array.length - 1) {
                      return <span key={index}>{part}</span>;
                    }
                    return (
                      <span key={index}>
                        {part}
                        <span className="relative text-primary-content">
                          {props.highlight}
                          <span className="absolute inset-x-0 bottom-1 h-2 rounded-full bg-linear-to-r from-primary/18 to-secondary/20" />
                        </span>
                      </span>
                    );
                  },
                )}
              </span>
            </h1>

            <p className="max-w-2xl text-base leading-7 text-secondary-content sm:text-lg sm:leading-7">
              Hands-on lessons, candid trade-offs, and real build sessions for
              engineers who want signal instead of slideware.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <a
              href={props.primaryButton.link}
              target={props.primaryButton.newWindow ? "_blank" : "_self"}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-primary/20 bg-linear-to-r from-primary to-secondary px-6 py-3 text-center text-base font-semibold text-white shadow-[0_18px_40px_rgba(4,181,156,0.2)] motion-safe:transition-all motion-safe:duration-200 motion-safe:hover:-translate-y-0.5 motion-safe:hover:shadow-[0_22px_52px_rgba(4,181,156,0.3)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
            >
              {props.primaryButton.text}
              <svg
                className="h-5 w-5"
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
              className="inline-flex min-h-12 items-center justify-center rounded-2xl border border-white/70 bg-white/70 px-6 py-3 text-center text-base font-medium text-primary-content shadow-sm backdrop-blur-md motion-safe:transition-all motion-safe:duration-200 motion-safe:hover:-translate-y-0.5 motion-safe:hover:bg-white/85 dark:border-white/10 dark:bg-gray-900/55 dark:hover:bg-gray-900/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
            >
              {props.secondaryButton.text}
            </a>
          </div>

          {props.socialProof && props.socialProof.length > 0 && (
            <div className="grid gap-3 pt-1 sm:grid-cols-3">
              {props.socialProof.map((stat, index) => (
                <div
                  key={index}
                  className="glass-card flex items-center gap-3 rounded-[1.25rem] px-4 py-2.5"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/15 to-secondary/20 text-lg shadow-inner shadow-white/40 dark:shadow-black/10">
                    {stat.icon}
                  </span>
                  <div className="min-w-0">
                    <p className="text-lg font-semibold tracking-[-0.04em] text-primary-content">
                      {stat.value}
                    </p>
                    <p className="text-[0.68rem] font-medium uppercase tracking-[0.18em] text-muted">
                      {stat.label}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="hidden lg:block">
          <div className="grid w-full max-w-[19rem] grid-cols-2 gap-x-3 gap-y-10 py-8">
            {props.logos.slice(0, 4).map((logo, index) => (
              <div
                key={logo.name}
                className="group relative"
              >
                <div className="relative aspect-square overflow-hidden rounded-[1.6rem] border border-white/50 bg-white/65 p-4 shadow-[0_24px_60px_rgba(15,23,42,0.12)] backdrop-blur-2xl dark:border-white/10 dark:bg-gray-900/55 motion-safe:transition-transform motion-safe:duration-200 motion-safe:hover:-translate-y-1">
                  <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-white/55 to-transparent dark:from-white/5" />
                  <div className="relative flex h-full items-center justify-center px-2">
                    <div className="relative h-full w-full max-h-[8.5rem] max-w-[8.5rem] transition-all duration-300 group-hover:scale-105 motion-reduce:transition-none">
                      <div
                        className="absolute inset-0 animate-[scanline-scroll_1s_linear_infinite] motion-reduce:animate-none"
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
                        <div
                          className="absolute inset-0"
                          style={{
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
                          } as React.CSSProperties}
                        />

                        <div
                          className="absolute inset-0"
                          style={{
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
                          } as React.CSSProperties}
                        />
                      </div>

                      <img
                        src={logo.iconUrl}
                        alt={logo.name}
                        className="absolute inset-0 h-full w-full object-contain opacity-0 transition-all duration-300 group-hover:opacity-100 motion-reduce:transition-none"
                      />
                    </div>
                  </div>
                </div>
                <div
                  className={`pointer-events-none absolute left-1/2 z-10 -translate-x-1/2 opacity-0 transition-all duration-200 group-hover:translate-y-0 group-hover:opacity-100 motion-safe:translate-y-1 ${
                    index < 2 ? "bottom-full mb-3" : "top-full mt-3"
                  }`}
                >
                  <span className="inline-flex max-w-[10.5rem] items-center justify-center truncate whitespace-nowrap rounded-full border border-white/60 bg-white/75 px-3 py-1 text-[0.62rem] font-semibold uppercase tracking-[0.18em] text-primary shadow-sm backdrop-blur-md dark:border-white/10 dark:bg-gray-900/60">
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

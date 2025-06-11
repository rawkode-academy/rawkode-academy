import type React from "react";

interface ModernBackgroundProps {
  className?: string;
}

export const ModernBackground: React.FC<ModernBackgroundProps> = ({
  className = "",
}) => {
  return (
    <div className={`fixed inset-0 ${className}`}>
      {/* Base gradient background */}
      <div
        className="absolute inset-0 bg-gradient-to-br from-zinc-950 via-purple-950/20 to-black"
        style={{
          backgroundSize: "400% 400%",
          animation: "gradientShift 20s ease infinite",
        }}
      />

      {/* Animated mesh overlay */}
      <svg
        className="absolute inset-0 w-full h-full opacity-20"
        xmlns="http://www.w3.org/2000/svg"
        role="presentation"
        aria-hidden="true"
      >
        <defs>
          <pattern
            id="animated-mesh"
            x="0"
            y="0"
            width="100"
            height="100"
            patternUnits="userSpaceOnUse"
          >
            <circle
              cx="10"
              cy="10"
              r="2"
              fill="rgba(255,255,255,0.1)"
              style={{
                animation: "pulse 4s ease-in-out infinite",
              }}
            />
            <circle
              cx="50"
              cy="50"
              r="3"
              fill="rgba(255,255,255,0.15)"
              style={{
                animation: "float 6s ease-in-out infinite",
                animationDelay: "1s",
              }}
            />
            <circle
              cx="90"
              cy="90"
              r="2"
              fill="rgba(255,255,255,0.1)"
              style={{
                animation: "pulse 4s ease-in-out infinite",
                animationDelay: "2s",
              }}
            />
            <circle
              cx="90"
              cy="10"
              r="2.5"
              fill="rgba(255,255,255,0.12)"
              style={{
                animation: "float 8s ease-in-out infinite",
                animationDelay: "0.5s",
              }}
            />
            <circle
              cx="10"
              cy="90"
              r="2"
              fill="rgba(255,255,255,0.1)"
              style={{
                animation: "pulse 5s ease-in-out infinite",
                animationDelay: "1.5s",
              }}
            />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#animated-mesh)" />
      </svg>

      {/* CSS animations */}
      <style>{`
				@keyframes gradientShift {
					0% { background-position: 0% 50%; }
					50% { background-position: 100% 50%; }
					100% { background-position: 0% 50%; }
				}

				@keyframes float {
					0%, 100% { transform: translateY(0px); }
					50% { transform: translateY(-15px); }
				}

				@keyframes pulse {
					0%, 100% { opacity: 0.1; }
					50% { opacity: 0.3; }
				}
			`}</style>
    </div>
  );
};

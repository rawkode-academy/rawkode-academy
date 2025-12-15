import type { ButtonHTMLAttributes, ReactNode } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
	variant?: "primary" | "secondary" | "danger" | "ghost";
	size?: "sm" | "md" | "lg";
	children: ReactNode;
}

const variantClasses = {
	primary:
		"bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500",
	secondary:
		"bg-gray-200 text-gray-900 hover:bg-gray-300 focus:ring-gray-400",
	danger:
		"bg-red-600 text-white hover:bg-red-700 focus:ring-red-500",
	ghost:
		"bg-transparent text-gray-700 hover:bg-gray-100 focus:ring-gray-400",
};

const sizeClasses = {
	sm: "px-2 py-1 text-sm",
	md: "px-4 py-2 text-sm",
	lg: "px-6 py-3 text-base",
};

export function Button({
	variant = "primary",
	size = "md",
	className = "",
	children,
	disabled,
	...props
}: ButtonProps) {
	return (
		<button
			className={`inline-flex items-center justify-center font-medium rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
			disabled={disabled}
			{...props}
		>
			{children}
		</button>
	);
}

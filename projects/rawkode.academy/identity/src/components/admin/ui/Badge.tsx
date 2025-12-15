import type { ReactNode } from "react";

interface BadgeProps {
	variant?: "default" | "success" | "warning" | "danger" | "info";
	children: ReactNode;
	className?: string;
}

const variantClasses = {
	default: "bg-gray-100 text-gray-800",
	success: "bg-green-100 text-green-800",
	warning: "bg-yellow-100 text-yellow-800",
	danger: "bg-red-100 text-red-800",
	info: "bg-blue-100 text-blue-800",
};

export function Badge({
	variant = "default",
	children,
	className = "",
}: BadgeProps) {
	return (
		<span
			className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${variantClasses[variant]} ${className}`}
		>
			{children}
		</span>
	);
}

// Helper for role badges
const roleVariants: Record<string, BadgeProps["variant"]> = {
	owner: "danger",
	admin: "warning",
	moderator: "info",
	contributor: "success",
	member: "default",
};

export function RoleBadge({ role }: { role: string }) {
	return (
		<Badge variant={roleVariants[role] || "default"}>
			{role}
		</Badge>
	);
}

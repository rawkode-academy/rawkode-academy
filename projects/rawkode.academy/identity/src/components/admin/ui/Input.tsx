import type { InputHTMLAttributes } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
	label?: string;
	error?: string;
}

export function Input({
	label,
	error,
	className = "",
	id,
	...props
}: InputProps) {
	const inputId = id || props.name;

	return (
		<div className="space-y-1">
			{label && (
				<label
					htmlFor={inputId}
					className="block text-sm font-medium text-gray-700"
				>
					{label}
				</label>
			)}
			<input
				id={inputId}
				className={`block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm px-3 py-2 border ${
					error ? "border-red-500" : ""
				} ${className}`}
				{...props}
			/>
			{error && <p className="text-sm text-red-600">{error}</p>}
		</div>
	);
}

import type { SelectHTMLAttributes } from "react";

interface SelectOption {
	value: string;
	label: string;
}

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
	label?: string;
	error?: string;
	options: SelectOption[];
	placeholder?: string;
}

export function Select({
	label,
	error,
	options,
	placeholder,
	className = "",
	id,
	...props
}: SelectProps) {
	const selectId = id || props.name;

	return (
		<div className="space-y-1">
			{label && (
				<label
					htmlFor={selectId}
					className="block text-sm font-medium text-gray-700"
				>
					{label}
				</label>
			)}
			<select
				id={selectId}
				className={`block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm px-3 py-2 border bg-white ${
					error ? "border-red-500" : ""
				} ${className}`}
				{...props}
			>
				{placeholder && (
					<option value="" disabled>
						{placeholder}
					</option>
				)}
				{options.map((option) => (
					<option key={option.value} value={option.value}>
						{option.label}
					</option>
				))}
			</select>
			{error && <p className="text-sm text-red-600">{error}</p>}
		</div>
	);
}

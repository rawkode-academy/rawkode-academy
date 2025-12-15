import type { ReactNode } from "react";
import { useEffect } from "react";
import { Button } from "./Button";

interface ModalProps {
	isOpen: boolean;
	onClose: () => void;
	title: string;
	children: ReactNode;
	footer?: ReactNode;
}

export function Modal({ isOpen, onClose, title, children, footer }: ModalProps) {
	useEffect(() => {
		const handleEscape = (e: KeyboardEvent) => {
			if (e.key === "Escape") {
				onClose();
			}
		};

		if (isOpen) {
			document.addEventListener("keydown", handleEscape);
			document.body.style.overflow = "hidden";
		}

		return () => {
			document.removeEventListener("keydown", handleEscape);
			document.body.style.overflow = "";
		};
	}, [isOpen, onClose]);

	if (!isOpen) return null;

	return (
		<div className="fixed inset-0 z-50 overflow-y-auto">
			<div className="flex min-h-screen items-center justify-center p-4">
				{/* Backdrop */}
				<div
					className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
					onClick={onClose}
				/>

				{/* Modal */}
				<div className="relative bg-white rounded-lg shadow-xl max-w-lg w-full">
					{/* Header */}
					<div className="flex items-center justify-between px-6 py-4 border-b">
						<h3 className="text-lg font-semibold text-gray-900">{title}</h3>
						<button
							type="button"
							onClick={onClose}
							className="text-gray-400 hover:text-gray-500"
						>
							<span className="sr-only">Close</span>
							<svg
								className="h-6 w-6"
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor"
							>
								<path
									strokeLinecap="round"
									strokeLinejoin="round"
									strokeWidth={2}
									d="M6 18L18 6M6 6l12 12"
								/>
							</svg>
						</button>
					</div>

					{/* Body */}
					<div className="px-6 py-4">{children}</div>

					{/* Footer */}
					{footer && (
						<div className="flex justify-end gap-3 px-6 py-4 border-t bg-gray-50">
							{footer}
						</div>
					)}
				</div>
			</div>
		</div>
	);
}

interface ConfirmModalProps {
	isOpen: boolean;
	onClose: () => void;
	onConfirm: () => void;
	title: string;
	message: string;
	confirmLabel?: string;
	cancelLabel?: string;
	variant?: "danger" | "primary";
	loading?: boolean;
}

export function ConfirmModal({
	isOpen,
	onClose,
	onConfirm,
	title,
	message,
	confirmLabel = "Confirm",
	cancelLabel = "Cancel",
	variant = "primary",
	loading,
}: ConfirmModalProps) {
	return (
		<Modal
			isOpen={isOpen}
			onClose={onClose}
			title={title}
			footer={
				<>
					<Button variant="secondary" onClick={onClose} disabled={loading}>
						{cancelLabel}
					</Button>
					<Button
						variant={variant === "danger" ? "danger" : "primary"}
						onClick={onConfirm}
						disabled={loading}
					>
						{loading ? "Loading..." : confirmLabel}
					</Button>
				</>
			}
		>
			<p className="text-gray-600">{message}</p>
		</Modal>
	);
}

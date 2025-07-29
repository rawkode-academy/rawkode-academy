import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
	"inline-flex items-center justify-center whitespace-nowrap rounded-[--radius-radius] text-sm font-medium ring-offset-[--color-background] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--color-ring] focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
	{
		variants: {
			variant: {
				default:
					"bg-[--color-primary] text-[--color-primary-foreground] hover:bg-[--color-primary]/90",
				destructive:
					"bg-[--color-destructive] text-[--color-destructive-foreground] hover:bg-[--color-destructive]/90",
				outline:
					"border border-[--color-input] bg-[--color-background] hover:bg-[--color-accent] hover:text-[--color-accent-foreground]",
				secondary:
					"bg-[--color-secondary] text-[--color-secondary-foreground] hover:bg-[--color-secondary]/80",
				ghost:
					"hover:bg-[--color-accent] hover:text-[--color-accent-foreground]",
				link: "text-[--color-primary] underline-offset-4 hover:underline",
			},
			size: {
				default: "h-10 px-4 py-2",
				sm: "h-9 rounded-[--radius-radius] px-3",
				lg: "h-11 rounded-[--radius-radius] px-8",
				icon: "h-10 w-10",
			},
		},
		defaultVariants: {
			variant: "default",
			size: "default",
		},
	},
);

export interface ButtonProps
	extends React.ButtonHTMLAttributes<HTMLButtonElement>,
		VariantProps<typeof buttonVariants> {
	asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
	({ className, variant, size, asChild = false, ...props }, ref) => {
		const Comp = asChild ? Slot : "button";
		return (
			<Comp
				className={cn(buttonVariants({ variant, size, className }))}
				ref={ref}
				{...props}
			/>
		);
	},
);
Button.displayName = "Button";

export { Button, buttonVariants };

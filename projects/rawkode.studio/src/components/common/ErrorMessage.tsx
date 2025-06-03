import { Alert, AlertDescription, AlertTitle } from "@/components/shadcn/alert";
import { AlertCircle } from "lucide-react";

interface Props {
	error: Error;
}

export function ErrorMessage({ error }: Props) {
	return (
		<Alert variant="destructive">
			<AlertCircle className="h-4 w-4" />
			<AlertTitle>Error</AlertTitle>
			<AlertDescription>{error.message}</AlertDescription>
		</Alert>
	);
}

import { AlertCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "../shadcn/alert";

interface Props {
  error: Error;
}

export function ErrorMessage({ error }: Props) {
  return (
    <Alert variant="destructive">
      <AlertCircle className="h-4 w-4" />
      <AlertTitle>Error</AlertTitle>
      <AlertDescription>
        {error.message}
      </AlertDescription>
    </Alert>
  );
}

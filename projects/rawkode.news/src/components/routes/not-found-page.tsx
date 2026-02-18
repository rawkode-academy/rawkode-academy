import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";

type NotFoundPageProps = {
  title?: string;
  description?: string;
};

export function NotFoundPage({
  title = "Page not found",
  description = "The page you requested does not exist or may have moved.",
}: NotFoundPageProps) {
  const location = useLocation();

  return (
    <main className="py-7">
      <section className="rkn-panel space-y-5 p-6 sm:p-7">
        <div className="space-y-2">
          <p className="rkn-kicker">404 Not Found</p>
          <h1 className="rkn-page-title">{title}</h1>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>

        <p className="font-mono text-xs text-muted-foreground">Requested path: {location.pathname}</p>

        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" asChild>
            <Link to="/">Go back to feed</Link>
          </Button>
        </div>
      </section>
    </main>
  );
}

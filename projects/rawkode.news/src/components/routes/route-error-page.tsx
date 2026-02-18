import { Link, useRouteError, isRouteErrorResponse } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { NotFoundPage } from "@/components/routes/not-found-page";

type RouteErrorPageProps = {
  scope?: "app" | "post";
};

export function RouteErrorPage({ scope = "app" }: RouteErrorPageProps) {
  const error = useRouteError();

  if (isRouteErrorResponse(error)) {
    if (error.status === 404) {
      if (scope === "post") {
        return (
          <NotFoundPage
            title="Post not found"
            description="That post does not exist anymore or the link is invalid."
          />
        );
      }
      return <NotFoundPage />;
    }

    if (error.status === 400) {
      return (
        <main className="py-7">
          <section className="rkn-panel space-y-5 p-6 sm:p-7">
            <div className="space-y-2">
              <p className="rkn-kicker">Invalid request</p>
              <h1 className="rkn-page-title">That request could not be processed</h1>
              <p className="text-sm text-muted-foreground">
                The link looks malformed. Try returning to the feed and opening the item again.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" asChild>
                <Link to="/">Go back to feed</Link>
              </Button>
            </div>
          </section>
        </main>
      );
    }
  }

  return (
    <main className="py-7">
      <section className="rkn-panel space-y-5 p-6 sm:p-7">
        <div className="space-y-2">
          <p className="rkn-kicker">Something went wrong</p>
          <h1 className="rkn-page-title">We could not load this page</h1>
          <p className="text-sm text-muted-foreground">
            Please try again. If the problem persists, return to the feed and retry from there.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" asChild>
            <Link to="/">Go back to feed</Link>
          </Button>
        </div>
      </section>
    </main>
  );
}

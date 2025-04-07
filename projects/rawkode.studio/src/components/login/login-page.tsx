import { Button } from "@/components/shadcn/button";
import { GalleryVerticalEnd } from "lucide-react";

export default function LoginPage({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-svh lg:grid-cols-2">
      <div className="flex flex-col gap-4 p-6 md:p-10">
        <div className="flex justify-center gap-2 md:justify-start">
          <a href="/" className="flex items-center gap-2 font-medium">
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <GalleryVerticalEnd className="size-4" />
            </div>
            rawkode.studio
          </a>
        </div>
        <div className="flex flex-1 items-center justify-center">
          <Button asChild>
            <a href="/api/auth/login">Login</a>
          </Button>
        </div>
      </div>
      <div className="relative hidden bg-muted lg:block">
        {children}
      </div>
    </div>
  );
}

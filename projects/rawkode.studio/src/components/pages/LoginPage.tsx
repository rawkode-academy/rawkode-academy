import { GalleryVerticalEnd } from "lucide-react";
import { Button } from "@/components/shadcn/button";

export default function LoginPage({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-svh xl:grid-cols-2">
      <div className="hidden xl:flex xl:flex-col gap-4 p-6 md:p-10">
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
      <div className="relative min-h-svh">
        <div className="absolute inset-0 bg-muted">{children}</div>
        <div className="xl:hidden absolute inset-0 flex items-center justify-center">
          <Button asChild>
            <a href="/api/auth/login">Login</a>
          </Button>
        </div>
      </div>
    </div>
  );
}

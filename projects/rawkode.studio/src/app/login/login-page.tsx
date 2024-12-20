import { Button } from "@/components/shadcn/button";
import { GalleryVerticalEnd } from "lucide-react";
import rawkodeStudio from "@/assets/rawkode.studio.png";

export default function LoginPage() {
  return (
    <div className="grid min-h-svh lg:grid-cols-2">
      <div className="flex flex-col gap-4 p-6 md:p-10">
        <div className="flex justify-center gap-2 md:justify-start">
          <a href="#" className="flex items-center gap-2 font-medium">
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
        <img
          src={rawkodeStudio.src}
          alt="rawkode studio with a camera and penguins"
          className="absolute inset-0 h-full w-full object-cover dark:brightness-[0.2] dark:grayscale"
        />
      </div>
    </div>
  );
}
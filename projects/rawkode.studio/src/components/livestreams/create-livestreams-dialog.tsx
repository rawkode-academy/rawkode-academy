import { Button } from "@/components/shadcn/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/shadcn/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/shadcn/form";
import { Input } from "@/components/shadcn/input";
import { SidebarGroupAction } from "@/components/shadcn/sidebar";
import { queryClient } from "@/store";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { actions } from "astro:actions";
import { z } from "astro:schema";
import { Plus } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";

const formSchema = z.object({
  name: z.string()
    .min(1, { message: "Name must be at least 1 character." })
    .max(64, { message: "Name must be at most 64 characters." }),
});

export default function CreateLivestreamsDialog() {
  const [open, setOpen] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
    },
  });

  const { mutate } = useMutation({
    mutationFn: (values: z.infer<typeof formSchema>) =>
      actions.createRoom({ name: values.name }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["livestreams"] });
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <SidebarGroupAction title="Create Live Stream">
          <Plus />
          <span className="sr-only">
            Create Live Stream
          </span>
        </SidebarGroupAction>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            Create a new Live Stream
          </DialogTitle>
          <DialogDescription>
            TODO: Description
          </DialogDescription>
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit((values) =>
                mutate(values, {
                  onSuccess: () => {
                    setOpen(false);
                    form.reset();
                  },
                })
              )}
              className="space-y-8"
            >
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Name
                    </FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Name"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit">Create</Button>
            </form>
          </Form>
        </DialogHeader>
      </DialogContent>
    </Dialog>
  );
}

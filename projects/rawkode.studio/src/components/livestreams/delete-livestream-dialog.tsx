import { Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "../shadcn/alert-dialog";
import { Button, buttonVariants } from "../shadcn/button";
import { useMutation } from "@tanstack/react-query";
import { actions } from "astro:actions";
import { queryClient } from "@/store";
import { useState } from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "../shadcn/tooltip";

interface Props {
  name: string;
}

export default function DeleteLivestreamDialog({ name }: Props) {
  const [open, setOpen] = useState(false);

  const { mutate } = useMutation({
    mutationFn: (name: string) => actions.deleteRoom({ name }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["livestreams"] });
    },
  });

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger>
        <Tooltip>
          <TooltipTrigger>
            <Button size="icon" variant="outline">
              <Trash2 />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            Delete Live Stream "{name}"
          </TooltipContent>
        </Tooltip>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Live Stream "{name}"?</AlertDialogTitle>
          <AlertDialogDescription>
            This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            className={buttonVariants({ variant: "destructive" })}
            onClick={() => {
              mutate(name, {
                onSuccess: () => {
                  setOpen(false);
                },
              });
            }}
          >
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

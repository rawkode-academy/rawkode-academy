import { actions } from "astro:actions";
import { z } from "astro:schema";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Dice5, Plus, X } from "lucide-react";
import { motion } from "motion/react";
import * as randomWords from "random-words";
import React, { useEffect, useImperativeHandle, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { Spinner } from "@/components/common/Spinner";
import { Button } from "@/components/shadcn/button";
import { Checkbox } from "@/components/shadcn/checkbox";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/shadcn/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/shadcn/form";
import { Input } from "@/components/shadcn/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/shadcn/select";
import { Separator } from "@/components/shadcn/separator";
import { SidebarGroupAction } from "@/components/shadcn/sidebar";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/shadcn/tooltip";
import { layoutRegistry } from "@/lib/layout";
import {
  BITRATES,
  DEFAULT_RECORDING_SETTINGS,
  FRAMERATES,
  RESOLUTIONS,
  type RecordingSettings,
} from "@/lib/recording";
import { generateRoomId } from "@/lib/utils";
import { queryClient } from "@/store";

// Simple schema - we only validate what we need on the client
const formSchema = z.object({
  displayName: z
    .string()
    .min(1, { message: "Display name must be at least 1 character." })
    .max(64, { message: "Display name must be at most 64 characters." }),
  maxParticipants: z.coerce
    .number()
    .min(1, {
      message: "Max participants must be at least 1.",
    })
    .max(100, {
      message: "Max participants must be at most 100.",
    }),
  layout: z.string().default("grid"),
  // Recording checkboxes
  enableTrackRecording: z.boolean().default(false),
  enableParticipantRecording: z.boolean().default(false),
  enableCompositeRecording: z.boolean().default(false),
  // Recording settings - just pass through whatever is selected
  // The server will validate these properly
  trackRecording: z.boolean().optional(),
  participantRecording: z.any().optional(),
  compositeRecording: z.any().optional(),
});

// Import layouts to ensure they're registered
import "@/components/livestreams/room/layouts";

// Define the interface for the ref
interface CreateLivestreamsDialogRef {
  setOpen: (open: boolean) => void;
}

// Export the type separately to avoid issues with forwardRef
export type { CreateLivestreamsDialogRef };

export default React.forwardRef<
  CreateLivestreamsDialogRef,
  {
    hideTrigger?: boolean;
  }
>(function CreateLivestreamsDialog(props, ref) {
  const { hideTrigger = false } = props;
  const [open, setOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [creationStatus, setCreationStatus] = useState<
    "idle" | "creating" | "verifying" | "complete"
  >("idle");
  const [error, setError] = useState<string | null>(null);
  const [generatedRoomId, setGeneratedRoomId] = useState<string>("");
  const createdRoomIdRef = useRef<string | null>(null);

  // Get layout options from the registry
  const layoutOptions = layoutRegistry.getSelectOptions();

  // Store user's recording settings to preserve them when toggling
  const [participantRecordingSettings, setParticipantRecordingSettings] =
    useState(DEFAULT_RECORDING_SETTINGS);
  const [compositeRecordingSettings, setCompositeRecordingSettings] = useState(
    DEFAULT_RECORDING_SETTINGS,
  );

  // Expose setOpen method to parent component via ref
  useImperativeHandle(ref, () => ({
    setOpen,
  }));

  const form = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: {
      displayName: "",
      maxParticipants: 10,
      layout: "grid",
      // Recording checkboxes
      enableParticipantRecording: false,
      enableTrackRecording: false,
      enableCompositeRecording: false,
      // Recording settings are undefined by default (disabled)
      participantRecording: undefined,
      trackRecording: undefined,
      compositeRecording: undefined,
    },
    mode: "onBlur", // Validate on blur to avoid aggressive validation
    reValidateMode: "onChange", // But revalidate on change after first validation
  });

  // Watch the checkbox values
  const enableParticipantRecording = form.watch("enableParticipantRecording");
  const enableCompositeRecording = form.watch("enableCompositeRecording");

  // Generate room ID when dialog opens
  useEffect(() => {
    if (open && !generatedRoomId) {
      setGeneratedRoomId(generateRoomId());
    }
  }, [open, generatedRoomId]);

  // Check if room ID exists
  const checkRoomIdExists = async (roomId: string): Promise<boolean> => {
    try {
      const { data: rooms, error } = await actions.rooms.listRooms();
      if (error || !rooms) return false;
      return rooms.some((room) => room.id === roomId);
    } catch {
      return false;
    }
  };

  // Generate a unique room ID
  const generateUniqueRoomId = async (): Promise<string> => {
    let attempts = 0;
    let roomId = generatedRoomId || generateRoomId();

    while (attempts < 10) {
      const exists = await checkRoomIdExists(roomId);
      if (!exists) {
        return roomId;
      }
      roomId = generateRoomId();
      attempts++;
    }

    throw new Error("Failed to generate unique room ID after 10 attempts");
  };

  // Room creation verification query with built-in polling
  const verificationQuery = useQuery({
    queryKey: ["roomCreationVerification", createdRoomIdRef.current],
    queryFn: async () => {
      if (!createdRoomIdRef.current) {
        throw new Error("No room ID to verify");
      }

      // Get fresh list of rooms from API
      const { data: freshRooms, error } = await actions.rooms.listRooms();

      if (error) throw error;
      if (!freshRooms) throw new Error("No data received");

      // Check if room exists in the list
      const roomExists = freshRooms.some(
        (room) => room.id === createdRoomIdRef.current,
      );

      // If room doesn't exist yet, throw error to trigger retry
      if (!roomExists) {
        throw new Error("Room not found yet");
      }

      // Return true if room exists (success)
      return true;
    },
    enabled:
      creationStatus === "verifying" && createdRoomIdRef.current !== null,
    refetchInterval: 1500,
    refetchOnWindowFocus: false,
    staleTime: 0,
    retry: 20,
    retryDelay: 1500,
  });

  // Handle successful verification
  React.useEffect(() => {
    if (verificationQuery.isSuccess && creationStatus === "verifying") {
      queryClient.invalidateQueries({ queryKey: ["livestreams"] });
      setIsCreating(false);
      setCreationStatus("complete");
      setOpen(false);
      form.reset();
      createdRoomIdRef.current = null;
    }
  }, [verificationQuery.isSuccess, creationStatus, form]);

  // Handle max retries reached
  React.useEffect(() => {
    if (
      verificationQuery.failureCount >= 20 &&
      creationStatus === "verifying"
    ) {
      setError(
        "Room creation took longer than expected. It may still be processing.",
      );
      setIsCreating(false);
      setCreationStatus("idle");
    }
  }, [verificationQuery.failureCount, creationStatus]);

  // Mutation for creating a room
  const { mutate } = useMutation({
    mutationFn: async (values: z.infer<typeof formSchema>) => {
      // Ensure we have a unique room ID
      const roomId = await generateUniqueRoomId();

      // Create the parameters object
      const params = {
        displayName: values.displayName,
        roomId: roomId,
        maxParticipants: values.maxParticipants,
        emptyTimeout: 120, // 2 minutes timeout
        layout: values.layout,
        // Add recording settings only if checkboxes are enabled
        participantRecording: values.enableParticipantRecording
          ? values.participantRecording
          : undefined,
        trackRecording: values.enableTrackRecording
          ? values.trackRecording
          : undefined,
        compositeRecording: values.enableCompositeRecording
          ? values.compositeRecording
          : undefined,
      };

      return actions.rooms.createRoom(params);
    },
    onSuccess: (result) => {
      // Store created room ID to check later
      if (result.data) {
        createdRoomIdRef.current = result.data.id;
      }

      // Set status to verifying to trigger the verification process
      setCreationStatus("verifying");
    },
    onError: (err) => {
      setIsCreating(false);
      setCreationStatus("idle");
      setError(err instanceof Error ? err.message : "Failed to create room");
    },
  });

  const handleFormSubmit = (values: z.infer<typeof formSchema>) => {
    // Simple client-side check for recording settings
    if (values.enableParticipantRecording && !values.participantRecording) {
      form.setError("root", {
        type: "manual",
        message: "Please configure participant recording settings",
      });
      return;
    }

    if (values.enableCompositeRecording && !values.compositeRecording) {
      form.setError("root", {
        type: "manual",
        message: "Please configure composite recording settings",
      });
      return;
    }

    setIsCreating(true);
    setCreationStatus("creating");
    setError(null);
    mutate(values);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(newOpen) => {
        // Only allow closing if not in creating state
        if (isCreating && newOpen === false) {
          return;
        }
        setOpen(newOpen);
        if (!newOpen) {
          form.reset();
          setError(null);
          setCreationStatus("idle");
          setGeneratedRoomId(""); // Reset room ID
          // Reset saved recording settings to defaults
          setParticipantRecordingSettings(DEFAULT_RECORDING_SETTINGS);
          setCompositeRecordingSettings(DEFAULT_RECORDING_SETTINGS);
        }
      }}
    >
      {!hideTrigger && (
        <DialogTrigger asChild>
          <SidebarGroupAction title="Create Live Stream">
            <Plus />
            <span className="sr-only">Create Live Stream</span>
          </SidebarGroupAction>
        </DialogTrigger>
      )}
      <DialogContent className="max-w-[90vw] sm:max-w-5xl max-h-[90vh] overflow-y-auto">
        {isCreating && (
          <motion.div
            className="absolute inset-x-0 top-0 h-1 bg-primary z-50 origin-left"
            initial={{ scaleX: 0 }}
            animate={{
              scaleX: creationStatus === "verifying" ? 0.85 : 0.4,
              transition: { duration: 2, ease: "easeOut" },
            }}
          />
        )}
        <DialogClose
          className="absolute top-4 right-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground"
          disabled={isCreating}
        >
          <X className="h-4 w-4" />
          <span className="sr-only">Close</span>
        </DialogClose>

        <DialogHeader>
          <DialogTitle className="text-2xl">
            Create a new Live Stream
          </DialogTitle>
          <DialogDescription>
            Configure your live stream settings and recording options
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(handleFormSubmit)}
            className="space-y-8"
          >
            {/* Basic Settings Section */}
            <section className="space-y-6">
              <div className="grid gap-6 lg:grid-cols-2">
                <FormField
                  control={form.control}
                  name="displayName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Display Name</FormLabel>
                      <div className="flex gap-2">
                        <FormControl>
                          <Input
                            placeholder="e.g. Weekly Team Standup"
                            disabled={isCreating}
                            {...field}
                          />
                        </FormControl>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                onClick={() => {
                                  const words = randomWords.generate({
                                    exactly: 4,
                                  }) as string[];
                                  const displayName = words
                                    .map(
                                      (word) =>
                                        word.charAt(0).toUpperCase() +
                                        word.slice(1),
                                    )
                                    .join(" ");
                                  form.setValue("displayName", displayName, {
                                    shouldValidate: false,
                                  });
                                  form.clearErrors("displayName");
                                }}
                                disabled={isCreating}
                              >
                                <Dice5 className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Generate random name</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                      <FormDescription>
                        This name will be displayed in the room header
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="maxParticipants"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Maximum Participants</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          placeholder="10"
                          disabled={isCreating}
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        Maximum number of people who can join simultaneously
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </section>

            {/* Separator */}
            <Separator />

            {/* Recording Settings Section */}
            <section className="space-y-6">
              <div className="space-y-6">
                {/* Layout Selection and Track Recording in same row */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Composite Recording Layout */}
                  <FormField
                    control={form.control}
                    name="layout"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Composite Recording Layout</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          value={field.value}
                          disabled={isCreating}
                        >
                          <FormControl>
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Select a layout" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {layoutOptions.map((option) => (
                              <SelectItem
                                key={option.value}
                                value={option.value}
                              >
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormDescription>
                          {layoutOptions.find(
                            (opt) => opt.value === field.value,
                          )?.description ||
                            "Choose how participants will appear in composite recordings."}
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Track Recording */}
                  <FormField
                    control={form.control}
                    name="enableTrackRecording"
                    render={({ field }) => (
                      <FormItem>
                        <div
                          className={`border rounded-lg p-4 transition-all ${field.value ? "border-primary/20 bg-primary/[0.02]" : ""}`}
                        >
                          <div className="flex items-center space-x-3">
                            <FormControl>
                              <Checkbox
                                checked={field.value}
                                onCheckedChange={(checked) => {
                                  field.onChange(checked);
                                  form.setValue("trackRecording", !!checked);
                                }}
                                disabled={isCreating}
                              />
                            </FormControl>
                            <div className="space-y-1">
                              <FormLabel
                                className="text-base font-normal cursor-pointer"
                                onClick={() => {
                                  const newValue = !field.value;
                                  field.onChange(newValue);
                                  form.setValue("trackRecording", newValue);
                                }}
                              >
                                Track Recording
                              </FormLabel>
                              <FormDescription>
                                Records audio and video tracks separately for
                                each participant. No additional configuration
                                needed.
                              </FormDescription>
                            </div>
                          </div>
                        </div>
                      </FormItem>
                    )}
                  />
                </div>

                {/* Participant and Composite Recording in two columns */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Participant Recording */}
                  <FormField
                    control={form.control}
                    name="enableParticipantRecording"
                    render={({ field }) => (
                      <FormItem>
                        <div
                          className={`border rounded-lg p-4 space-y-4 transition-all h-full ${field.value ? "border-primary/20 bg-primary/[0.02]" : ""}`}
                        >
                          <div className="flex items-center space-x-3">
                            <FormControl>
                              <Checkbox
                                checked={field.value}
                                onCheckedChange={(checked) => {
                                  field.onChange(checked);
                                  if (!checked) {
                                    const currentSettings = form.getValues(
                                      "participantRecording",
                                    );
                                    if (currentSettings) {
                                      setParticipantRecordingSettings(
                                        currentSettings,
                                      );
                                    }
                                    form.setValue(
                                      "participantRecording",
                                      undefined,
                                    );
                                    form.clearErrors("root");
                                  } else {
                                    form.setValue(
                                      "participantRecording",
                                      participantRecordingSettings,
                                    );
                                    form.clearErrors("root");
                                  }
                                }}
                                disabled={isCreating}
                              />
                            </FormControl>
                            <div className="space-y-1">
                              <FormLabel
                                className="text-base font-normal cursor-pointer"
                                onClick={() => {
                                  const newValue = !field.value;
                                  field.onChange(newValue);
                                  if (!newValue) {
                                    const currentSettings = form.getValues(
                                      "participantRecording",
                                    );
                                    if (currentSettings) {
                                      setParticipantRecordingSettings(
                                        currentSettings,
                                      );
                                    }
                                    form.setValue(
                                      "participantRecording",
                                      undefined,
                                    );
                                    form.clearErrors("root");
                                  } else {
                                    form.setValue(
                                      "participantRecording",
                                      participantRecordingSettings,
                                    );
                                    form.clearErrors("root");
                                  }
                                }}
                              >
                                Participant Recording
                              </FormLabel>
                              <FormDescription>
                                Records each participant as a separate video
                                file.
                              </FormDescription>
                            </div>
                          </div>

                          <div className="grid grid-cols-3 gap-2 pt-3 border-t">
                            <FormField
                              control={form.control}
                              name="participantRecording.resolution"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-xs">
                                    Resolution
                                  </FormLabel>
                                  <Select
                                    onValueChange={(value) => {
                                      field.onChange(value);
                                      setParticipantRecordingSettings(
                                        (prev) => ({
                                          ...prev,
                                          resolution:
                                            value as RecordingSettings["resolution"],
                                        }),
                                      );
                                    }}
                                    value={
                                      field.value ||
                                      participantRecordingSettings.resolution
                                    }
                                    disabled={
                                      isCreating || !enableParticipantRecording
                                    }
                                  >
                                    <FormControl>
                                      <SelectTrigger className="h-8 w-full">
                                        <SelectValue />
                                      </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                      {Object.entries(RESOLUTIONS).map(
                                        ([value, config]) => (
                                          <SelectItem key={value} value={value}>
                                            {config.label}
                                          </SelectItem>
                                        ),
                                      )}
                                    </SelectContent>
                                  </Select>
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name="participantRecording.framerate"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-xs">
                                    Frame Rate
                                  </FormLabel>
                                  <Select
                                    onValueChange={(value) => {
                                      field.onChange(value);
                                      setParticipantRecordingSettings(
                                        (prev) => ({
                                          ...prev,
                                          framerate:
                                            value as RecordingSettings["framerate"],
                                        }),
                                      );
                                    }}
                                    value={
                                      field.value ||
                                      participantRecordingSettings.framerate
                                    }
                                    disabled={
                                      isCreating || !enableParticipantRecording
                                    }
                                  >
                                    <FormControl>
                                      <SelectTrigger className="h-8 w-full">
                                        <SelectValue />
                                      </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                      {Object.entries(FRAMERATES).map(
                                        ([value, config]) => (
                                          <SelectItem key={value} value={value}>
                                            {config.label}
                                          </SelectItem>
                                        ),
                                      )}
                                    </SelectContent>
                                  </Select>
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name="participantRecording.videoBitrate"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-xs">
                                    Bitrate
                                  </FormLabel>
                                  <Select
                                    onValueChange={(value) => {
                                      field.onChange(Number(value));
                                      setParticipantRecordingSettings(
                                        (prev) => ({
                                          ...prev,
                                          videoBitrate: Number(value),
                                        }),
                                      );
                                    }}
                                    value={
                                      field.value?.toString() ||
                                      participantRecordingSettings.videoBitrate.toString()
                                    }
                                    disabled={
                                      isCreating || !enableParticipantRecording
                                    }
                                  >
                                    <FormControl>
                                      <SelectTrigger className="h-8 w-full">
                                        <SelectValue />
                                      </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                      {Object.entries(BITRATES).map(
                                        ([value, config]) => (
                                          <SelectItem key={value} value={value}>
                                            {config.label}
                                          </SelectItem>
                                        ),
                                      )}
                                    </SelectContent>
                                  </Select>
                                </FormItem>
                              )}
                            />
                          </div>
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Composite Recording */}
                  <FormField
                    control={form.control}
                    name="enableCompositeRecording"
                    render={({ field }) => (
                      <FormItem>
                        <div
                          className={`border rounded-lg p-4 space-y-4 transition-all h-full ${field.value ? "border-primary/20 bg-primary/[0.02]" : ""}`}
                        >
                          <div className="flex items-center space-x-3">
                            <FormControl>
                              <Checkbox
                                checked={field.value}
                                onCheckedChange={(checked) => {
                                  field.onChange(checked);
                                  if (!checked) {
                                    const currentSettings =
                                      form.getValues("compositeRecording");
                                    if (currentSettings) {
                                      setCompositeRecordingSettings(
                                        currentSettings,
                                      );
                                    }
                                    form.setValue(
                                      "compositeRecording",
                                      undefined,
                                    );
                                    form.clearErrors("root");
                                  } else {
                                    form.setValue(
                                      "compositeRecording",
                                      compositeRecordingSettings,
                                    );
                                    form.clearErrors("root");
                                  }
                                }}
                                disabled={isCreating}
                              />
                            </FormControl>
                            <div className="space-y-1">
                              <FormLabel
                                className="text-base font-normal cursor-pointer"
                                onClick={() => {
                                  const newValue = !field.value;
                                  field.onChange(newValue);
                                  if (!newValue) {
                                    const currentSettings =
                                      form.getValues("compositeRecording");
                                    if (currentSettings) {
                                      setCompositeRecordingSettings(
                                        currentSettings,
                                      );
                                    }
                                    form.setValue(
                                      "compositeRecording",
                                      undefined,
                                    );
                                    form.clearErrors("root");
                                  } else {
                                    form.setValue(
                                      "compositeRecording",
                                      compositeRecordingSettings,
                                    );
                                    form.clearErrors("root");
                                  }
                                }}
                              >
                                Composite Recording
                              </FormLabel>
                              <FormDescription>
                                Records the entire room as a single video.
                              </FormDescription>
                            </div>
                          </div>

                          <div className="grid grid-cols-3 gap-2 pt-3 border-t">
                            <FormField
                              control={form.control}
                              name="compositeRecording.resolution"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-xs">
                                    Resolution
                                  </FormLabel>
                                  <Select
                                    onValueChange={(value) => {
                                      field.onChange(value);
                                      setCompositeRecordingSettings((prev) => ({
                                        ...prev,
                                        resolution:
                                          value as RecordingSettings["resolution"],
                                      }));
                                    }}
                                    value={
                                      field.value ||
                                      compositeRecordingSettings.resolution
                                    }
                                    disabled={
                                      isCreating || !enableCompositeRecording
                                    }
                                  >
                                    <FormControl>
                                      <SelectTrigger className="h-8 w-full">
                                        <SelectValue />
                                      </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                      {Object.entries(RESOLUTIONS).map(
                                        ([value, config]) => (
                                          <SelectItem key={value} value={value}>
                                            {config.label}
                                          </SelectItem>
                                        ),
                                      )}
                                    </SelectContent>
                                  </Select>
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name="compositeRecording.framerate"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-xs">
                                    Frame Rate
                                  </FormLabel>
                                  <Select
                                    onValueChange={(value) => {
                                      field.onChange(value);
                                      setCompositeRecordingSettings((prev) => ({
                                        ...prev,
                                        framerate:
                                          value as RecordingSettings["framerate"],
                                      }));
                                    }}
                                    value={
                                      field.value ||
                                      compositeRecordingSettings.framerate
                                    }
                                    disabled={
                                      isCreating || !enableCompositeRecording
                                    }
                                  >
                                    <FormControl>
                                      <SelectTrigger className="h-8 w-full">
                                        <SelectValue />
                                      </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                      {Object.entries(FRAMERATES).map(
                                        ([value, config]) => (
                                          <SelectItem key={value} value={value}>
                                            {config.label}
                                          </SelectItem>
                                        ),
                                      )}
                                    </SelectContent>
                                  </Select>
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name="compositeRecording.videoBitrate"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-xs">
                                    Bitrate
                                  </FormLabel>
                                  <Select
                                    onValueChange={(value) => {
                                      field.onChange(Number(value));
                                      setCompositeRecordingSettings((prev) => ({
                                        ...prev,
                                        videoBitrate: Number(value),
                                      }));
                                    }}
                                    value={
                                      field.value?.toString() ||
                                      compositeRecordingSettings.videoBitrate.toString()
                                    }
                                    disabled={
                                      isCreating || !enableCompositeRecording
                                    }
                                  >
                                    <FormControl>
                                      <SelectTrigger className="h-8 w-full">
                                        <SelectValue />
                                      </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                      {Object.entries(BITRATES).map(
                                        ([value, config]) => (
                                          <SelectItem key={value} value={value}>
                                            {config.label}
                                          </SelectItem>
                                        ),
                                      )}
                                    </SelectContent>
                                  </Select>
                                </FormItem>
                              )}
                            />
                          </div>
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>
            </section>

            {/* Error display */}
            {(form.formState.errors.root || (error && !isCreating)) && (
              <div className="p-3 bg-destructive/10 text-destructive rounded-md text-sm">
                {form.formState.errors.root?.message || error}
              </div>
            )}

            <div className="flex justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={isCreating}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isCreating}>
                {isCreating ? (
                  <>
                    <Spinner size="small" className="mr-1 h-4 w-4" />
                    Creating...
                  </>
                ) : (
                  "Create"
                )}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
});

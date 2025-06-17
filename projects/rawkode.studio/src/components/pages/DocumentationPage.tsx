import {
  AlertTriangle,
  Ban,
  Camera,
  Check,
  Eye,
  Grid3x3,
  Hand,
  Info,
  Layout,
  MessageSquare,
  Mic,
  Monitor,
  PictureInPicture,
  Presentation,
  Settings,
  Shield,
  Sparkles,
  User,
  Users,
  Users2,
  Video,
} from "lucide-react";
import {
  type ControlPermissions,
  getDefaultLayout,
  getPermissionReason,
  LAYOUT_CONFIGS,
  LAYOUT_PERMISSIONS,
  LayoutType,
  ROLE_PERMISSIONS,
} from "@/components/livestreams/room/layouts/permissions";
import { Alert, AlertDescription } from "@/components/shadcn/alert";
import { Badge } from "@/components/shadcn/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/shadcn/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/shadcn/tabs";

// Helper function to get icon component
function getLayoutIcon(iconName: string) {
  const icons = {
    Grid3x3: Grid3x3,
    User: User,
    Users: Users,
    PictureInPicture: PictureInPicture,
    Presentation: Presentation,
    MessageSquare: MessageSquare,
    Users2: Users2,
  };
  return icons[iconName as keyof typeof icons] || Grid3x3;
}

// Helper function to format permission display
function formatPermissionLine(allowed: boolean, text: string): React.ReactNode {
  return (
    <li>
      <span className={allowed ? "text-green-600" : "text-red-600"}>
        {allowed ? "✓" : "✗"}
      </span>{" "}
      {text}
    </li>
  );
}

// Helper function to format control permissions as readable text
function formatControlPermission(key: keyof ControlPermissions): string {
  const permissionLabels: Record<keyof ControlPermissions, string> = {
    canToggleBackstage: "Toggle backstage mode",
    canSelectPresenter: "Select presenter",
    canSelectLayout: "Change layouts",
    canPromoteParticipants: "Promote participants",
    canDemoteParticipants: "Demote participants",
    canLowerHands: "Lower raised hands",
    canRaiseHand: "Raise hand to speak",
    canSendChatMessages: "Send chat messages",
  };
  return permissionLabels[key];
}

// Helper to get role description
function getRoleDescription(role: string): {
  title: string;
  description: string;
} {
  const descriptions = {
    director: {
      title: "Full Control",
      description: "Complete control over the broadcast and all participants.",
    },
    presenter: {
      title: "Broadcast Control",
      description:
        "Main speaker with layout control and enhanced media permissions.",
    },
    participant: {
      title: "Interactive Access",
      description: "Authenticated users with media and chat access.",
    },
    viewer: {
      title: "Watch Only",
      description: "Unauthenticated guests with view-only access.",
    },
  };
  return (
    descriptions[role as keyof typeof descriptions] || descriptions.participant
  );
}

export default function DocumentationPage() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">Rawkode Studio Guide</h1>
        <p className="text-muted-foreground">
          Complete guide to using the livestream studio for broadcasting and
          collaboration
        </p>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="grid w-full grid-cols-2 md:grid-cols-5">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="layouts-permissions">
            Layouts & Permissions
          </TabsTrigger>
          <TabsTrigger value="controls">Controls</TabsTrigger>
          <TabsTrigger value="features">Features</TabsTrigger>
          <TabsTrigger value="tips">Tips</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Welcome to Rawkode Studio</CardTitle>
            </CardHeader>
            <CardContent className="prose prose-sm dark:prose-invert max-w-none">
              <p>
                Rawkode Studio is a professional livestreaming platform built on
                LiveKit technology. It provides everything you need for
                high-quality broadcasts, presentations, and collaborative
                sessions.
              </p>

              <h3 className="text-lg font-semibold mt-4 mb-2">Quick Start</h3>
              <ol className="list-decimal list-inside space-y-2">
                <li>
                  Create a new livestream room from the Active Streams page
                </li>
                <li>Share the invite link with participants</li>
                <li>Join the room and configure your audio/video settings</li>
                <li>Use the layout selector to choose your preferred view</li>
                <li>Start broadcasting!</li>
              </ol>

              <Alert className="mt-4">
                <AlertDescription>
                  <strong>Pro tip:</strong> Directors have full control over the
                  stream, including promoting participants, changing layouts,
                  and managing the broadcast.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="layouts-permissions" className="space-y-6">
          {/* Roles Section */}
          <div>
            <h2 className="text-2xl font-semibold mb-4">User Roles</h2>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {(
                ["director", "presenter", "participant", "viewer"] as const
              ).map((role) => {
                const permissions = ROLE_PERMISSIONS[role];
                const roleInfo = getRoleDescription(role);
                const iconMap = {
                  director: <Shield className="h-5 w-5 text-amber-500" />,
                  presenter: <Users className="h-5 w-5 text-blue-500" />,
                  participant: <Users className="h-5 w-5 text-green-500" />,
                  viewer: <Eye className="h-5 w-5 text-gray-500" />,
                };
                const badgeVariantMap = {
                  director: "default" as const,
                  presenter: "secondary" as const,
                  participant: "outline" as const,
                  viewer: "outline" as const,
                };

                return (
                  <Card key={role}>
                    <CardHeader className="pb-3">
                      <CardTitle className="flex items-center gap-2">
                        {iconMap[role]}
                        {role.charAt(0).toUpperCase() + role.slice(1)}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <Badge variant={badgeVariantMap[role]} className="mb-2">
                        {roleInfo.title}
                      </Badge>
                      <p className="text-sm text-muted-foreground mb-2">
                        {roleInfo.description}
                      </p>
                      <ul className="text-xs space-y-1">
                        {/* Show what they CAN do */}
                        {Object.entries(permissions).map(([key, value]) => {
                          if (value === true) {
                            return (
                              <li key={key}>
                                •{" "}
                                {formatControlPermission(
                                  key as keyof ControlPermissions,
                                )}
                              </li>
                            );
                          }
                          return null;
                        })}

                        {/* Special cases for media permissions */}
                        {role === "director" && (
                          <>
                            <li>• Media permissions vary by layout</li>
                            <li>• Can publish media by default</li>
                            <li>
                              • First director becomes presenter automatically
                            </li>
                          </>
                        )}
                        {role === "presenter" && (
                          <li>• Enhanced media permissions in all layouts</li>
                        )}
                        {role === "participant" && (
                          <>
                            <li>• Media permissions vary by layout</li>
                            <li>• Can be promoted to speaker by directors</li>
                            <li>• Requires promotion to publish media</li>
                          </>
                        )}
                        {role === "viewer" && (
                          <>
                            <li>• Watch the stream</li>
                            <li>• View chat messages</li>
                            <li>• Cannot use camera/mic</li>
                            <li>• Cannot be promoted to speaker</li>
                          </>
                        )}
                      </ul>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>

          {/* Layouts Section */}
          <div>
            <h2 className="text-2xl font-semibold mb-4">Available Layouts</h2>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {Object.entries(LAYOUT_CONFIGS).map(([layoutType, config]) => {
                const permissions =
                  LAYOUT_PERMISSIONS[layoutType as LayoutType];
                const IconComponent = getLayoutIcon(config.icon);

                return (
                  <Card key={layoutType}>
                    <CardHeader className="pb-3">
                      <CardTitle className="flex items-center gap-2">
                        <IconComponent className="h-4 w-4" />
                        {config.name}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground mb-2">
                        {config.description}
                      </p>
                      <div className="text-xs space-y-2">
                        <div className="text-muted-foreground italic">
                          {permissions.description}
                        </div>
                        <div>
                          <p className="font-medium mb-1">Permissions:</p>
                          <ul className="space-y-0.5 text-muted-foreground">
                            {/* Director permissions */}
                            {(permissions.director.camera ||
                              permissions.director.microphone ||
                              permissions.director.screenShare) &&
                              formatPermissionLine(
                                true,
                                `Director: ${[
                                  permissions.director.camera && "camera",
                                  permissions.director.microphone && "mic",
                                  permissions.director.screenShare && "screen",
                                ]
                                  .filter(Boolean)
                                  .join(", ")}`,
                              )}

                            {/* Presenter permissions */}
                            {(permissions.presenter.camera ||
                              permissions.presenter.microphone ||
                              permissions.presenter.screenShare) &&
                              formatPermissionLine(
                                true,
                                `Presenter: ${[
                                  permissions.presenter.camera && "camera",
                                  permissions.presenter.microphone && "mic",
                                  permissions.presenter.screenShare && "screen",
                                ]
                                  .filter(Boolean)
                                  .join(", ")}`,
                              )}

                            {/* Participant permissions */}
                            {(permissions.participant.camera ||
                              permissions.participant.microphone) &&
                              formatPermissionLine(
                                true,
                                `Participants: ${[
                                  permissions.participant.camera && "camera",
                                  permissions.participant.microphone &&
                                    "microphone",
                                ]
                                  .filter(Boolean)
                                  .join(" & ")}`,
                              )}

                            {/* Participant restrictions */}
                            {!permissions.participant.camera &&
                              permissions.participant.microphone &&
                              formatPermissionLine(
                                true,
                                "Participants: microphone only",
                              )}

                            {!permissions.participant.camera &&
                              !permissions.participant.microphone &&
                              formatPermissionLine(
                                false,
                                "Participants: view only",
                              )}

                            {!permissions.participant.screenShare &&
                              permissions.participant.camera &&
                              formatPermissionLine(
                                false,
                                "Participants: no screen share",
                              )}

                            {/* Viewer permissions */}
                            {formatPermissionLine(
                              false,
                              "Viewers: no media access",
                            )}

                            {/* Special cases */}
                            {layoutType === LayoutType.GRID &&
                              formatPermissionLine(
                                false,
                                "No screen share in grid layout",
                              )}

                            {layoutType === LayoutType.PICTURE_IN_PICTURE &&
                              formatPermissionLine(
                                false,
                                "Directors: no media (must be presenter)",
                              )}

                            {/* Layout control */}
                            {formatPermissionLine(
                              true,
                              "Directors & Presenters can change layouts",
                            )}
                          </ul>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>

          {/* Permission Details */}
          <div>
            <h2 className="text-2xl font-semibold mb-4">Permission Details</h2>
            <div className="grid gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">
                    Layout-Specific Rules
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <h4 className="font-medium text-sm mb-1">Grid Layout</h4>
                    <p className="text-xs text-muted-foreground">
                      Most permissive layout. Directors, presenters, and
                      participants can use camera and microphone. Viewers have
                      no media access. Screen sharing is completely disabled in
                      this layout.
                    </p>
                  </div>
                  <div>
                    <h4 className="font-medium text-sm mb-1">Single Speaker</h4>
                    <p className="text-xs text-muted-foreground">
                      Focused on one presenter. Only the presenter can use
                      camera and screen share, but participants keep microphone
                      access for questions. Directors must be assigned as
                      presenter to use camera. Viewers have no media access.
                    </p>
                  </div>
                  <div>
                    <h4 className="font-medium text-sm mb-1">
                      Picture in Picture (Most Restrictive)
                    </h4>
                    <p className="text-xs text-muted-foreground">
                      Only the presenter has any media permissions. Even
                      directors must be assigned as presenter to broadcast in
                      this mode. Participants and viewers have no media access.
                    </p>
                  </div>
                  <div>
                    <h4 className="font-medium text-sm mb-1">
                      Presentation, Side-by-Side, Interview, Panel
                    </h4>
                    <p className="text-xs text-muted-foreground">
                      Directors, presenters, and participants can use camera and
                      microphone. Only directors and presenters can share their
                      screen. Viewers have no media access.
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Layout Behavior</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <h4 className="font-medium text-sm mb-1">
                      Default Layout Logic
                    </h4>
                    <p className="text-xs text-muted-foreground">
                      {getDefaultLayout(false, 0) === LayoutType.GRID &&
                        "By default, rooms start in Grid layout."}
                      {
                        " When screen sharing begins, the layout automatically switches to "
                      }
                      {getDefaultLayout(true, 0) === LayoutType.PRESENTATION &&
                        "Presentation mode."}
                    </p>
                  </div>
                  <div>
                    <h4 className="font-medium text-sm mb-1">
                      Permission Restrictions
                    </h4>
                    <p className="text-xs text-muted-foreground">
                      The system provides specific reasons when permissions are
                      restricted. For example:
                    </p>
                    <ul className="text-xs text-muted-foreground mt-1 space-y-0.5">
                      <li>
                        •{" "}
                        {getPermissionReason(
                          LayoutType.GRID,
                          "participant",
                          "screenShare",
                          true,
                        ) || "Screen sharing allowed"}
                      </li>
                      <li>
                        •{" "}
                        {getPermissionReason(
                          LayoutType.PICTURE_IN_PICTURE,
                          "director",
                          "camera",
                          true,
                        ) || "Camera allowed"}
                      </li>
                      <li>
                        •{" "}
                        {getPermissionReason(
                          LayoutType.SINGLE_SPEAKER,
                          "participant",
                          "camera",
                          true,
                        ) || "Camera allowed"}
                      </li>
                    </ul>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Important Notes</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2 text-sm">
                    <li className="flex items-start gap-2">
                      <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0" />
                      <span>
                        Directors are not automatically presenters - they must
                        assign themselves if needed
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Info className="h-5 w-5 text-blue-500 shrink-0" />
                      <span>
                        The first director to join automatically becomes the
                        presenter
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="h-5 w-5 text-green-600 shrink-0" />
                      <span>
                        Presenters and directors can change layouts - changes
                        take effect immediately for all participants
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Sparkles className="h-5 w-5 text-purple-500 shrink-0" />
                      <span>
                        Screen sharing automatically switches to{" "}
                        {LAYOUT_CONFIGS[LayoutType.PRESENTATION].name}
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Ban className="h-5 w-5 text-red-600 shrink-0" />
                      <span>
                        Viewers (unauthenticated users) cannot send chat
                        messages or use any media
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Info className="h-5 w-5 text-blue-500 shrink-0" />
                      <span>
                        Only authenticated users can send messages in chat
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Info className="h-5 w-5 text-blue-500 shrink-0" />
                      <span>
                        Directors have token-level permission to publish media,
                        but layout-specific restrictions still apply
                      </span>
                    </li>
                  </ul>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="controls" className="space-y-4">
          <div className="grid gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Basic Controls</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-start gap-3">
                  <Mic className="h-5 w-5 mt-0.5 text-muted-foreground" />
                  <div>
                    <h4 className="font-medium">Microphone Toggle</h4>
                    <p className="text-sm text-muted-foreground">
                      Mute/unmute your microphone. Click the settings icon to
                      select a different microphone.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Camera className="h-5 w-5 mt-0.5 text-muted-foreground" />
                  <div>
                    <h4 className="font-medium">Camera Toggle</h4>
                    <p className="text-sm text-muted-foreground">
                      Start/stop your video. Access settings to change camera or
                      video quality.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Monitor className="h-5 w-5 mt-0.5 text-muted-foreground" />
                  <div>
                    <h4 className="font-medium">Screen Share</h4>
                    <p className="text-sm text-muted-foreground">
                      Share your screen or specific application. Automatically
                      switches to presentation mode.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Settings className="h-5 w-5 mt-0.5 text-muted-foreground" />
                  <div>
                    <h4 className="font-medium">Settings</h4>
                    <p className="text-sm text-muted-foreground">
                      Configure device selection, streaming quality (resolution,
                      framerate, bitrate).
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Advanced Controls</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-start gap-3">
                  <Video className="h-5 w-5 mt-0.5 text-muted-foreground" />
                  <div>
                    <h4 className="font-medium">
                      Backstage Mode (Directors Only)
                    </h4>
                    <p className="text-sm text-muted-foreground">
                      Go off-stage while preserving your media state. Perfect
                      for preparation or breaks.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Users className="h-5 w-5 mt-0.5 text-muted-foreground" />
                  <div>
                    <h4 className="font-medium">
                      Presenter Selection (Directors Only)
                    </h4>
                    <p className="text-sm text-muted-foreground">
                      Choose who is the main presenter. This affects layout
                      behavior and focus.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Layout className="h-5 w-5 mt-0.5 text-muted-foreground" />
                  <div>
                    <h4 className="font-medium">
                      Layout Selector (Directors & Presenters)
                    </h4>
                    <p className="text-sm text-muted-foreground">
                      Both directors and presenters can change the room layout
                      for all participants. Choose from 7 professional layouts.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Hand className="h-5 w-5 mt-0.5 text-muted-foreground" />
                  <div>
                    <h4 className="font-medium">Raise Hand (Participants)</h4>
                    <p className="text-sm text-muted-foreground">
                      Request to speak. Directors can approve or decline raised
                      hands.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="features" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle>Recording Capabilities</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p className="text-muted-foreground mb-3">
                  Professional recording with multiple output formats:
                </p>
                <ul className="space-y-1">
                  <li>• Individual participant videos (MP4)</li>
                  <li>• Separate audio/video tracks</li>
                  <li>• Composite room recording</li>
                  <li>• HLS streaming segments</li>
                  <li>• S3 storage integration</li>
                  <li>• 8 quality presets (720p to 4K)</li>
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Chat System</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p className="text-muted-foreground mb-3">
                  Real-time communication features:
                </p>
                <ul className="space-y-1">
                  <li>• Live chat during streams</li>
                  <li>• Emoji support with picker</li>
                  <li>• Persistent chat history</li>
                  <li>• Participant identification</li>
                  <li>• Database storage</li>
                  <li>• Auto-scrolling messages</li>
                  <li>• Authenticated users only</li>
                  <li>• Viewers can read but not send</li>
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Participant Management</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p className="text-muted-foreground mb-3">
                  Advanced participant controls:
                </p>
                <ul className="space-y-1">
                  <li>• Real-time participant list</li>
                  <li>• Status indicators (mic/camera/presenter)</li>
                  <li>• Role-based permissions</li>
                  <li>• Raise hand system</li>
                  <li>• Promote/demote capabilities</li>
                  <li>• Grouped by role (Speakers/Viewers)</li>
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Technical Features</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p className="text-muted-foreground mb-3">
                  Professional streaming technology:
                </p>
                <ul className="space-y-1">
                  <li>• WebRTC with VP9 codec</li>
                  <li>• Adaptive bitrate streaming</li>
                  <li>• Auto-reconnection</li>
                  <li>• Device hot-swapping</li>
                  <li>• Quality presets</li>
                  <li>• Low-latency broadcasting</li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="tips" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Pro Tips for Better Broadcasts</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h4 className="font-medium mb-2 flex items-center gap-2">
                  <Camera className="h-4 w-4" />
                  Camera & Lighting
                </h4>
                <ul className="space-y-1 text-sm text-muted-foreground">
                  <li>• Position camera at eye level for best appearance</li>
                  <li>• Use natural light or a ring light facing you</li>
                  <li>• Avoid backlighting from windows</li>
                  <li>• Clean your camera lens for sharp video</li>
                </ul>
              </div>

              <div>
                <h4 className="font-medium mb-2 flex items-center gap-2">
                  <Mic className="h-4 w-4" />
                  Audio Quality
                </h4>
                <ul className="space-y-1 text-sm text-muted-foreground">
                  <li>• Use headphones to prevent echo</li>
                  <li>• Test microphone levels before going live</li>
                  <li>• Minimize background noise</li>
                  <li>• Consider using a dedicated microphone</li>
                </ul>
              </div>

              <div>
                <h4 className="font-medium mb-2 flex items-center gap-2">
                  <Monitor className="h-4 w-4" />
                  Screen Sharing
                </h4>
                <ul className="space-y-1 text-sm text-muted-foreground">
                  <li>• Close unnecessary applications before sharing</li>
                  <li>• Hide sensitive information and notifications</li>
                  <li>
                    • Use presentation mode for automatic layout switching
                  </li>
                  <li>
                    • Share specific windows instead of entire screen when
                    possible
                  </li>
                </ul>
              </div>

              <div>
                <h4 className="font-medium mb-2 flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Managing Participants
                </h4>
                <ul className="space-y-1 text-sm text-muted-foreground">
                  <li>• Assign a co-director for large sessions</li>
                  <li>• Use raise hand system for orderly discussions</li>
                  <li>• Mute participants when not speaking</li>
                  <li>
                    • Prepare participants with a tech check before going live
                  </li>
                </ul>
              </div>

              <Alert className="mt-4">
                <AlertDescription>
                  <strong>Recording tip:</strong> Enable auto-recording when
                  creating the room to ensure you never miss capturing your
                  content. Recordings are automatically saved to cloud storage.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

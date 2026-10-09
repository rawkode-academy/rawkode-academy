export type Reviewer = { id: number; name?: string; role: "staff" | "customer" };
export type UploadTarget = { videoId: number; legacyId: string; slug: string; title: string; description: string; reviewState: string };
export type ReviewCustomer = { userId: number; name: string; profileEmail: string };
export type ReviewItem = { videoId: number; revisionId: string; title: string; state: string; reviewVersion: number };
export type ReviewList = { items: ReviewItem[]; nextCursor: number | null };
// canApprove and expiresAt describe the viewer's own grant; staff responses omit them.
export type Revision = { id: string; reviewVersion: number; durationMs: number; state: string; createdAt: string; mediaUrl: string; thumbnailUrl?: string; metadata: { title: string; description: string }; canApprove?: boolean; expiresAt?: string };
export type RevisionGrant = { revisionId: string; userId: number; canApprove: boolean; version: number; expiresAt: string; revokedAt: string | null };
export type Comment = { id: string; revisionId: string; authorId: number; startMs: number; endMs: number | null; body: string; resolved: number; resolvedAt: string | null };
// canApprove: the viewer may sign off now. For a customer, currentRevisionId is their newest shared cut.
export type Review = { videoId: number; viewerId: number; canApprove: boolean; publicationAvailable: boolean; currentRevisionId: string | null; revisions: Revision[]; comments: Comment[]; decisions: { id: string; revisionId: string; reviewVersion: number; decision: string; note: string; createdAt: string }[]; grants?: RevisionGrant[] };

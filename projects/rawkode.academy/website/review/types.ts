export type Reviewer = { id: number; name?: string; role: "staff" | "customer" };
export type ReviewItem = { videoId: number; revisionId: string; title: string; state: string; reviewVersion: number };
export type ReviewList = { items: ReviewItem[]; nextCursor: number | null };
export type Revision = { id: string; reviewVersion: number; durationMs: number; state: string; createdAt: string; mediaUrl: string; metadata: { title: string; description: string } };
export type Comment = { id: string; revisionId: string; authorId: number; startMs: number; endMs: number | null; body: string; resolved: number; resolvedAt: string | null };
export type Review = { videoId: number; viewerId: number; canApprove: boolean; publicationAvailable: boolean; currentRevisionId: string | null; revisions: Revision[]; comments: Comment[]; decisions: { id: string; revisionId: string; reviewVersion: number; decision: string; note: string; createdAt: string }[] };

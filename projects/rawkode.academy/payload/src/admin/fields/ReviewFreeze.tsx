import { SaveDraftButton, UnpublishButton } from '@payloadcms/ui'
import type { UIFieldServerProps } from 'payload'
import { isStaff } from '../../auth/access'
import { previewReviewUrl } from '../links'
import { videoInReview } from '../review-data'
import { VideoPublishButton } from './VideoPublishButton'

// Videos in the client review flow are frozen by the review_freeze_* database
// triggers: every Payload save fails. These components say so up front and
// replace the Save draft / Publish buttons instead of letting editors hit a
// generic "Something went wrong" toast.
// Extension point: workstream F's guarded staff commands can link from the
// notice once they exist.

const frozenHint = 'This video is in client review, so it cannot be edited here. Change it through Preview review.'

type SlotProps = { id?: string; user?: unknown }

const managed = async ({ id }: SlotProps) => id !== undefined && (await videoInReview(id))

export async function ReviewFreezeNotice({ id, req }: UIFieldServerProps) {
	if (!isStaff(req.user) || id === undefined || !(await videoInReview(id))) return null
	return (
		<div className="academy-freeze" role="status">
			<strong className="academy-freeze__title">In client review: read-only</strong>
			<p className="academy-freeze__text">
				Edits to this video are frozen while it is in the review flow, and saving here will fail. Make changes through{' '}
				<a href={previewReviewUrl} target="_blank" rel="noopener noreferrer">
					Preview review<span className="academy-visually-hidden"> (opens in a new tab)</span>
				</a>
				. The Review tab shows its current state.
			</p>
		</div>
	)
}

function FrozenButton({ label, style, hintId }: { label: string; style: 'primary' | 'secondary'; hintId: string }) {
	return (
		<span className="academy-publish-locked">
			<button type="button" className={`btn btn--style-${style} btn--size-medium btn--disabled`} disabled aria-describedby={hintId}>
				{label}
			</button>
			<span id={hintId} className="academy-visually-hidden">
				{frozenHint}
			</span>
		</span>
	)
}

export async function VideoPublishControl(props: SlotProps) {
	if (await managed(props)) return <FrozenButton label="Publish via review" style="primary" hintId="academy-frozen-publish" />
	return <VideoPublishButton />
}

export async function VideoSaveDraftControl(props: SlotProps) {
	if (await managed(props)) return <FrozenButton label="Save draft" style="secondary" hintId="academy-frozen-save" />
	return <SaveDraftButton />
}

// Payload's Unpublish would hit the same trigger; hide it for managed videos.
export async function VideoUnpublishControl(props: SlotProps) {
	if (await managed(props)) return null
	return <UnpublishButton />
}

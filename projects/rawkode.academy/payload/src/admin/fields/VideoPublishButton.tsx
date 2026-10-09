'use client'
import { PublishButton, useFormFields } from '@payloadcms/ui'
import { type ComponentProps, useId } from 'react'

// Pipeline-linked videos publish only through explicit pipeline approval.
// Rather than letting editors hit the 'Use explicit pipeline approval' server
// error, the button says so up front.
export function VideoPublishButton(props: ComponentProps<typeof PublishButton>) {
	const processingRun = useFormFields(([fields]) => fields.processingRun?.value)
	const hintId = useId()
	if (processingRun) {
		return (
			<span className="academy-publish-locked">
				<button type="button" className="btn btn--style-primary btn--size-medium btn--disabled" disabled aria-describedby={hintId}>
					Approve via pipeline
				</button>
				<span id={hintId} className="academy-visually-hidden">
					This video is linked to a media pipeline run. Approve it through the pipeline; see the Processing tab.
				</span>
			</span>
		)
	}
	return <PublishButton {...props} />
}

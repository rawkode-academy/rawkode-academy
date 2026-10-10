const id = (prefix: string) => `${prefix}${'0'.repeat(23)}`

export const STAFF_ID = id('s')
export const CLIENT_ID = id('c')
export const STRANGER_ID = id('g')
export const SECOND_CLIENT_ID = id('d')
export const VIDEO_ID = id('v')
export const OTHER_VIDEO_ID = id('w')
export const SOURCE_MEDIA_ID = id('m')
export const DELIVERABLE_MEDIA_ID = id('n')
export const SECOND_DELIVERABLE_MEDIA_ID = id('o')
export const THUMBNAIL_ID = id('t')
export const OTHER_THUMBNAIL_ID = id('u')

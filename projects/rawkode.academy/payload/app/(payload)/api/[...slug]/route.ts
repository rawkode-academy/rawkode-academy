import {withOidcCsrf} from '../../../../src/auth/guard'
import config from '@payload-config'
import {REST_GET,REST_POST,REST_DELETE,REST_PATCH,REST_PUT,REST_OPTIONS} from '@payloadcms/next/routes'
export const GET=REST_GET(config)
export const POST=withOidcCsrf(REST_POST(config))
export const DELETE=withOidcCsrf(REST_DELETE(config))
export const PATCH=withOidcCsrf(REST_PATCH(config))
export const PUT=withOidcCsrf(REST_PUT(config))
export const OPTIONS=REST_OPTIONS(config)

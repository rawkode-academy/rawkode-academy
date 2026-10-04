import {withOidcCsrf} from '../../../../src/auth/guard'
import config from '@payload-config'
import {GRAPHQL_POST,REST_OPTIONS} from '@payloadcms/next/routes'
export const POST=withOidcCsrf(GRAPHQL_POST(config))
export const OPTIONS=REST_OPTIONS(config)

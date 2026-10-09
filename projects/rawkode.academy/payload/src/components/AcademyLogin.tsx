import type { Payload } from 'payload'
import { monogramPaths, monogramViewBox } from '../admin/graphics/paths'
import { adminAccessOf } from '../admin/access'

// Academy identity is the primary path. The local password form below it only
// exists in loopback development (POC_DEV_LOCAL_AUTH), so the divider only
// renders then.
export function AcademyLogin({ payload }: { payload?: Payload }) {
  const localAuth = payload ? adminAccessOf(payload).localAuth : false
  return (
    <div className="academy-login">
      <a className="academy-login__button" href="/api/auth/login">
        <svg className="academy-login__mark" viewBox={monogramViewBox} width="18" height="18" aria-hidden="true" fill="currentColor">
          {monogramPaths.map(d => <path key={d} d={d} />)}
        </svg>
        Sign in with Rawkode Academy
      </a>
      <p className="academy-login__help">Staff sign in with your Academy identity.</p>
      {localAuth ? <p className="academy-login__divider"><span>or use a local development account</span></p> : null}
    </div>
  )
}

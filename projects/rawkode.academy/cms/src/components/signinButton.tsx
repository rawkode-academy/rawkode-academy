import Button from 'payload/dist/admin/components/elements/Button'
import React, { useEffect } from 'react'

export const SigninButton: React.FC = () => {
  useEffect(() => {
    setTimeout(() => {
      // window.location.href = '/a'
    }, 2000)
  }, [])
  return (
    <div style={{ marginBottom: 40 }}>
      <Button el="anchor" url="/oauth2/authorize">
        Sign in with GitHub
      </Button>
    </div>
  )
}

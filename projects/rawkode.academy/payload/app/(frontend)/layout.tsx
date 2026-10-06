import './frontend.css'

export const metadata = {
  title: 'Rawkode Academy | Private video review',
  description: 'A private space for Rawkode Academy customers to review, comment on, and approve video cuts.',
}

export default function Layout({children}:{children:React.ReactNode}) {
  return <html lang="en"><body>{children}</body></html>
}

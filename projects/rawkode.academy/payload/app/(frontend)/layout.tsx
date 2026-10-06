import './frontend.css'

export const metadata = {
  title: 'Rawkode Academy CMS',
  description: 'The Rawkode Academy content operations workspace for managing structured content, media, publishing, and review.',
}

export default function Layout({children}:{children:React.ReactNode}) {
  return <html lang="en"><body>{children}</body></html>
}

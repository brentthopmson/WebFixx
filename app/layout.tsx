import './globals.css'
import { AppProvider } from './context/AppContext'
import { LoadingProvider } from './context/LoadingContext'
import RootLayout from './RootLayout'
import ManifestLoader from './components/ManifestLoader'
import RegisterSW from './components/RegisterSW'
import PwaInstallPrompt from './components/PwaInstallPrompt'
import HideSplash from './components/HideSplash'
import { Toaster } from 'sonner'

// Offline fallback for next/font/google
const inter = { className: 'font-sans' }

export const metadata = {
  title: 'WebFixx',
  description: 'Your complete web solution platform',
  manifest: '/manifest.json',
}

export default function Layout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        <meta name="theme-color" content="#2563EB" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="WebFixx" />
        <link rel="apple-touch-icon" href="/favicon.ico" />
        <style>{`
          #splash-screen {
            position: fixed; inset: 0; z-index: 99999;
            display: flex; align-items: center; justify-content: center;
            background: #0F172A;
            opacity: 1; transition: opacity 0.4s ease;
            pointer-events: none;
          }
          #splash-screen.hidden { opacity: 0; }
          #splash-screen .logo-text {
            color: #2563EB; font-weight: bold; font-size: 2.5rem; font-family: sans-serif;
          }
        `}</style>
      </head>
      <body className={inter.className}>
        <div id="splash-screen" suppressHydrationWarning>
          <div className="logo-text">WebFixx</div>
        </div>
        <HideSplash />
        <LoadingProvider>
          <AppProvider>
            <PwaInstallPrompt />
            <RootLayout inter={inter}>
              {children}
            </RootLayout>
            <Toaster richColors position="top-right" />
          </AppProvider>
        </LoadingProvider>
        <ManifestLoader />
        <RegisterSW />
      </body>
    </html>
  )
}
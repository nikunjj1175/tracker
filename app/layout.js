import './globals.css'

export const metadata = {
  title: 'Crypto Trading Tracker',
  description: 'Personal crypto trading history management system',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}


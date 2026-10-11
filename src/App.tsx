import { AudioProvider } from './audio/AudioProvider.tsx'
import { Shell } from './components/Shell.tsx'
import { SessionProvider } from './state/session.tsx'

export default function App() {
  return (
    <SessionProvider>
      <AudioProvider>
        <Shell />
      </AudioProvider>
    </SessionProvider>
  )
}

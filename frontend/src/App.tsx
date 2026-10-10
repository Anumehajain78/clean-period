import { useState } from 'react'
import { Header, type View } from './components/Header'
import { EvidenceView } from './views/EvidenceView'
import { MethodView } from './views/MethodView'
import { PlanView } from './views/PlanView'

export default function App() {
  const [view, setView] = useState<View>('plan')
  return (
    <div className="flex h-dvh flex-col">
      <Header view={view} onView={setView} />
      <main className="min-h-0 flex-1">
        {/* Plan stays mounted so a typed timetable and its plan survive tab switches. */}
        <div className={view === 'plan' ? 'h-full' : 'hidden'}>
          <PlanView />
        </div>
        {view === 'evidence' && <EvidenceView />}
        {view === 'method' && <MethodView />}
      </main>
    </div>
  )
}

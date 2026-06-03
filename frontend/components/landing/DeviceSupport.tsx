import { Smartphone, Monitor, Tablet, Globe } from 'lucide-react'

const DEVICES = [
  { icon: <Smartphone size={26} />, title: 'iPhone & Android', desc: 'Download videos and images directly on iOS and Android via your browser — no app required.' },
  { icon: <Tablet size={26} />,     title: 'Tablets',          desc: 'Full support on iPad and Android tablets. Save media straight to your device.' },
  { icon: <Monitor size={26} />,    title: 'Windows & Mac',    desc: 'Full-speed downloads on desktop with bulk, playlist and 4K/8K support.' },
  { icon: <Globe size={26} />,      title: 'Any Browser',      desc: 'Chrome, Safari, Firefox, Edge — 100% browser-based, nothing to install.' },
]

export default function DeviceSupport() {
  return (
    <section className="py-20 max-w-7xl mx-auto px-4">
      <div className="text-center mb-14">
        <h2 className="text-3xl md:text-4xl font-black text-[var(--text)] mb-3">Works on Every Device</h2>
        <p className="text-[var(--text-2)] max-w-xl mx-auto">
          No installation, no extension, no account. Download on phone, tablet, or computer.
        </p>
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {DEVICES.map((d, i) => (
          <div key={d.title}
            className="p-6 rounded-2xl bg-[var(--bg-card)] border border-[var(--border)] hover:border-[var(--border-hover)] hover:-translate-y-1 transition-all text-center animate-fade-up"
            style={{ animationDelay: `${i * 0.08}s` }}>
            <div className="w-14 h-14 rounded-2xl bg-[var(--brand)]/15 text-[var(--brand)] flex items-center justify-center mx-auto mb-4">{d.icon}</div>
            <h3 className="font-bold text-[var(--text)] mb-2">{d.title}</h3>
            <p className="text-sm text-[var(--text-2)] leading-relaxed">{d.desc}</p>
          </div>
        ))}
      </div>
    </section>
  )
}

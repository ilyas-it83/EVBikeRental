import { Link } from 'react-router-dom';

const plans = [
  {
    name: 'Free',
    price: '$0',
    interval: '',
    features: ['Pay per ride', '$1.00 unlock fee', '$0.15/min riding', 'Basic support'],
    cta: 'Start Free',
    highlighted: false,
  },
  {
    name: 'Monthly',
    price: '$19.99',
    interval: '/mo',
    features: ['Unlimited unlocks', '10% off per-minute rate', 'Priority support', 'Ride history export'],
    cta: 'Go Monthly',
    highlighted: true,
  },
  {
    name: 'Annual',
    price: '$149.99',
    interval: '/yr',
    features: ['Everything in Monthly', '25% off per-minute rate', 'Free 30 min/day', 'Premium support'],
    cta: 'Go Annual',
    highlighted: false,
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Navbar */}
      <header className="flex items-center justify-between px-4 py-4 sm:px-8">
        <span className="text-xl font-bold text-green-600">⚡ EV Bike</span>
        <div className="flex items-center gap-3">
          <Link to="/login" className="text-sm font-medium text-gray-600 hover:text-gray-900">
            Log in
          </Link>
          <Link
            to="/register"
            className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
          >
            Sign up
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-4xl px-4 py-16 text-center sm:py-24">
        <div className="mb-6 text-7xl sm:text-8xl">🚲⚡</div>
        <h1 className="mb-4 text-4xl font-extrabold tracking-tight text-gray-900 sm:text-6xl">
          Green rides, zero hassle
        </h1>
        <p className="mx-auto mb-8 max-w-xl text-lg text-gray-500">
          Rent an electric bike in seconds. Affordable, eco-friendly transportation at your fingertips.
        </p>
        <Link
          to="/register"
          className="inline-block rounded-xl bg-green-600 px-8 py-4 text-lg font-semibold text-white shadow-lg hover:bg-green-700 transition-colors"
        >
          Get Started →
        </Link>
      </section>

      {/* How it works */}
      <section className="bg-gray-50 px-4 py-16 sm:py-20">
        <div className="mx-auto max-w-4xl">
          <h2 className="mb-12 text-center text-3xl font-bold text-gray-900">How it works</h2>
          <div className="grid gap-8 sm:grid-cols-3">
            {[
              { icon: '🔍', title: 'Find a Bike', desc: 'Open the map and locate the nearest station with available bikes.' },
              { icon: '🔓', title: 'Unlock & Ride', desc: 'Scan the QR code or tap to unlock. Start your green commute!' },
              { icon: '🅿️', title: 'Park & Pay', desc: 'Dock at any station. Payment is automatic — simple and fair.' },
            ].map((step, i) => (
              <div key={i} className="text-center">
                <div className="mb-4 text-5xl">{step.icon}</div>
                <h3 className="mb-2 text-lg font-semibold text-gray-900">{step.title}</h3>
                <p className="text-sm text-gray-500">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="px-4 py-16 sm:py-20">
        <div className="mx-auto max-w-5xl">
          <h2 className="mb-12 text-center text-3xl font-bold text-gray-900">Simple pricing</h2>
          <div className="grid gap-6 sm:grid-cols-3">
            {plans.map((plan) => (
              <div
                key={plan.name}
                className={`rounded-2xl border p-6 ${
                  plan.highlighted
                    ? 'border-green-500 bg-green-50 shadow-lg ring-2 ring-green-500'
                    : 'border-gray-200 bg-white'
                }`}
              >
                <h3 className="mb-1 text-lg font-semibold text-gray-900">{plan.name}</h3>
                <div className="mb-4">
                  <span className="text-3xl font-bold text-gray-900">{plan.price}</span>
                  <span className="text-sm text-gray-500">{plan.interval}</span>
                </div>
                <ul className="mb-6 space-y-2">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-sm text-gray-600">
                      <span className="text-green-500">✓</span> {f}
                    </li>
                  ))}
                </ul>
                <Link
                  to="/register"
                  className={`block rounded-lg px-4 py-2.5 text-center text-sm font-medium transition-colors ${
                    plan.highlighted
                      ? 'bg-green-600 text-white hover:bg-green-700'
                      : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                  }`}
                >
                  {plan.cta}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-200 bg-gray-50 px-4 py-8">
        <div className="mx-auto flex max-w-5xl flex-col items-center gap-4 sm:flex-row sm:justify-between">
          <span className="text-sm font-bold text-green-600">⚡ EV Bike Rental</span>
          <div className="flex gap-4 text-sm text-gray-500">
            <Link to="/login" className="hover:text-gray-700">Log in</Link>
            <Link to="/register" className="hover:text-gray-700">Sign up</Link>
          </div>
          <p className="text-xs text-gray-400">© {new Date().getFullYear()} EV Bike Rental. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}

// Public landing page — no auth required
export default function Landing() {
  const goLogin = () => { window.location.href = '/login'; };

  const sources = [
    'Economic Times', 'Moneycontrol', 'NDTV', 'Reddit', 'Glassdoor',
    'G2', 'Trustpilot', 'Hindu BusinessLine', 'YourStory', 'Mint',
    'Inc42', 'Twitter/X', 'LinkedIn', 'Quora', 'Times of India',
  ];
  const tickerText = sources.join(' · ') + ' · ';

  const steps = [
    { n: '01', title: 'Tell us your brand',       desc: 'Enter your company name, competitors, and keywords in under 2 minutes.' },
    { n: '02', title: 'We monitor 15 sources',    desc: 'News, social, reviews, forums — tracked 24/7 so you never miss a mention.' },
    { n: '03', title: 'Get your morning digest',  desc: 'AI summary delivered to email + WhatsApp by 8 AM every day.' },
  ];

  const features = [
    { icon: '📡', title: '15 Sources Monitored',      desc: 'From Economic Times to Glassdoor, we cover where your brand is talked about.' },
    { icon: '🤖', title: 'AI-Powered Digest',          desc: 'Gemini AI summarises overnight mentions into a 2-minute read.' },
    { icon: '🚨', title: 'Crisis Alerts',              desc: 'Get instantly notified when negative sentiment spikes around your brand.' },
    { icon: '📱', title: 'WhatsApp + Email Delivery',  desc: 'Receive your digest wherever you are, every morning.' },
  ];

  const freeFeats = [
    '1 company tracked',
    '5 sources monitored',
    'Daily digest (email only)',
    '7-day digest history',
  ];

  const proFeats = [
    '5 companies tracked',
    '15 sources monitored',
    'Daily digest (email + WhatsApp)',
    '90-day history + crisis alerts',
  ];

  return (
    <div className="min-h-screen bg-[#0A0E27] text-white">

      {/* ticker keyframes — scoped inline so no external CSS needed */}
      <style>{`
        @keyframes ticker-scroll {
          0%   { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .ticker-track {
          display: inline-flex;
          white-space: nowrap;
          animation: ticker-scroll 35s linear infinite;
        }
      `}</style>

      {/* ── 1. NAVBAR ── */}
      <nav className="flex items-center justify-between px-6 sm:px-12 py-5 border-b border-[#2A3858]">
        <span className="text-xl font-bold select-none">
          Brand<span className="text-[#E91E8C]">Monitor</span>
        </span>
        <div className="flex gap-3">
          <button
            onClick={goLogin}
            className="px-4 py-2 text-sm font-semibold rounded-lg border border-[#2A3858] text-[#B4B4B4] hover:text-white hover:border-white transition-colors"
          >
            Sign in
          </button>
          <button
            onClick={goLogin}
            className="px-4 py-2 text-sm font-semibold rounded-lg bg-[#5B63EB] hover:bg-[#4a52d4] text-white transition-colors"
          >
            Start free
          </button>
        </div>
      </nav>

      {/* ── 2. HERO ── */}
      <section className="px-6 sm:px-12 pt-20 pb-10 text-center max-w-4xl mx-auto">

        {/* eyebrow pill */}
        <div className="inline-block border border-[#5B63EB] text-[#A78BFA] text-xs font-semibold px-4 py-1.5 rounded-full mb-6 tracking-wide">
          AI-Powered Brand Intelligence
        </div>

        <h1 className="text-4xl sm:text-6xl font-extrabold leading-tight mb-6">
          Know what India is saying<br />about your brand.
        </h1>

        <p className="text-[#6B7A99] text-base sm:text-lg max-w-2xl mx-auto mb-8 leading-relaxed">
          BrandMonitor tracks 15 sources — news, social, reviews, and forums — and delivers
          an AI digest to your inbox every morning.
        </p>

        <button
          onClick={goLogin}
          className="px-8 py-4 text-base font-bold rounded-xl bg-[#5B63EB] hover:bg-[#4a52d4] text-white transition-colors"
        >
          Start monitoring free
        </button>
        <p className="text-[#6B7A99] text-xs mt-3">No credit card required · Setup in 5 minutes</p>

        {/* animated source ticker */}
        <div className="mt-10 overflow-hidden border-y border-[#2A3858] py-3">
          <div className="ticker-track text-[#6B7A99] text-sm">
            <span>{tickerText}</span>
            <span>{tickerText}</span>
          </div>
        </div>
      </section>

      {/* ── 3. HOW IT WORKS ── */}
      <section className="px-6 sm:px-12 py-16 max-w-5xl mx-auto">
        <h2 className="text-2xl sm:text-3xl font-bold text-center mb-12">
          Up and running in minutes
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-10">
          {steps.map((s) => (
            <div key={s.n} className="flex flex-col items-center text-center">
              <div className="w-12 h-12 rounded-full bg-[#5B63EB]/20 border border-[#5B63EB]/50 flex items-center justify-center text-[#5B63EB] font-bold text-sm mb-4 flex-shrink-0">
                {s.n}
              </div>
              <h3 className="text-white font-semibold text-lg mb-2">{s.title}</h3>
              <p className="text-[#6B7A99] text-sm leading-relaxed">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── 4. FEATURES ── */}
      <section className="px-6 sm:px-12 py-16 bg-[#0D1228]">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-bold text-center mb-12">
            Everything you need to protect your brand
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {features.map((f) => (
              <div key={f.title} className="bg-[#111830] border border-[#2A3858] rounded-2xl p-6">
                <div className="text-2xl mb-3">{f.icon}</div>
                <h3 className="text-white font-semibold text-base mb-2">{f.title}</h3>
                <p className="text-[#6B7A99] text-sm leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 5. PRICING PREVIEW ── */}
      <section className="px-6 sm:px-12 py-16 max-w-4xl mx-auto">
        <h2 className="text-2xl sm:text-3xl font-bold text-center mb-12">Simple pricing</h2>

        <div className="flex flex-col sm:flex-row gap-6 items-stretch">

          {/* Free card */}
          <div className="flex-1 bg-[#111830] border border-[#2A3858] rounded-2xl p-8 flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold">Free</h3>
              <span className="text-xs font-semibold text-[#6B7A99] bg-[#1E2A45] border border-[#2A3858] rounded-full px-3 py-1">
                Starter
              </span>
            </div>
            <div className="mb-6">
              <span className="text-4xl font-extrabold">₹0</span>
              <span className="text-[#6B7A99] text-sm ml-1">/ month</span>
            </div>
            <ul className="flex-1 space-y-2 mb-6 text-sm">
              {freeFeats.map((f) => (
                <li key={f} className="flex items-center gap-2">
                  <span className="text-green-400 font-bold">✓</span>
                  <span className="text-[#B4B4B4]">{f}</span>
                </li>
              ))}
            </ul>
            <button
              onClick={goLogin}
              className="w-full py-3 rounded-xl text-sm font-semibold text-[#6B7A99] bg-[#1E2A45] border border-[#2A3858] hover:text-white transition-colors cursor-pointer"
            >
              Get Started
            </button>
          </div>

          {/* Pro card */}
          <div className="flex-1 bg-[#111830] border-2 border-violet-500 rounded-2xl p-8 flex flex-col shadow-[0_0_32px_rgba(139,92,246,0.25)]">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold">Pro</h3>
              <span className="text-xs font-semibold text-violet-300 bg-violet-900/40 border border-violet-500/50 rounded-full px-3 py-1">
                Most Popular
              </span>
            </div>
            <div className="mb-6">
              <span className="text-4xl font-extrabold">₹2,999</span>
              <span className="text-[#6B7A99] text-sm ml-1">/ month</span>
            </div>
            <ul className="flex-1 space-y-2 mb-6 text-sm">
              {proFeats.map((f) => (
                <li key={f} className="flex items-center gap-2">
                  <span className="text-green-400 font-bold">✓</span>
                  <span className="text-[#B4B4B4]">{f}</span>
                </li>
              ))}
            </ul>
            <button
              onClick={goLogin}
              className="w-full py-3 rounded-xl text-sm font-semibold text-white bg-violet-600 hover:bg-violet-500 transition-colors cursor-pointer"
            >
              Start Pro trial
            </button>
          </div>
        </div>

        <div className="text-center mt-6">
          <button
            onClick={() => { window.location.href = '/pricing'; }}
            className="text-[#5B63EB] text-sm hover:underline cursor-pointer"
          >
            See full plan details →
          </button>
        </div>
      </section>

      {/* ── 6. FOOTER ── */}
      <footer className="border-t border-[#2A3858] px-6 sm:px-12 pt-10 pb-8">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6 mb-6">
          <span className="text-lg font-bold select-none">
            Brand<span className="text-[#E91E8C]">Monitor</span>
          </span>
          <div className="flex gap-6 text-sm text-[#6B7A99]">
            <button onClick={() => { window.location.href = '/dashboard'; }} className="hover:text-white transition-colors">Dashboard</button>
            <button onClick={() => { window.location.href = '/pricing'; }}  className="hover:text-white transition-colors">Pricing</button>
            <button onClick={goLogin}                                        className="hover:text-white transition-colors">Sign in</button>
          </div>
          <span className="text-[#6B7A99] text-sm">support@getvoxagent.com</span>
        </div>
        <p className="text-center text-[#6B7A99] text-xs">© 2026 BrandMonitor. Built by VoxAgent.</p>
      </footer>

    </div>
  );
}

// Pricing page — Free vs Pro plans for BrandMonitor
export default function Pricing() {
  const freeFeatures = [
    { text: '1 company tracked',         included: true  },
    { text: '5 sources monitored',       included: true  },
    { text: 'Daily digest (email only)', included: true  },
    { text: '7-day digest history',      included: true  },
    { text: 'WhatsApp delivery',         included: false },
    { text: 'Competitor tracking',       included: false },
    { text: 'Crisis alerts',             included: false },
    { text: 'Multi-company tracking',    included: false },
  ];

  const proFeatures = [
    { text: '5 companies tracked',                included: true },
    { text: '15 sources monitored',               included: true },
    { text: 'Daily digest (email + WhatsApp)',     included: true },
    { text: '90-day digest history',              included: true },
    { text: 'Competitor tracking',                included: true },
    { text: 'Crisis alerts',                      included: true },
    { text: 'Multi-company tracking',             included: true },
    { text: 'Priority support',                   included: true },
  ];

  const handleUpgrade = () => {
    console.log('razorpay_pending');
  };

  return (
    <div className="min-h-screen bg-[#0A0E27] px-4 py-16">

      {/* heading */}
      <div className="text-center mb-12">
        <h1 className="text-3xl sm:text-4xl font-bold text-white">
          Simple, Transparent Pricing
        </h1>
        <p className="text-gray-400 mt-3 text-base sm:text-lg">
          Start free. Upgrade when you're ready.
        </p>
      </div>

      {/* cards */}
      <div className="max-w-4xl mx-auto flex flex-col sm:flex-row gap-6 items-stretch justify-center">

        {/* Free card */}
        <div className="flex-1 bg-[#111830] border border-[#2A3858] rounded-2xl p-8 flex flex-col">
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-xl font-bold text-white">Free</h2>
            <span className="text-xs font-semibold text-gray-400 bg-[#1E2A45] border border-[#2A3858] rounded-full px-3 py-1">
              Current Plan
            </span>
          </div>

          <div className="mt-4 mb-6">
            <span className="text-4xl font-extrabold text-white">₹0</span>
            <span className="text-gray-400 text-sm ml-1">/ month</span>
          </div>

          <ul className="flex-1 space-y-3 mb-8">
            {freeFeatures.map((f, i) => (
              <li key={i} className="flex items-center gap-3 text-sm">
                {f.included
                  ? <span className="text-green-400 font-bold text-base leading-none">✓</span>
                  : <span className="text-gray-600 font-bold text-base leading-none">✗</span>
                }
                <span className={f.included ? 'text-gray-200' : 'text-gray-500'}>
                  {f.text}
                </span>
              </li>
            ))}
          </ul>

          <button
            disabled
            className="w-full py-3 rounded-xl text-sm font-semibold text-gray-500 bg-[#1E2A45] border border-[#2A3858] cursor-not-allowed"
          >
            Get Started
          </button>
        </div>

        {/* Pro card */}
        <div className="flex-1 bg-[#111830] border-2 border-violet-500 rounded-2xl p-8 flex flex-col relative shadow-[0_0_32px_rgba(139,92,246,0.25)]">
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-xl font-bold text-white">Pro</h2>
            <span className="text-xs font-semibold text-violet-300 bg-violet-900/40 border border-violet-500/50 rounded-full px-3 py-1">
              Most Popular
            </span>
          </div>

          <div className="mt-4 mb-6">
            <span className="text-4xl font-extrabold text-white">₹2,999</span>
            <span className="text-gray-400 text-sm ml-1">/ month</span>
          </div>

          <ul className="flex-1 space-y-3 mb-8">
            {proFeatures.map((f, i) => (
              <li key={i} className="flex items-center gap-3 text-sm">
                <span className="text-green-400 font-bold text-base leading-none">✓</span>
                <span className="text-gray-200">{f.text}</span>
              </li>
            ))}
          </ul>

          <button
            onClick={handleUpgrade}
            className="w-full py-3 rounded-xl text-sm font-semibold text-white bg-violet-600 hover:bg-violet-500 transition-colors duration-150 cursor-pointer"
          >
            Upgrade to Pro
          </button>
        </div>

      </div>

      {/* footer note */}
      <p className="text-center text-gray-500 text-xs mt-10">
        All prices in INR · GST applicable · Cancel anytime · No hidden fees
      </p>

    </div>
  );
}

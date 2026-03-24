"use client";

import dynamic from "next/dynamic";
import { motion } from "framer-motion";
import Navbar from "@/components/Navbar";
import PricingCard from "@/components/PricingCard";
import FeatureGrid from "@/components/FeatureGrid";
import PhoneShowcase from "@/components/PhoneShowcase";
import TerminalDemo from "@/components/TerminalDemo";
import FAQ from "@/components/FAQ";
import Footer from "@/components/Footer";

const PhoneScene = dynamic(() => import("@/components/PhoneScene"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[70vh] md:h-[85vh] flex items-center justify-center bg-[#0a0a0c]">
      <div className="flex flex-col items-center gap-6">
        <img src="/logo.png" alt="OpenClaw Phones" className="h-32 w-auto animate-pulse logo-glow" />
        <div className="text-[#D42B2B] font-mono text-sm cursor-blink">Booting OpenClaw</div>
      </div>
    </div>
  ),
});

export default function Home() {
  return (
    <main className="min-h-screen overflow-x-hidden">
      <Navbar />

      {/* Hero — 3D phone up top, text below with breathing room */}
      <section className="relative pt-28 red-glow-bg">
        <PhoneScene />

        {/* Hero text — sits BELOW the 3D scene, not overlapping */}
        <div className="relative z-10 text-center px-6 pb-16 -mt-12 md:-mt-20">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.8 }}
          >
            <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold leading-tight">
              Your AI Army.
              <br />
              <span className="text-[#D42B2B] drop-shadow-[0_0_30px_rgba(212,43,43,0.4)]">
                In Your Pocket.
              </span>
            </h1>
            <p className="mt-6 text-white/50 text-base md:text-lg max-w-2xl mx-auto leading-relaxed">
              The <span className="text-white/80">Samsung Galaxy A16 5G</span> preloaded with OpenClaw —
              autonomous agents that scrape leads, create content, send outreach, and run your CRM.
              Power on. Deploy. Profit.
            </p>
            <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center">
              <a
                href="#pricing"
                className="bg-[#D42B2B] text-white font-semibold px-10 py-4 rounded-xl text-sm uppercase tracking-wider hover:bg-[#A51C1C] hover:shadow-[0_0_50px_rgba(212,43,43,0.4)] transition-all duration-300"
              >
                Get Yours — $225
              </a>
              <a
                href="#pricing"
                className="border border-white/10 text-white/70 font-semibold px-10 py-4 rounded-xl text-sm uppercase tracking-wider hover:border-[#D42B2B]/50 hover:text-[#D42B2B] hover:shadow-[0_0_30px_rgba(212,43,43,0.15)] transition-all duration-300"
              >
                Full Package — $1,299
              </a>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Glow divider */}
      <div className="glow-divider" />

      {/* Social proof bar */}
      <section className="py-10 relative">
        <div className="max-w-4xl mx-auto flex flex-wrap justify-center gap-8 md:gap-16 px-6">
          {[
            { num: "47+", label: "Agent Skills" },
            { num: "1,800+", label: "Leads Scraped" },
            { num: "5", label: "Active Businesses" },
            { num: "24/7", label: "Autonomous" },
          ].map((s, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="text-center"
            >
              <div className="text-2xl font-bold text-[#D42B2B] drop-shadow-[0_0_10px_rgba(212,43,43,0.3)]">
                {s.num}
              </div>
              <div className="text-xs text-white/30 mt-1">{s.label}</div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Glow divider */}
      <div className="glow-divider" />

      {/* Phone Showcase — real Samsung images + specs */}
      <PhoneShowcase />

      {/* Glow divider */}
      <div className="glow-divider" />

      {/* Features */}
      <FeatureGrid />

      {/* Terminal Demo */}
      <TerminalDemo />

      {/* Glow divider */}
      <div className="glow-divider" />

      {/* Pricing */}
      <section id="pricing" className="py-24 px-6 red-glow-bg">
        <div className="max-w-4xl mx-auto relative z-10">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-4">
            Choose Your <span className="text-[#D42B2B]">Weapon</span>
          </h2>
          <p className="text-center text-white/40 mb-16">
            Both options ship with a brand new Samsung Galaxy A16 5G. No subscriptions. No hidden fees.
          </p>

          <div className="grid md:grid-cols-2 gap-8">
            <PricingCard
              tier="phone"
              name="The Phone"
              price="$225"
              priceId="price_phone_225"
              tagline="Samsung Galaxy A16 5G with OpenClaw installed."
              features={[
                "Brand new Samsung Galaxy A16 5G (Unlocked)",
                "6.7\" Super AMOLED, 5,000 mAh battery",
                "OpenClaw terminal pre-installed",
                "47+ agent skills loaded",
                "MCP server configuration",
                "Setup guide & documentation",
                "Email support",
              ]}
            />
            <PricingCard
              tier="package"
              name="Full Agent Package"
              price="$1,299"
              priceId="price_package_1299"
              tagline="Your complete autonomous revenue engine."
              highlight
              features={[
                "Everything in The Phone, plus:",
                "Complete CRM setup (Supabase-powered)",
                "Lead scraping pipeline configured",
                "SMS outreach system ready to send",
                "Content production pipeline (reels, posts)",
                "Social media automation (IG, TikTok)",
                "1-on-1 onboarding session (90 min)",
                "30 days priority support",
                "Custom agent skills for your business",
              ]}
            />
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 px-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          className="max-w-3xl mx-auto text-center bg-gradient-to-b from-[#121215] to-[#0a0a0c] border border-[#D42B2B]/15 rounded-2xl p-12 glow-border"
        >
          <img src="/logo.png" alt="OpenClaw" className="h-20 w-auto mx-auto mb-6 logo-glow" />
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Stop Building. Start <span className="text-[#D42B2B]">Deploying.</span>
          </h2>
          <p className="text-white/40 mb-8 max-w-lg mx-auto">
            Every day without automation is revenue left on the table. Your competitors are already using AI.
            The question isn&apos;t if — it&apos;s when.
          </p>
          <a
            href="#pricing"
            className="inline-block bg-[#D42B2B] text-white font-semibold px-10 py-4 rounded-xl text-sm uppercase tracking-wider hover:bg-[#A51C1C] hover:shadow-[0_0_50px_rgba(212,43,43,0.4)] transition-all duration-300"
          >
            Deploy Your Army
          </a>
        </motion.div>
      </section>

      {/* FAQ */}
      <FAQ />

      {/* Footer */}
      <Footer />
    </main>
  );
}

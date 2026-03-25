"use client";

import { motion } from "framer-motion";
import Navbar from "@/components/Navbar";
import PricingCard from "@/components/PricingCard";
import FeatureGrid from "@/components/FeatureGrid";
import PhoneShowcase from "@/components/PhoneShowcase";
import TerminalDemo from "@/components/TerminalDemo";
import FAQ from "@/components/FAQ";
import Footer from "@/components/Footer";

export default function Home() {
  return (
    <main className="min-h-screen overflow-x-hidden">
      <Navbar />

      {/* Hero — real phone photo */}
      <section className="relative pt-28 pb-16 red-glow-bg overflow-hidden">
        {/* Background ambient glow */}
        <div className="absolute inset-0 z-0">
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-[radial-gradient(circle,rgba(212,43,43,0.15)_0%,transparent_70%)]" />
        </div>

        <div className="max-w-6xl mx-auto px-6 relative z-10">
          <div className="flex flex-col lg:flex-row items-center gap-8 lg:gap-16">
            {/* Phone image */}
            <motion.div
              initial={{ opacity: 0, x: -40 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8 }}
              className="flex-1 flex justify-center"
            >
              <div className="relative">
                <img
                  src="/hero-phone.png"
                  alt="Samsung Galaxy A16 5G running OpenClaw"
                  className="h-[400px] md:h-[550px] lg:h-[600px] w-auto object-contain phone-glow hero-phone-mask"
                />
                {/* Red glow behind phone */}
                <div className="absolute inset-0 -z-10 blur-3xl bg-[radial-gradient(circle,rgba(212,43,43,0.2)_0%,transparent_60%)]" />
              </div>
            </motion.div>

            {/* Hero text */}
            <motion.div
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3, duration: 0.8 }}
              className="flex-1 text-center lg:text-left"
            >
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold leading-tight">
                Your AI Army.
                <br />
                <span className="text-[#D42B2B] drop-shadow-[0_0_30px_rgba(212,43,43,0.4)]">
                  In Your Pocket.
                </span>
              </h1>
              <p className="mt-6 text-white/50 text-base md:text-lg max-w-lg leading-relaxed">
                The <span className="text-white/80">Samsung Galaxy A16 5G</span> preloaded with
                OpenClaw — autonomous agents that scrape leads, create content, send outreach,
                and run your CRM. Power on. Deploy. Profit.
              </p>
              <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
                <a
                  href="#pricing"
                  className="bg-[#D42B2B] text-white font-semibold px-10 py-4 rounded-xl text-sm uppercase tracking-wider hover:bg-[#A51C1C] hover:shadow-[0_0_50px_rgba(212,43,43,0.4)] transition-all duration-300"
                >
                  Get Yours — $225
                </a>
                <a
                  href="/marketplace"
                  className="border border-white/10 text-white/70 font-semibold px-10 py-4 rounded-xl text-sm uppercase tracking-wider hover:border-[#D42B2B]/50 hover:text-[#D42B2B] hover:shadow-[0_0_30px_rgba(212,43,43,0.15)] transition-all duration-300"
                >
                  Browse Skills
                </a>
              </div>
              <p className="mt-6 text-white/20 text-xs">
                51 agent skills available · $49 each or 5 included with Full Package
              </p>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Glow divider */}
      <div className="glow-divider" />

      {/* Social proof bar */}
      <section className="py-10 relative">
        <div className="max-w-4xl mx-auto flex flex-wrap justify-center gap-8 md:gap-16 px-6">
          {[
            { num: "51", label: "Agent Skills" },
            { num: "Zero", label: "Missed Calls" },
            { num: "$49", label: "Per Skill" },
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
          <p className="text-center text-white/40 mb-6">
            Both options ship with a brand new Samsung Galaxy A16 5G. No subscriptions. No hidden fees.
          </p>
          <p className="text-center text-white/30 text-sm mb-16">
            Or build your own — <a href="/marketplace" className="text-[#D42B2B] hover:underline">browse 51 skills</a> at $49 each.
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
                '6.7" Super AMOLED, 5,000 mAh battery',
                "OpenClaw terminal pre-installed",
                "Base agent runtime configured",
                "MCP server framework ready",
                "Setup guide & documentation",
                "Email support",
              ]}
            />
            <PricingCard
              tier="package"
              name="Full Agent Package"
              price="$1,299"
              priceId="price_package_1299"
              tagline="Agent + 5 preloaded skills from the marketplace."
              highlight
              features={[
                "Everything in The Phone, plus:",
                "Choose 5 skills from the marketplace",
                "Skills configured & tested for your business",
                "Complete CRM setup (Supabase-powered)",
                "1-on-1 onboarding session (90 min)",
                "30 days priority support",
                "Additional skills available at $49 each",
                "Free skill updates for life",
              ]}
            />
          </div>
        </div>
      </section>

      {/* Marketplace CTA */}
      <section className="py-16 px-6">
        <div className="glow-divider mb-16" />
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="max-w-3xl mx-auto text-center"
        >
          <h2 className="text-2xl md:text-3xl font-bold mb-4">
            Want Specific <span className="text-[#D42B2B]">Capabilities?</span>
          </h2>
          <p className="text-white/40 mb-8 max-w-lg mx-auto text-sm">
            Browse our full catalog of 51 agent skills. Lead scraping, content creation, CRM,
            social media, analytics, engineering — pick exactly what you need at $49 per skill.
          </p>
          <a
            href="/marketplace"
            className="inline-block bg-[#D42B2B] text-white font-semibold px-10 py-4 rounded-xl text-sm uppercase tracking-wider hover:bg-[#A51C1C] hover:shadow-[0_0_50px_rgba(212,43,43,0.4)] transition-all duration-300"
          >
            Browse Skills Marketplace
          </a>
        </motion.div>
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

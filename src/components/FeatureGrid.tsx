"use client";

import { motion } from "framer-motion";

const features = [
  {
    icon: "🤖",
    title: "47+ Agent Skills",
    desc: "Content creation, lead scraping, CRM management, social media automation — all preloaded and ready.",
  },
  {
    icon: "📱",
    title: "Samsung Galaxy",
    desc: "Brand new Samsung phone with OpenClaw terminal, MCP servers, and agent orchestration pre-configured.",
  },
  {
    icon: "🧠",
    title: "Autonomous Agents",
    desc: "Multi-agent swarms that research, plan, execute, and learn. Your business runs while you sleep.",
  },
  {
    icon: "💰",
    title: "Revenue on Autopilot",
    desc: "Lead gen, outreach, content pipeline, and CRM — a complete revenue engine in your pocket.",
  },
  {
    icon: "🔒",
    title: "Your Data, Your Device",
    desc: "Everything runs locally. No cloud dependency. Your agents, your data, your control.",
  },
  {
    icon: "⚡",
    title: "Zero Setup",
    desc: "Power on, authenticate, deploy. No terminal experience needed. We handle the hard part.",
  },
];

export default function FeatureGrid() {
  return (
    <section id="features" className="py-24 px-6">
      <div className="max-w-6xl mx-auto">
        <motion.h2
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="text-3xl md:text-4xl font-bold text-center mb-4"
        >
          What&apos;s Inside <span className="text-[#D42B2B]">the Claw</span>
        </motion.h2>
        <p className="text-center text-white/40 mb-16 max-w-xl mx-auto">
          Every phone ships with a fully configured autonomous agent system. Not an app — a weapon.
        </p>

        <div className="grid md:grid-cols-3 gap-6">
          {features.map((f, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="bg-[#121215] border border-white/5 rounded-xl p-6 hover:border-[#D42B2B]/20 transition-colors duration-300"
            >
              <div className="text-3xl mb-4">{f.icon}</div>
              <h3 className="text-white font-semibold mb-2">{f.title}</h3>
              <p className="text-white/50 text-sm leading-relaxed">{f.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

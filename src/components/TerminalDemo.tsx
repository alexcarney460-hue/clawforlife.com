"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";

const demoLines = [
  { text: "$ openclaw deploy --target=revenue", delay: 0 },
  { text: "", delay: 400 },
  { text: "  Spawning agent swarm...", delay: 800 },
  { text: "  ├─ lead-scraper    → 1,847 leads found", delay: 1400 },
  { text: "  ├─ content-engine  → 12 reels queued", delay: 2000 },
  { text: "  ├─ sms-outreach    → 300 texts scheduled", delay: 2600 },
  { text: "  ├─ crm-sync        → pipeline updated", delay: 3200 },
  { text: "  └─ analytics       → dashboard live", delay: 3800 },
  { text: "", delay: 4200 },
  { text: "  Revenue engine deployed. ETA to first lead: 4 minutes.", delay: 4600 },
  { text: "  █", delay: 5200 },
];

export default function TerminalDemo() {
  const [visibleLines, setVisibleLines] = useState(0);

  useEffect(() => {
    const timers = demoLines.map((line, i) =>
      setTimeout(() => setVisibleLines(i + 1), line.delay)
    );
    return () => timers.forEach(clearTimeout);
  }, []);

  return (
    <section className="py-24 px-6">
      <div className="max-w-3xl mx-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          className="bg-[#0a0a0c] border border-[#D42B2B]/20 rounded-xl overflow-hidden glow-border"
        >
          {/* Title bar */}
          <div className="flex items-center gap-2 px-4 py-3 bg-[#121215] border-b border-white/5">
            <div className="w-3 h-3 rounded-full bg-[#D42B2B]/80" />
            <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
            <div className="w-3 h-3 rounded-full bg-green-500/80" />
            <span className="ml-3 text-white/30 text-xs">openclaw — samsung-galaxy</span>
          </div>

          {/* Terminal body */}
          <div className="p-6 font-mono text-sm leading-relaxed min-h-[320px]">
            {demoLines.slice(0, visibleLines).map((line, i) => (
              <div
                key={i}
                className={`${
                  line.text.startsWith("$")
                    ? "text-[#D42B2B]"
                    : line.text.includes("→")
                    ? "text-white/70"
                    : line.text.includes("Revenue")
                    ? "text-[#FF4444] font-semibold"
                    : "text-white/40"
                }`}
              >
                {line.text || "\u00A0"}
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}

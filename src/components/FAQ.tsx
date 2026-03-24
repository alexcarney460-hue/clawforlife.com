"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const faqs = [
  {
    q: "What phone model ships?",
    a: "Samsung Galaxy A16 5G — unlocked, brand new, with OpenClaw pre-configured. Works on all major US carriers.",
  },
  {
    q: "What's the difference between the $225 and $1,299 package?",
    a: "The $225 phone comes with OpenClaw installed and basic agent skills. The $1,299 Full Agent Package includes the phone PLUS our complete content production pipeline, CRM setup, lead scraping tools, SMS outreach system, and 1-on-1 onboarding to get your first revenue pipeline live.",
  },
  {
    q: "Do I need coding experience?",
    a: "No. The phone ships ready to use. Power on, authenticate with your API keys, and the agents start working. The $1,299 package includes full onboarding.",
  },
  {
    q: "What API keys do I need?",
    a: "At minimum, a Claude API key ($20/mo typical usage). The full package includes setup for all services: Brave Search, social media APIs, and more.",
  },
  {
    q: "Can I return it?",
    a: "14-day return policy on the phone. The full package is non-refundable once onboarding begins, but the phone portion is still returnable.",
  },
  {
    q: "How fast does it ship?",
    a: "Phones ship within 2 business days. Full packages ship same-day with onboarding scheduled within 48 hours.",
  },
];

export default function FAQ() {
  const [open, setOpen] = useState<number | null>(null);

  return (
    <section id="faq" className="py-24 px-6">
      <div className="max-w-2xl mx-auto">
        <h2 className="text-3xl font-bold text-center mb-12">
          Frequently <span className="text-[#D42B2B]">Asked</span>
        </h2>

        <div className="space-y-3">
          {faqs.map((faq, i) => (
            <div
              key={i}
              className="border border-white/5 rounded-xl overflow-hidden bg-[#121215]"
            >
              <button
                onClick={() => setOpen(open === i ? null : i)}
                className="w-full flex items-center justify-between p-5 text-left text-white/80 hover:text-white transition-colors"
              >
                <span className="text-sm font-medium">{faq.q}</span>
                <span className="text-[#D42B2B] text-lg ml-4">{open === i ? "−" : "+"}</span>
              </button>
              <AnimatePresence>
                {open === i && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <p className="px-5 pb-5 text-sm text-white/50 leading-relaxed">{faq.a}</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

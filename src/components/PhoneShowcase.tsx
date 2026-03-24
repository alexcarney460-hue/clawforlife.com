"use client";

import { motion } from "framer-motion";

const specs = [
  { label: "Display", value: '6.7" Super AMOLED' },
  { label: "Processor", value: "Exynos 1330" },
  { label: "RAM", value: "4GB / 6GB" },
  { label: "Storage", value: "128GB / 256GB" },
  { label: "Battery", value: "5,000 mAh" },
  { label: "Camera", value: "50MP Triple" },
  { label: "5G", value: "Sub-6 GHz" },
  { label: "OS", value: "Android 14 + OpenClaw" },
];

export default function PhoneShowcase() {
  return (
    <section id="phone" className="py-24 px-6 red-glow-bg overflow-hidden">
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Samsung Galaxy <span className="text-[#D42B2B]">A16 5G</span>
          </h2>
          <p className="text-white/40 max-w-xl mx-auto">
            6.7&quot; Super AMOLED display. 5,000 mAh battery. Triple camera.
            5G connectivity. Preloaded with your autonomous AI command center.
          </p>
        </motion.div>

        {/* Phone gallery */}
        <div className="grid md:grid-cols-3 gap-8 mb-20 relative z-10">
          <motion.div
            initial={{ opacity: 0, x: -40 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="flex flex-col items-center"
          >
            <div className="relative mb-4">
              <img
                src="/samsung-a16-samsung.jpg"
                alt="Samsung Galaxy A16 5G - Blue Black"
                className="h-72 md:h-96 w-auto object-contain phone-glow"
              />
            </div>
            <span className="text-white/50 text-sm">Blue Black — Front</span>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="flex flex-col items-center"
          >
            <div className="relative mb-4">
              <img
                src="/samsung-a16-front.jpg"
                alt="Samsung Galaxy A16 5G - All Views"
                className="h-72 md:h-96 w-auto object-contain phone-glow"
              />
            </div>
            <span className="text-white/50 text-sm">Front + Side + Back</span>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 40 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.3 }}
            className="flex flex-col items-center"
          >
            <div className="relative mb-4">
              <img
                src="/samsung-a16-back.jpg"
                alt="Samsung Galaxy A16 5G - Color Options"
                className="h-72 md:h-96 w-auto object-contain phone-glow"
              />
            </div>
            <span className="text-white/50 text-sm">Available Colors</span>
          </motion.div>
        </div>

        {/* Specs grid */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="grid grid-cols-2 md:grid-cols-4 gap-4 relative z-10"
        >
          {specs.map((spec, i) => (
            <div
              key={i}
              className="bg-[#121215] border border-white/5 rounded-xl p-4 text-center hover:border-[#D42B2B]/20 transition-colors"
            >
              <div className="text-[#D42B2B] text-xs uppercase tracking-wider mb-1">{spec.label}</div>
              <div className="text-white font-semibold text-sm">{spec.value}</div>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

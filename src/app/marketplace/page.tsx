"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

type Category =
  | "all"
  | "lead-gen"
  | "content"
  | "marketing"
  | "sales"
  | "operations"
  | "engineering"
  | "analytics"
  | "design";

interface Skill {
  name: string;
  category: Category;
  desc: string;
  hot?: boolean;
}

const skills: Skill[] = [
  // Lead Gen & Outreach
  { name: "Lead Scraper", category: "lead-gen", desc: "Scrapes targeted business leads from Google Maps, Google Search, and social platforms. Extracts phone, email, website, address, and ratings. Outputs clean CSV ready for outreach.", hot: true },
  { name: "SMS Outreach Engine", category: "lead-gen", desc: "Automated text message campaigns with A/B testing, drip sequences (Day 1/3/7/14/21), reply monitoring, and auto-responder. Sends via your phone — no Twilio needed.", hot: true },
  { name: "Outbound Strategist", category: "lead-gen", desc: "Designs multi-channel prospecting sequences. Defines ICPs, builds pipeline through research-driven personalization, not volume. Signal-based targeting." },
  { name: "Discovery Coach", category: "lead-gen", desc: "Coaches on elite discovery methodology — question design, current-state mapping, gap quantification, and call structure that surfaces real buying motivation." },

  // Content Creation
  { name: "Viral Reel Generator", category: "content", desc: "Creates short-form video scripts for Instagram Reels, TikTok, and YouTube Shorts. Engineered hooks, visual-to-audio sync, trend-jacking, and anti-slop writing rules.", hot: true },
  { name: "Content Pipeline", category: "content", desc: "Full content lifecycle — from trend research to concept, script, storyboard, generation, assembly, and publishing. End-to-end automated content factory." },
  { name: "Art Director", category: "content", desc: "Visual identity and creative direction for all content. Establishes look, feel, color grading, typography, and composition rules for brand consistency." },
  { name: "Scriptwriter", category: "content", desc: "Writes scripts optimized for short-form video, ads, and promotional content. Hooks in first 2 seconds, pattern interrupts, emotional pacing." },
  { name: "Storyboard Creator", category: "content", desc: "Translates scripts into shot-by-shot visual plans. Scene composition, camera angles, transitions, and timing breakdowns for production." },
  { name: "Content Repurposer", category: "content", desc: "Takes one piece of content and multiplies it across platforms — turns a reel into tweets, carousels, blog posts, email sequences, and more." },
  { name: "Short-Video Editor", category: "content", desc: "Post-production coaching: composition, color grading, audio engineering, motion graphics, subtitles, and multi-platform export optimization." },

  // Marketing & Social
  { name: "Instagram Growth", category: "marketing", desc: "Algorithm optimization, hashtag strategy, engagement automation, follower growth tactics, and content calendar management for Instagram.", hot: true },
  { name: "TikTok Strategist", category: "marketing", desc: "Viral content planning, algorithm mechanics, trending audio/effects, community building, and full-funnel brand growth on TikTok." },
  { name: "SEO Specialist", category: "marketing", desc: "Technical SEO audits, content optimization, keyword research, link authority building, and organic search growth strategies." },
  { name: "LinkedIn Creator", category: "marketing", desc: "Thought leadership, personal brand building, high-engagement professional content. Masters LinkedIn's algorithm for inbound opportunities." },
  { name: "Social Media Strategist", category: "marketing", desc: "Cross-platform campaign design across LinkedIn, Twitter, Instagram, and TikTok. Community management, real-time engagement, and analytics." },
  { name: "Growth Hacker", category: "marketing", desc: "Rapid user acquisition through data-driven experimentation. Viral loops, conversion funnel optimization, and scalable growth channel discovery." },
  { name: "Twitter Engager", category: "marketing", desc: "Real-time engagement, thread creation, thought leadership building, and community-driven growth. Authentic conversation participation at scale." },
  { name: "Reddit Builder", category: "marketing", desc: "Authentic community engagement, value-driven content creation, and long-term relationship building. Masters Reddit culture navigation." },
  { name: "App Store Optimizer", category: "marketing", desc: "ASO strategy, keyword optimization, conversion rate optimization, screenshot A/B testing, and app discoverability across iOS and Android." },
  { name: "Email Campaign Builder", category: "marketing", desc: "Drip sequences, segmentation, A/B subject line testing, deliverability optimization, and lifecycle email automation." },

  // Sales & CRM
  { name: "CRM Setup & Sync", category: "sales", desc: "Full CRM configuration on Supabase — lead tracking, pipeline stages, deal management, contact enrichment, and automated status updates.", hot: true },
  { name: "Deal Strategist", category: "sales", desc: "MEDDPICC qualification, competitive positioning, and win planning for complex B2B sales cycles. Scores opportunities and exposes pipeline risk." },
  { name: "Sales Coach", category: "sales", desc: "Rep development, pipeline review facilitation, call coaching, deal strategy, and forecast accuracy improvement through structured methodology." },
  { name: "Proposal Writer", category: "sales", desc: "Transforms opportunities into compelling win narratives. Win theme development, competitive positioning, executive summary craft." },
  { name: "Pipeline Analyst", category: "sales", desc: "Pipeline health diagnostics, deal velocity analysis, forecast accuracy, and data-driven coaching. Turns CRM data into actionable intelligence." },
  { name: "Account Strategist", category: "sales", desc: "Land-and-expand execution, stakeholder mapping, QBR facilitation, and net revenue retention. Systematic expansion planning." },
  { name: "Sales Engineer", category: "sales", desc: "Technical discovery, demo engineering, POC scoping, competitive battlecards, and bridging product capabilities to business outcomes." },

  // Operations & Project Management
  { name: "CrowdTest Focus Groups", category: "operations", desc: "AI-powered synthetic focus groups. Test any idea, ad, website, or message with 50 demographically-accurate personas. Data-grounded reactions.", hot: true },
  { name: "Think Tank Debates", category: "operations", desc: "9-expert panel simulation. Real researchers argue your question from different angles, generating emergent insights no single perspective could produce." },
  { name: "Project Manager", category: "operations", desc: "Cross-functional project coordination, timeline management, stakeholder alignment, and risk management from conception to completion." },
  { name: "Sprint Prioritizer", category: "operations", desc: "Agile sprint planning, feature prioritization, and resource allocation. Maximizes team velocity and business value delivery." },
  { name: "Workflow Optimizer", category: "operations", desc: "Analyzes, optimizes, and automates workflows across all business functions. Process improvement at every level." },
  { name: "Document Generator", category: "operations", desc: "Professional PDF, PPTX, DOCX, and XLSX generation with proper formatting, charts, and data visualization. Report automation." },
  { name: "Finance Tracker", category: "operations", desc: "Financial planning, budget management, cash flow optimization, and strategic financial insights for business growth." },
  { name: "Legal Compliance", category: "operations", desc: "Ensures business operations, data handling, and content creation comply with relevant laws, regulations, and industry standards." },

  // Engineering & Technical
  { name: "Website Builder", category: "engineering", desc: "Full-stack web development — React, Next.js, databases, APIs, authentication, and deployment. From landing page to full SaaS.", hot: true },
  { name: "API Architect", category: "engineering", desc: "REST and GraphQL API design, OpenAPI specs, versioning strategies, pagination patterns, authentication flows, and rate limiting." },
  { name: "Database Optimizer", category: "engineering", desc: "Schema design, query optimization, indexing strategies, and performance tuning for PostgreSQL, MySQL, and Supabase." },
  { name: "DevOps Pipeline", category: "engineering", desc: "Docker, CI/CD pipelines, Kubernetes, Terraform, GitHub Actions, and automated deployment infrastructure." },
  { name: "Security Auditor", category: "engineering", desc: "Vulnerability detection, OWASP Top 10 prevention, secret scanning, dependency audits, and security hardening." },
  { name: "Mobile App Builder", category: "engineering", desc: "Native iOS/Android development and cross-platform apps with React Native, Expo, and Flutter." },
  { name: "MCP Server Builder", category: "engineering", desc: "Custom Model Context Protocol servers that extend AI agent capabilities with new tools, resources, and integrations." },
  { name: "Automation Builder", category: "engineering", desc: "n8n workflows, webhook integrations, scheduled tasks, and event-driven automation pipelines connecting any service." },

  // Analytics & Intelligence
  { name: "Analytics Dashboard", category: "analytics", desc: "Custom dashboards, KPI tracking, statistical analysis, and strategic decision support through data visualization.", hot: true },
  { name: "Trend Researcher", category: "analytics", desc: "Market intelligence, emerging trend identification, competitive analysis, and opportunity assessment for product strategy." },
  { name: "Paid Media Auditor", category: "analytics", desc: "200+ checkpoint audit across Google Ads, Meta, and Microsoft accounts. Structure, tracking, bidding, creative, and audience analysis." },
  { name: "PPC Strategist", category: "analytics", desc: "Search, shopping, and Performance Max campaign architecture across Google, Microsoft, and Amazon ad platforms." },
  { name: "Tracking & Attribution", category: "analytics", desc: "Conversion tracking architecture, tag management, GA4 setup, Meta CAPI, and server-side implementations." },

  // Design & Brand
  { name: "Brand Guardian", category: "design", desc: "Brand identity development, consistency maintenance, and strategic positioning. Ensures every touchpoint reflects your brand DNA." },
  { name: "UI/UX Designer", category: "design", desc: "Visual design systems, component libraries, pixel-perfect interfaces, user research, usability testing, and accessible design." },
  { name: "Image Prompt Engineer", category: "design", desc: "Crafts detailed prompts for AI image generation. Translates visual concepts into precise language for stunning photography." },
  { name: "Visual Storyteller", category: "design", desc: "Compelling visual narratives, multimedia content, and brand storytelling. Transforms complex information into engaging visuals." },
];

const categories: { key: Category; label: string }[] = [
  { key: "all", label: "All Skills" },
  { key: "lead-gen", label: "Lead Gen" },
  { key: "content", label: "Content" },
  { key: "marketing", label: "Marketing" },
  { key: "sales", label: "Sales & CRM" },
  { key: "operations", label: "Operations" },
  { key: "engineering", label: "Engineering" },
  { key: "analytics", label: "Analytics" },
  { key: "design", label: "Design" },
];

export default function MarketplacePage() {
  const [active, setActive] = useState<Category>("all");
  const [cart, setCart] = useState<string[]>([]);

  const filtered = active === "all" ? skills : skills.filter((s) => s.category === active);

  const toggleCart = (name: string) => {
    setCart((prev) =>
      prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]
    );
  };

  const handleCheckout = async () => {
    const res = await fetch("/api/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tier: "skills",
        skills: cart,
        quantity: cart.length,
      }),
    });
    const { url } = await res.json();
    if (url) window.location.href = url;
  };

  return (
    <main className="min-h-screen">
      <Navbar />

      <section className="pt-32 pb-16 px-6 red-glow-bg">
        <div className="max-w-6xl mx-auto relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-12"
          >
            <h1 className="text-4xl md:text-5xl font-bold mb-4">
              Skills <span className="text-[#D42B2B]">Marketplace</span>
            </h1>
            <p className="text-white/40 max-w-xl mx-auto">
              {skills.length} autonomous agent skills. Each one a specialist.
              Pick exactly what your business needs — $49 each.
            </p>
          </motion.div>

          {/* Category filters */}
          <div className="flex flex-wrap justify-center gap-2 mb-12">
            {categories.map((cat) => (
              <button
                key={cat.key}
                onClick={() => setActive(cat.key)}
                className={`px-4 py-2 rounded-lg text-xs font-medium uppercase tracking-wider transition-all duration-200 cursor-pointer ${
                  active === cat.key
                    ? "bg-[#D42B2B] text-white shadow-[0_0_20px_rgba(212,43,43,0.3)]"
                    : "bg-white/5 text-white/40 hover:text-white/70 hover:bg-white/10"
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Cart banner */}
          <AnimatePresence>
            {cart.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-[#121215] border border-[#D42B2B]/30 rounded-2xl px-6 py-4 flex items-center gap-6 shadow-[0_0_40px_rgba(212,43,43,0.2)]"
              >
                <div className="text-sm">
                  <span className="text-[#D42B2B] font-bold">{cart.length}</span>
                  <span className="text-white/50"> skill{cart.length > 1 ? "s" : ""} selected</span>
                </div>
                <div className="text-white font-bold">${cart.length * 49}</div>
                <button
                  onClick={handleCheckout}
                  className="bg-[#D42B2B] text-white text-sm font-semibold px-6 py-2.5 rounded-lg hover:bg-[#A51C1C] hover:shadow-[0_0_20px_rgba(212,43,43,0.4)] transition-all cursor-pointer"
                >
                  Checkout
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Skills grid */}
          <motion.div layout className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            <AnimatePresence mode="popLayout">
              {filtered.map((skill) => {
                const inCart = cart.includes(skill.name);
                return (
                  <motion.div
                    key={skill.name}
                    layout
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.2 }}
                    className={`bg-[#121215] border rounded-xl p-5 flex flex-col transition-all duration-200 ${
                      inCart
                        ? "border-[#D42B2B]/40 shadow-[0_0_20px_rgba(212,43,43,0.15)]"
                        : "border-white/5 hover:border-[#D42B2B]/20"
                    }`}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <h3 className="text-white font-semibold text-sm">{skill.name}</h3>
                        {skill.hot && (
                          <span className="bg-[#D42B2B]/20 text-[#FF4444] text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">
                            Popular
                          </span>
                        )}
                      </div>
                      <span className="text-[#D42B2B] font-bold text-sm shrink-0 ml-2">$49</span>
                    </div>
                    <p className="text-white/40 text-xs leading-relaxed flex-1">{skill.desc}</p>
                    <button
                      onClick={() => toggleCart(skill.name)}
                      className={`mt-4 w-full py-2.5 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all duration-200 cursor-pointer ${
                        inCart
                          ? "bg-[#D42B2B] text-white"
                          : "bg-white/5 text-white/50 border border-white/10 hover:border-[#D42B2B]/30 hover:text-white"
                      }`}
                    >
                      {inCart ? "✓ Added" : "Add to Phone"}
                    </button>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </motion.div>

          {/* Bottom CTA */}
          <div className="mt-16 text-center">
            <p className="text-white/30 text-sm mb-4">
              Can&apos;t decide? The Full Agent Package includes your choice of 5 skills.
            </p>
            <a
              href="/#pricing"
              className="inline-block border border-[#D42B2B]/30 text-[#D42B2B] font-semibold px-8 py-3 rounded-xl text-sm uppercase tracking-wider hover:bg-[#D42B2B] hover:text-white transition-all duration-300"
            >
              View Packages
            </a>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
}

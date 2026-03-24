export default function Footer() {
  return (
    <footer className="border-t border-[#D42B2B]/10 py-16 px-6">
      <div className="max-w-6xl mx-auto flex flex-col items-center gap-8">
        <a href="/">
          <img src="/logo.png" alt="OpenClaw Phones" className="h-20 w-auto logo-glow" />
        </a>
        <p className="text-white/30 text-xs text-center max-w-md">
          Samsung Galaxy A16 5G preloaded with OpenClaw autonomous agent system.
          Built by TerpTech LLC.
        </p>
        <div className="flex gap-8 text-xs text-white/30">
          <a href="#" className="hover:text-[#D42B2B] transition-colors">Terms</a>
          <a href="#" className="hover:text-[#D42B2B] transition-colors">Privacy</a>
          <a href="#" className="hover:text-[#D42B2B] transition-colors">Contact</a>
        </div>
        <p className="text-white/15 text-xs">
          © {new Date().getFullYear()} TerpTech LLC. All rights reserved.
        </p>
      </div>
    </footer>
  );
}

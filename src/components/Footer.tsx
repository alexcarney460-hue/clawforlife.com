export default function Footer() {
  return (
    <footer className="border-t border-[#D42B2B]/10 py-16 px-6">
      <div className="max-w-6xl mx-auto flex flex-col items-center gap-8">
        <a href="/">
          <img src="/logo.png" alt="OpenClaw Phones" className="h-20 w-auto logo-glow" />
        </a>
        <p className="text-white/30 text-xs text-center max-w-md">
          AI-powered business phones with OpenClaw pre-installed.
          Your AI receptionist, out of the box.
        </p>
        <div className="flex flex-col items-center gap-4">
          <p className="text-white/20 text-[10px] uppercase tracking-widest">Businesses powered by OpenClaw</p>
          <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-xs">
            <a href="https://openfans.online" target="_blank" rel="noopener noreferrer" className="text-white/30 hover:text-[#D42B2B] transition-colors">OpenFans</a>
            <a href="https://valuesuppliers.co" target="_blank" rel="noopener noreferrer" className="text-white/30 hover:text-[#D42B2B] transition-colors">Triple OG Gloves</a>
            <a href="https://motionventures.ai" target="_blank" rel="noopener noreferrer" className="text-white/30 hover:text-[#D42B2B] transition-colors">Motion Ventures</a>
          </div>
        </div>
        <div className="flex gap-8 text-xs text-white/30">
          <a href="#" className="hover:text-[#D42B2B] transition-colors">Terms</a>
          <a href="#" className="hover:text-[#D42B2B] transition-colors">Privacy</a>
          <a href="#" className="hover:text-[#D42B2B] transition-colors">Contact</a>
        </div>
        <p className="text-white/15 text-xs">
          © {new Date().getFullYear()} ClawForLife. All rights reserved.
        </p>
      </div>
    </footer>
  );
}

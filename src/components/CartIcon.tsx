"use client";

import { useCart } from "./CartProvider";

export default function CartIcon() {
  const { totalItems } = useCart();

  return (
    <a
      href="/cart"
      className="relative flex items-center gap-1 text-white/50 hover:text-[#D42B2B] transition-colors"
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="9" cy="21" r="1" />
        <circle cx="20" cy="21" r="1" />
        <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
      </svg>
      {totalItems > 0 && (
        <span className="absolute -top-2 -right-2 bg-[#D42B2B] text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center">
          {totalItems}
        </span>
      )}
    </a>
  );
}

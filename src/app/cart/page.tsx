"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { useCart, CartItem } from "@/components/CartProvider";

function formatPrice(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

const US_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA",
  "KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ",
  "NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT",
  "VA","WA","WV","WI","WY","DC",
];

export default function CartPage() {
  const { items, removeItem, updateQuantity, totalPrice, clearCart } = useCart();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const needsShipping = items.some((i) => i.type === "phone" || i.type === "package");

  const [shipping, setShipping] = useState({
    name: "",
    email: "",
    phone: "",
    line1: "",
    line2: "",
    city: "",
    state: "",
    zip: "",
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setShipping((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const validate = () => {
    if (!shipping.name.trim()) return "Name is required";
    if (!shipping.email.trim() || !shipping.email.includes("@")) return "Valid email is required";
    if (!shipping.phone.trim()) return "Phone number is required";
    if (needsShipping) {
      if (!shipping.line1.trim()) return "Street address is required";
      if (!shipping.city.trim()) return "City is required";
      if (!shipping.state) return "State is required";
      if (!shipping.zip.trim() || shipping.zip.length < 5) return "Valid ZIP code is required";
    }
    return null;
  };

  const handleCheckout = async () => {
    const err = validate();
    if (err) {
      setError(err);
      return;
    }
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tier: "cart",
          items: items.map((i) => ({
            id: i.id,
            name: i.name,
            price: i.price,
            type: i.type,
            quantity: i.quantity,
          })),
          shipping,
        }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        setError(data.error || "Checkout failed. Please try again.");
        setLoading(false);
      }
    } catch {
      setError("Something went wrong. Please try again.");
      setLoading(false);
    }
  };

  const inputClass =
    "w-full bg-[#0e0e12] border border-white/10 rounded-lg px-4 py-3 text-white text-sm placeholder-white/20 focus:outline-none focus:border-[#D42B2B]/50 transition-colors";

  return (
    <main className="min-h-screen">
      <Navbar />

      <section className="pt-32 pb-24 px-6">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-bold mb-8">
            Your <span className="text-[#D42B2B]">Cart</span>
          </h1>

          {items.length === 0 ? (
            <div className="text-center py-24">
              <p className="text-white/40 mb-6">Your cart is empty</p>
              <a
                href="/#pricing"
                className="text-[#D42B2B] hover:underline text-sm"
              >
                ← Browse products
              </a>
            </div>
          ) : (
            <div className="grid lg:grid-cols-5 gap-8">
              {/* Cart items + shipping — left side */}
              <div className="lg:col-span-3 space-y-6">
                {/* Items */}
                <div className="space-y-3">
                  {items.map((item) => (
                    <div
                      key={item.id}
                      className="bg-[#121215] border border-white/5 rounded-xl p-4 flex items-center gap-4"
                    >
                      <div className="flex-1">
                        <div className="text-white font-medium text-sm">{item.name}</div>
                        <div className="text-white/30 text-xs mt-1 capitalize">{item.type}</div>
                      </div>
                      {item.type === "skill" ? (
                        <div className="flex items-center gap-2">
                          <span className="text-white/50 text-sm">{formatPrice(item.price)}</span>
                        </div>
                      ) : (
                        <span className="text-white/50 text-sm">{formatPrice(item.price)}</span>
                      )}
                      <button
                        onClick={() => removeItem(item.id)}
                        className="text-white/20 hover:text-[#D42B2B] transition-colors text-lg cursor-pointer"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>

                {/* Shipping / Contact Form */}
                <div className="bg-[#121215] border border-white/5 rounded-xl p-6">
                  <h2 className="text-white font-semibold text-sm uppercase tracking-wider mb-6">
                    {needsShipping ? "Shipping & Contact" : "Contact Information"}
                  </h2>

                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <input
                        name="name"
                        placeholder="Full Name"
                        value={shipping.name}
                        onChange={handleChange}
                        className={inputClass}
                      />
                      <input
                        name="phone"
                        placeholder="Phone Number"
                        value={shipping.phone}
                        onChange={handleChange}
                        className={inputClass}
                      />
                    </div>
                    <input
                      name="email"
                      type="email"
                      placeholder="Email Address"
                      value={shipping.email}
                      onChange={handleChange}
                      className={inputClass}
                    />

                    {needsShipping && (
                      <>
                        <input
                          name="line1"
                          placeholder="Street Address"
                          value={shipping.line1}
                          onChange={handleChange}
                          className={inputClass}
                        />
                        <input
                          name="line2"
                          placeholder="Apt, Suite, etc. (optional)"
                          value={shipping.line2}
                          onChange={handleChange}
                          className={inputClass}
                        />
                        <div className="grid grid-cols-3 gap-4">
                          <input
                            name="city"
                            placeholder="City"
                            value={shipping.city}
                            onChange={handleChange}
                            className={inputClass}
                          />
                          <select
                            name="state"
                            value={shipping.state}
                            onChange={handleChange}
                            className={inputClass}
                          >
                            <option value="">State</option>
                            {US_STATES.map((s) => (
                              <option key={s} value={s}>
                                {s}
                              </option>
                            ))}
                          </select>
                          <input
                            name="zip"
                            placeholder="ZIP"
                            value={shipping.zip}
                            onChange={handleChange}
                            className={inputClass}
                          />
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Order summary — right side */}
              <div className="lg:col-span-2">
                <div className="bg-[#121215] border border-white/5 rounded-xl p-6 sticky top-28">
                  <h2 className="text-white font-semibold text-sm uppercase tracking-wider mb-6">
                    Order Summary
                  </h2>

                  <div className="space-y-3 mb-6">
                    {items.map((item) => (
                      <div key={item.id} className="flex justify-between text-sm">
                        <span className="text-white/50 truncate mr-2">
                          {item.name}
                          {item.quantity > 1 && ` ×${item.quantity}`}
                        </span>
                        <span className="text-white/70 shrink-0">
                          {formatPrice(item.price * item.quantity)}
                        </span>
                      </div>
                    ))}
                  </div>

                  {needsShipping && (
                    <div className="flex justify-between text-sm mb-3">
                      <span className="text-white/50">Shipping</span>
                      <span className="text-[#D42B2B] font-medium">FREE</span>
                    </div>
                  )}

                  <div className="border-t border-white/5 pt-4 mb-6">
                    <div className="flex justify-between">
                      <span className="text-white font-semibold">Total</span>
                      <span className="text-white font-bold text-xl">
                        {formatPrice(totalPrice)}
                      </span>
                    </div>
                  </div>

                  {error && (
                    <div className="bg-[#D42B2B]/10 border border-[#D42B2B]/30 rounded-lg px-4 py-3 mb-4 text-[#FF4444] text-xs">
                      {error}
                    </div>
                  )}

                  <button
                    onClick={handleCheckout}
                    disabled={loading}
                    className="w-full bg-[#D42B2B] text-white font-semibold py-4 rounded-xl text-sm uppercase tracking-wider hover:bg-[#A51C1C] hover:shadow-[0_0_30px_rgba(212,43,43,0.3)] transition-all duration-300 cursor-pointer disabled:opacity-50"
                  >
                    {loading ? "Processing..." : "Proceed to Payment"}
                  </button>

                  <p className="text-white/20 text-xs text-center mt-4">
                    Secure checkout powered by Stripe
                  </p>

                  <div className="mt-4 text-center">
                    <a href="/marketplace" className="text-[#D42B2B] text-xs hover:underline">
                      + Add more skills
                    </a>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      <Footer />
    </main>
  );
}

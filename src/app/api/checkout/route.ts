import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

function getStripe() {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error("STRIPE_SECRET_KEY not configured");
  }
  return new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: "2024-12-18.acacia",
  });
}

interface CartItemInput {
  id: string;
  name: string;
  price: number;
  type: string;
  quantity: number;
}

interface ShippingInput {
  name: string;
  email: string;
  phone: string;
  line1: string;
  line2: string;
  city: string;
  state: string;
  zip: string;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { tier, items, shipping } = body as {
      tier: string;
      items?: CartItemInput[];
      shipping?: ShippingInput;
    };

    const stripe = getStripe();

    // Full cart checkout
    if (tier === "cart" && Array.isArray(items) && items.length > 0 && shipping) {
      const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = items.map((item) => ({
        price_data: {
          currency: "usd",
          product_data: {
            name: item.name,
            ...(item.type === "phone"
              ? { images: ["https://clawforlife.com/samsung-a16-samsung.jpg"] }
              : item.type === "package"
              ? { images: ["https://clawforlife.com/hero-phone.png"] }
              : {}),
          },
          unit_amount: item.price,
        },
        quantity: item.quantity,
      }));

      const needsShipping = items.some((i) => i.type === "phone" || i.type === "package");

      const skillNames = items
        .filter((i) => i.type === "skill")
        .map((i) => i.name)
        .join(" | ");

      const itemSummary = items.map((i) => `${i.name} x${i.quantity}`).join(", ");

      const sessionParams: Stripe.Checkout.SessionCreateParams = {
        mode: "payment",
        payment_method_types: ["card"],
        customer_creation: "always",
        customer_email: shipping.email,
        line_items: lineItems,
        allow_promotion_codes: true,
        success_url: `${req.nextUrl.origin}/success?session_id={CHECKOUT_SESSION_ID}&type=cart`,
        cancel_url: `${req.nextUrl.origin}/cart`,
        metadata: {
          tier: "cart",
          items: itemSummary.slice(0, 500),
          skills: skillNames.slice(0, 500),
          customer_name: shipping.name,
          customer_phone: shipping.phone,
        },
      };

      // Pre-fill shipping if physical product
      if (needsShipping) {
        sessionParams.shipping_options = [
          {
            shipping_rate_data: {
              type: "fixed_amount",
              fixed_amount: { amount: 0, currency: "usd" },
              display_name: "Free Shipping",
              delivery_estimate: {
                minimum: { unit: "business_day", value: 2 },
                maximum: { unit: "business_day", value: 5 },
              },
            },
          },
        ];
        // Pass shipping address to Stripe
        sessionParams.payment_intent_data = {
          shipping: {
            name: shipping.name,
            phone: shipping.phone,
            address: {
              line1: shipping.line1,
              line2: shipping.line2 || undefined,
              city: shipping.city,
              state: shipping.state,
              postal_code: shipping.zip,
              country: "US",
            },
          },
        };
      }

      const session = await stripe.checkout.sessions.create(sessionParams);
      return NextResponse.json({ url: session.url });
    }

    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  } catch (err) {
    console.error("Checkout error:", err);
    const message = err instanceof Error ? err.message : "Checkout failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

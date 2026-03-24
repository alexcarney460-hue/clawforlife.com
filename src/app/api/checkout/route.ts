import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

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
    if (!process.env.STRIPE_SECRET_KEY) {
      return NextResponse.json({ error: "Stripe not configured" }, { status: 500 });
    }

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: "2023-10-16",
    });

    const body = await req.json();
    const { tier, items, shipping } = body as {
      tier: string;
      items?: CartItemInput[];
      shipping?: ShippingInput;
    };

    if (tier !== "cart" || !Array.isArray(items) || items.length === 0 || !shipping) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    const lineItems = items.map((item) => ({
      price_data: {
        currency: "usd" as const,
        product_data: {
          name: item.name,
        },
        unit_amount: item.price,
      },
      quantity: item.quantity,
    }));

    const needsShipping = items.some((i) => i.type === "phone" || i.type === "package");
    const skillNames = items.filter((i) => i.type === "skill").map((i) => i.name).join(" | ");
    const itemSummary = items.map((i) => `${i.name} x${i.quantity}`).join(", ");

    const params: Record<string, unknown> = {
      mode: "payment",
      line_items: lineItems,
      customer_email: shipping.email,
      allow_promotion_codes: true,
      success_url: `${req.nextUrl.origin}/success?session_id={CHECKOUT_SESSION_ID}&type=cart`,
      cancel_url: `${req.nextUrl.origin}/cart`,
      metadata: {
        tier: "cart",
        items: itemSummary.slice(0, 500),
        skills: skillNames.slice(0, 500),
        customer_name: shipping.name,
        customer_phone: shipping.phone,
        shipping_address: needsShipping
          ? `${shipping.line1}, ${shipping.city}, ${shipping.state} ${shipping.zip}`
          : "",
      },
    };

    if (needsShipping) {
      params.shipping_address_collection = {
        allowed_countries: ["US"],
      };
    }

    // @ts-expect-error stripe v14 typing
    const session = await stripe.checkout.sessions.create(params);
    return NextResponse.json({ url: session.url });
  } catch (err: unknown) {
    console.error("Checkout error:", err);
    const message = err instanceof Error ? err.message : "Checkout failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

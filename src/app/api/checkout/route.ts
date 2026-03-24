import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

function getStripe() {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error("STRIPE_SECRET_KEY not configured");
  }
  return new Stripe(process.env.STRIPE_SECRET_KEY);
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

    if (tier !== "cart" || !Array.isArray(items) || items.length === 0 || !shipping) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = items.map((item) => ({
      price_data: {
        currency: "usd",
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

    const sessionConfig: Stripe.Checkout.SessionCreateParams = {
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
        shipping_line1: shipping.line1,
        shipping_line2: shipping.line2 || "",
        shipping_city: shipping.city,
        shipping_state: shipping.state,
        shipping_zip: shipping.zip,
      },
    };

    if (needsShipping) {
      sessionConfig.shipping_address_collection = {
        allowed_countries: ["US"],
      };
    }

    const session = await stripe.checkout.sessions.create(sessionConfig);
    return NextResponse.json({ url: session.url });
  } catch (err: unknown) {
    console.error("Checkout error:", err);
    const message = err instanceof Error ? err.message : "Checkout failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

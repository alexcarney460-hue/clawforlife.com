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

const PRODUCTS: Record<string, { name: string; price: number; description: string }> = {
  phone: {
    name: "OpenClaw Phone — Samsung Galaxy A16 5G",
    price: 22500, // cents
    description: "Samsung Galaxy A16 5G with OpenClaw pre-installed",
  },
  package: {
    name: "OpenClaw Full Agent Package",
    price: 129900,
    description:
      "Samsung Galaxy A16 5G + complete CRM, lead gen, content pipeline, SMS outreach, and 1-on-1 onboarding",
  },
};

export async function POST(req: NextRequest) {
  try {
    const { tier } = await req.json();
    const product = PRODUCTS[tier];

    if (!product) {
      return NextResponse.json({ error: "Invalid product" }, { status: 400 });
    }

    const stripe = getStripe();
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: product.name,
              description: product.description,
            },
            unit_amount: product.price,
          },
          quantity: 1,
        },
      ],
      shipping_address_collection: {
        allowed_countries: ["US"],
      },
      success_url: `${req.nextUrl.origin}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${req.nextUrl.origin}/#pricing`,
      metadata: { tier },
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("Checkout error:", err);
    return NextResponse.json({ error: "Checkout failed" }, { status: 500 });
  }
}

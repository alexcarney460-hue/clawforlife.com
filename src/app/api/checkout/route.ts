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

const PRODUCTS: Record<
  string,
  { name: string; price: number; description: string; image?: string }
> = {
  phone: {
    name: "OpenClaw Phone — Samsung Galaxy A16 5G",
    price: 22500,
    description:
      "Brand new Samsung Galaxy A16 5G (Unlocked) with OpenClaw terminal pre-installed. Base agent runtime ready.",
    image: "https://clawforlife.com/samsung-a16-samsung.jpg",
  },
  package: {
    name: "OpenClaw Full Agent Package",
    price: 129900,
    description:
      "Samsung Galaxy A16 5G + 5 marketplace skills of your choice, configured & tested. Includes 90-min onboarding + 30 days priority support.",
    image: "https://clawforlife.com/hero-phone.png",
  },
};

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { tier, skills } = body;

    const stripe = getStripe();

    // Skills a la carte purchase
    if (tier === "skills" && Array.isArray(skills) && skills.length > 0) {
      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        payment_method_types: ["card"],
        customer_creation: "always",
        line_items: skills.map((skillName: string) => ({
          price_data: {
            currency: "usd",
            product_data: {
              name: `OpenClaw Skill: ${skillName}`,
              description: `Agent skill — pre-configured and installed on your OpenClaw device`,
            },
            unit_amount: 4900,
          },
          quantity: 1,
        })),
        phone_number_collection: { enabled: true },
        success_url: `${req.nextUrl.origin}/success?session_id={CHECKOUT_SESSION_ID}&type=skills`,
        cancel_url: `${req.nextUrl.origin}/marketplace`,
        metadata: {
          tier: "skills",
          skill_count: String(skills.length),
          skills: skills.join(" | "),
        },
      });
      return NextResponse.json({ url: session.url });
    }

    // Standard product purchase
    const product = PRODUCTS[tier];
    if (!product) {
      return NextResponse.json({ error: "Invalid product" }, { status: 400 });
    }

    const lineItem: Stripe.Checkout.SessionCreateParams.LineItem = {
      price_data: {
        currency: "usd",
        product_data: {
          name: product.name,
          description: product.description,
          ...(product.image ? { images: [product.image] } : {}),
        },
        unit_amount: product.price,
      },
      quantity: 1,
    };

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      customer_creation: "always",
      line_items: [lineItem],
      shipping_address_collection: {
        allowed_countries: ["US"],
      },
      phone_number_collection: { enabled: true },
      allow_promotion_codes: true,
      success_url: `${req.nextUrl.origin}/success?session_id={CHECKOUT_SESSION_ID}&type=${tier}`,
      cancel_url: `${req.nextUrl.origin}/#pricing`,
      metadata: { tier },
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("Checkout error:", err);
    return NextResponse.json({ error: "Checkout failed" }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

function getStripe() {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error("STRIPE_SECRET_KEY not configured");
  }
  return new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: "2023-10-16",
  });
}

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

async function sendTelegram(message: string) {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    console.log("[TELEGRAM] Not configured, skipping notification");
    return;
  }

  try {
    await fetch(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: TELEGRAM_CHAT_ID,
          text: message,
          parse_mode: "HTML",
        }),
      }
    );
  } catch (err) {
    console.error("[TELEGRAM] Failed to send:", err);
  }
}

function formatMoney(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig = req.headers.get("stripe-signature");

  if (!sig || !process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Missing signature or webhook secret" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    const stripe = getStripe();
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const tier = session.metadata?.tier || "unknown";
      const email = session.customer_details?.email || "no email";
      const name = session.customer_details?.name || "Unknown";
      const phone = session.customer_details?.phone || "no phone";
      const amount = formatMoney(session.amount_total || 0);
      const shipping = session.shipping_details;

      let orderDetails = "";
      if (tier === "skills") {
        const skillList = session.metadata?.skills || "none";
        const count = session.metadata?.skill_count || "0";
        orderDetails = `🔧 <b>${count} Skills:</b> ${skillList}`;
      } else if (tier === "package") {
        orderDetails = "📦 <b>Full Agent Package</b> — Phone + 5 Skills + Onboarding";
      } else if (tier === "phone") {
        orderDetails = "📱 <b>The Phone</b> — Samsung Galaxy A16 5G + OpenClaw";
      }

      let shippingInfo = "";
      if (shipping?.address) {
        const addr = shipping.address;
        shippingInfo = `\n\n🚚 <b>Ship to:</b>\n${shipping.name}\n${addr.line1}${
          addr.line2 ? "\n" + addr.line2 : ""
        }\n${addr.city}, ${addr.state} ${addr.postal_code}`;
      }

      const message =
        `🔴 <b>NEW ORDER — ClawForLife.com</b>\n\n` +
        `${orderDetails}\n\n` +
        `💰 <b>Amount:</b> ${amount}\n` +
        `👤 <b>Customer:</b> ${name}\n` +
        `📧 <b>Email:</b> ${email}\n` +
        `📞 <b>Phone:</b> ${phone}` +
        `${shippingInfo}\n\n` +
        `🆔 <b>Session:</b> <code>${session.id}</code>`;

      console.log(`[ORDER] ${tier} — ${email} — ${amount} — ${session.id}`);
      await sendTelegram(message);
      break;
    }

    case "payment_intent.payment_failed": {
      const intent = event.data.object as Stripe.PaymentIntent;
      const failMessage =
        `⚠️ <b>PAYMENT FAILED — ClawForLife.com</b>\n\n` +
        `💰 Amount: ${formatMoney(intent.amount)}\n` +
        `❌ Reason: ${intent.last_payment_error?.message || "Unknown"}\n` +
        `🆔 <code>${intent.id}</code>`;

      console.log(`[PAYMENT FAILED] ${intent.id}`);
      await sendTelegram(failMessage);
      break;
    }

    default:
      console.log(`[STRIPE] Unhandled event: ${event.type}`);
  }

  return NextResponse.json({ received: true });
}

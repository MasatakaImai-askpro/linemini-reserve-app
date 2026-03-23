import type { Express } from "express";
import express from "express";
import { storage } from "./storage";
import { getUncachableStripeClient, getStripePublishableKey } from "./stripeClient";
import { WebhookHandlers } from "./webhookHandlers";

export async function registerStripeRoutes(app: Express): Promise<void> {

  // Stripe Connect: publishable key
  app.get("/api/stripe/config", async (_req, res) => {
    try {
      const publishableKey = await getStripePublishableKey();
      res.json({ publishableKey });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Stripe Connect: create/get connected account & onboarding link
  app.post("/api/stripe/connect/onboard/:shopId", async (req, res) => {
    try {
      const shopId = parseInt(req.params.shopId);
      const shop = await storage.getShopById(shopId);
      if (!shop) return res.status(404).json({ error: "Shop not found" });

      const stripe = await getUncachableStripeClient();
      const origin = `${req.protocol}://${req.get("host")}`;

      let accountId = shop.stripeConnectId;

      if (!accountId) {
        const account = await (stripe as any).accounts.create({
          type: "express",
          country: "JP",
          capabilities: { card_payments: { requested: true }, transfers: { requested: true } },
          business_profile: { name: shop.name },
          metadata: { shopId: String(shopId) },
        });
        accountId = account.id;
        await storage.updateShop(shopId, {
          stripeConnectId: accountId,
          stripeConnectStatus: "pending",
        });
      }

      const accountLink = await (stripe as any).accountLinks.create({
        account: accountId,
        refresh_url: `${origin}/admin`,
        return_url: `${origin}/admin?stripe_connect=success&shopId=${shopId}`,
        type: "account_onboarding",
      });

      res.json({ url: accountLink.url });
    } catch (e: any) {
      console.error("Stripe Connect onboard error:", e);
      res.status(500).json({ error: e.message });
    }
  });

  // Stripe Connect: get account status
  app.get("/api/stripe/connect/status/:shopId", async (req, res) => {
    try {
      const shopId = parseInt(req.params.shopId);
      const shop = await storage.getShopById(shopId);
      if (!shop) return res.status(404).json({ error: "Shop not found" });

      if (!shop.stripeConnectId) {
        return res.json({ status: "none", connected: false });
      }

      const stripe = await getUncachableStripeClient();
      const account = await (stripe as any).accounts.retrieve(shop.stripeConnectId);
      const connected = account.details_submitted && account.charges_enabled;
      const status = connected ? "active" : "pending";

      if (shop.stripeConnectStatus !== status) {
        await storage.updateShop(shopId, { stripeConnectStatus: status });
      }

      res.json({
        status,
        connected,
        accountId: shop.stripeConnectId,
        chargesEnabled: account.charges_enabled,
        detailsSubmitted: account.details_submitted,
      });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Stripe Connect: create express dashboard login link
  app.post("/api/stripe/connect/dashboard/:shopId", async (req, res) => {
    try {
      const shopId = parseInt(req.params.shopId);
      const shop = await storage.getShopById(shopId);
      if (!shop?.stripeConnectId) return res.status(404).json({ error: "Not connected" });

      const stripe = await getUncachableStripeClient();
      const loginLink = await (stripe as any).accounts.createLoginLink(shop.stripeConnectId);
      res.json({ url: loginLink.url });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Stripe Connect: create payment intent for reservation
  app.post("/api/stripe/connect/payment-intent", async (req, res) => {
    try {
      const { shopId, amount, currency = "jpy", description } = req.body;
      const shop = await storage.getShopById(parseInt(shopId));
      if (!shop?.stripeConnectId) {
        return res.status(400).json({ error: "Shop not connected to Stripe" });
      }

      const stripe = await getUncachableStripeClient();
      const platformFee = Math.floor(amount * 0.05);

      const paymentIntent = await (stripe as any).paymentIntents.create({
        amount,
        currency,
        description,
        application_fee_amount: platformFee,
        transfer_data: { destination: shop.stripeConnectId },
      });

      res.json({ clientSecret: paymentIntent.client_secret });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Stripe webhook
  app.post(
    "/api/stripe/webhook",
    express.raw({ type: "application/json" }),
    async (req, res) => {
      const signature = req.headers["stripe-signature"];
      if (!signature) return res.status(400).json({ error: "Missing signature" });
      try {
        const sig = Array.isArray(signature) ? signature[0] : signature;
        await WebhookHandlers.processWebhook(req.body as Buffer, sig);
        res.status(200).json({ received: true });
      } catch (e: any) {
        console.error("Webhook error:", e.message);
        res.status(400).json({ error: "Webhook error" });
      }
    }
  );
}
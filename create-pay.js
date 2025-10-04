import express from "express";
import fetch from "node-fetch";

const app = express();
app.use(express.json());

app.post("/api/create-pay", async (req, res) => {
  try {
    const { amount, method } = req.body;

    if (!amount || !method) {
      return res.status(400).json({ error: "المبلغ وطريقة الدفع مطلوبان" });
    }

    // القيم دي هتحطها في Environment Variables في Render أو Vercel
    const PAYMOB_API_KEY = process.env.PAYMOB_API_KEY;
    const INTEGRATION_ID_CARD = process.env.PAYMOB_INTEGRATION_ID_CARD;
    const INTEGRATION_ID_WALLET = process.env.PAYMOB_INTEGRATION_ID_WALLET;
    const INTEGRATION_ID_KIOSK = process.env.PAYMOB_INTEGRATION_ID_KIOSK;
    const IFRAME_ID = process.env.PAYMOB_IFRAME_ID;

    // 1️⃣ Auth token
    const authResp = await fetch("https://accept.paymob.com/api/auth/tokens", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ api_key: PAYMOB_API_KEY }),
    });
    const authData = await authResp.json();
    if (!authData.token) throw new Error("Auth with Paymob failed");

    // 2️⃣ Create order
    const orderResp = await fetch("https://accept.paymob.com/api/ecommerce/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        auth_token: authData.token,
        delivery_needed: false,
        amount_cents: `${amount * 100}`,
        currency: "EGP",
        items: [],
      }),
    });
    const orderData = await orderResp.json();

    // 3️⃣ Payment key
    const integrationId =
      method === "card"
        ? INTEGRATION_ID_CARD
        : method === "wallet"
        ? INTEGRATION_ID_WALLET
        : INTEGRATION_ID_KIOSK;

    const payKeyResp = await fetch(
      "https://accept.paymob.com/api/acceptance/payment_keys",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          auth_token: authData.token,
          amount_cents: `${amount * 100}`,
          expiration: 3600,
          order_id: orderData.id,
          billing_data: {
            apartment: "NA",
            email: "test@example.com",
            floor: "NA",
            first_name: "Client",
            street: "NA",
            building: "NA",
            phone_number: "+201000000000",
            shipping_method: "NA",
            postal_code: "NA",
            city: "Cairo",
            country: "EG",
            last_name: "User",
            state: "NA",
          },
          currency: "EGP",
          integration_id: integrationId,
        }),
      }
    );
    const payKeyData = await payKeyResp.json();

    if (!payKeyData.token)
      throw new Error("Payment key creation failed: " + JSON.stringify(payKeyData));

    // 4️⃣ ارجاع الرابط المناسب
    let payment_url = "";

    if (method === "card") {
      payment_url = `https://accept.paymob.com/api/acceptance/iframes/${IFRAME_ID}?payment_token=${payKeyData.token}`;
    } else if (method === "wallet") {
      payment_url = `https://accept.paymob.com/api/acceptance/payments/pay?payment_token=${payKeyData.token}`;
    } else if (method === "kiosk") {
      payment_url = `https://accept.paymob.com/api/acceptance/payments/pay?payment_token=${payKeyData.token}`;
    }

    res.json({ payment_url });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.listen(3000, () => console.log("Server running on port 3000"));

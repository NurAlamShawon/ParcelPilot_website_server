require("dotenv").config();
const express = require("express");
const cors = require("cors");
const app = express();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const port = process.env.PORT || 3000;

app.use(express.json());
app.use(cors());

const uri = `mongodb+srv://${process.env.DB_USERNAME}:${process.env.DB_PASSWORD}@cluster0.tbuverl.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;
// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

//for access token

var admin = require("firebase-admin");

const decoded = Buffer.from(process.env.FIRE_SERVICE_KEY, "base64").toString(
  "utf8"
);
var serviceAccount = JSON.parse(decoded);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

// // middleware for verify token

const verifyFirebaseToken = async (req, res, next) => {
  const authHeader = req.headers?.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).send({ message: "unauthorized access" });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decode = await admin.auth().verifyIdToken(token);
    req.decoded = decode;
    next();
  } catch (err) {
    return res.status(403).send({ message: "unauthorized" });
  }
};

// //middleware for verify email

const verifyEmail = (req, res, next) => {
  if (req.query.email !== req.decoded.email) {
    console.log("decoded", req.decoded);
    return res.status(403).send({ message: "unauthorized access" });
  }
  next();
};

//for payment
const stripe = require("stripe")(process.env.PAYMENT_KEY, {
  apiVersion: "2025-05-28.basil",
});

app.use(express.static("public"));

//post payment

app.post("/create-payment-intent", async (req, res) => {
  const amountInCent = req.body.amountInCent;

  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountInCent, // Amount in cents
      currency: "usd",
      payment_method_types: ["card"],
      // Optional: Add metadata or a customer ID
      // metadata: {order_id: '6735'}
    });

    res.send({ clientSecret: paymentIntent.client_secret });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();
    // await client.db("admin").command({ ping: 1 });
    // console.log(
    //   "Pinged your deployment. You successfully connected to MongoDB!"
    // );

    const database = client.db("ParcelPilot");
    const parcelcollection = database.collection("parcels");
    // get parcel

    app.get("/parcels", verifyFirebaseToken, verifyEmail, async (req, res) => {
      const email = req.query.category;
      console.log(req.headers);
      const query = {};
      if (email) {
        query.email = email;
      }
      try {
        const result = await parcelcollection
          .find(query)
          .sort({ creation_date: -1 }) // Sort by date descending
          .toArray();

        res.send(result);
      } catch (error) {
        console.error("Error fetching sorted parcels:", error);
        res.status(500).send({ message: "Internal server error" });
      }
    });

    app.get(
      "/parcels/:id",
      verifyFirebaseToken,
      verifyEmail,
      async (req, res) => {
        const id = req.params.id;
        const query = { _id: new ObjectId(id) };
        const result = await parcelcollection.findOne(query);
        res.send(result);
      }
    );

    // post parcel
    app.post("/parcels", async (req, res) => {
      console.log("data posted", req.body);
      const parcel = req.body;
      const result = await parcelcollection.insertOne(parcel);
      res.send(result);
    });

    //parcel delete
    app.delete("/parcels/:id", async (req, res) => {
      const id = req.params.id;

      const query = { _id: new ObjectId(id) };
      const result = await parcelcollection.deleteOne(query);

      res.send(result);
    });

    // Payment

    const paymentcollection = database.collection("payments");

    //payment data get

    app.get("/payments", verifyFirebaseToken, verifyEmail, async (req, res) => {
      const email = req.query.email;
      const query = {};
      if (email) {
        query.email = email;
      }

      try {
        const payments = await paymentcollection
          .find(query)
          .sort({ paidAt: -1 }) // descending order (latest first)
          .toArray();

        res.send(payments);
      } catch (error) {
        console.error("Error fetching payments:", error);
        res.status(500).send({ error: "Failed to fetch payment records" });
      }
    });

    //get payment by Id

    app.get(
      "/payments/:id",
      verifyFirebaseToken,
      verifyEmail,
      async (req, res) => {
        const id = req.params.id;
        const query = { _id: new ObjectId(id) };
        const result = await paymentcollection.findOne(query);
        res.send(result);
      }
    );

    //post payment info

    app.post("/payments", async (req, res) => {
      const {
        amount,
        currency,
        tracking_id,
        _id, // parcel id
        email,
        transactionId,
        paymentMethod,
        paidAt,
      } = req.body;

      try {
        // 1. Save payment info
        const paymentDoc = {
          amount,
          currency,
          tracking_id,
          parcel_id: _id,
          email,
          transactionId,
          paymentMethod,
          paidAt: new Date(paidAt),
        };

        const insertResult = await paymentcollection.insertOne(paymentDoc);

        // 2. Update parcel to "paid"
        const updateResult = await parcelcollection.updateOne(
          { _id: new ObjectId(String(_id)) },
          {
            $set: {
              payment_status: "paid",
            },
          }
        );

        res.send({
          message: "Payment recorded and parcel updated",
          paymentId: insertResult.insertedId,
          updated: updateResult.modifiedCount > 0,
        });
      } catch (error) {
        console.error("Payment error:", error);
        res.status(500).send({ error: "Failed to store payment info" });
      }
    });

    //For track parcel
    const trackingcollection = database.collection("trackings");

    // post tracking
    app.post("/trackings", async (req, res) => {
      const { tracking_id, status, location, updated_by } = req.body;

      const newTracking = {
        tracking_id,
        status,
        location,
        updated_by,
        timestamp: new Date().toISOString(),
      };

      const result = await trackingcollection.insertOne(newTracking);
      res.send(result);
    });

    //get tracking sorted
    app.get("/trackings/:tracking_id", async (req, res) => {
      const tracking_id = req.params.tracking_id;

      const updates = await trackingcollection
        .find({ tracking_id })
        .sort({ timestamp: 1 }) // ascending = oldest to latest
        .toArray();

      res.send(updates);
    });

    const userscollection = database.collection("users");

    //post user

    app.post("/users", async (req, res) => {
      const { name, email, role, created_At, last_log_in } = req.body;

      if (!email || !name) {
        return res.status(400).send({ error: "Missing name or email" });
      }

      try {
        const existingUser = await userscollection.findOne({ email });

        if (existingUser) {
          return res.status(200).send(existingUser); // already exists
        }

        const newUser = {
          name,
          email,
          role: role || "user", // fallback to 'user'
          created_At: created_At || new Date().toISOString(),
          last_log_in: last_log_in || new Date().toISOString(),
        };

        await userscollection.insertOne(newUser);
        res.status(201).send(newUser);
      } catch (err) {
        console.error("User save failed:", err);
        res.status(500).send({ error: "Internal server error" });
      }
    });

    //Rider servers

    const ridercollection = database.collection("riders");

    //post rider
    app.post("/riders", async (req, res) => {
      const rider = req.body;
      const result = await ridercollection.insertOne(rider);
      res.send(result);
    });
    //pending rider info get

    app.get("/riders/pending", async (req, res) => {
      const pendingRiders = await ridercollection
        .find({ status: "pending" })
        .toArray();
      res.send(pendingRiders);
    });

    //get active rider
    app.get("/riders/active", async (req, res) => {
      const activeRiders = await ridercollection
        .find({ status: "active" })
        .toArray();
      res.send(activeRiders);
    });
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

// pass- VkVrFgAZxtEsA5I9  simpleDbUser

app.get("/", (req, res) => {
  res.send("parcelpilot server is running100");
});

app.listen(port, () => {
  console.log(`running server in ${port} port`);
});

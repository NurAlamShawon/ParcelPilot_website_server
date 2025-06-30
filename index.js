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

//for access token

// var admin = require("firebase-admin");

// const decoded = Buffer.from(process.env.FIRE_SERVICE_KEY, "base64").toString(
//   "utf8"
// );
// var serviceAccount = JSON.parse(decoded);

// admin.initializeApp({
//   credential: admin.credential.cert(serviceAccount),
// });

//middleware for verify token

// const verifyFirebaseToken = async (req, res, next) => {
//   const authHeader = req.headers?.authorization;
//   if (!authHeader || !authHeader.startsWith("Bearer ")) {
//     return res.status(401).send({ message: "unauthorized access" });
//   }

//   const token = authHeader.split(" ")[1];

//   try {
//     const decode = await admin.auth().verifyIdToken(token);
//     req.decoded = decode;
//     next();
//   } catch (err) {
//     return res.status(403).send({ message: "unauthorized" });
//   }
// };

// //middleware for verify email

// const verifyEmail = (req, res, next) => {
//   if (req.query.email !== req.decoded.email) {
//     console.log("decoded", req.decoded);
//     return res.status(403).send({ message: "unauthorized access" });
//   }
//   next();
// };

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();
    // await client.db("admin").command({ ping: 1 });
    // console.log(
    //   "Pinged your deployment. You successfully connected to MongoDB!"
    // );

    /*books*/

    const database = client.db("ParcelPilot");
    const parcelcollection = database.collection("parcels");
    // get parcel

    app.get("/parcels", async (req, res) => {
      const email = req.query.category;
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

    app.get("/parcels/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await parcelcollection.findOne(query);
      res.send(result);
    });

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

    app.get("/payments", async (req, res) => {
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

    app.get("/payments/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await paymentcollection.findOne(query);
      res.send(result);
    });

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

    // //update book

    // app.put("/books/:id", async (req, res) => {
    //   const id = req.params.id;
    //   const filter = { _id: new ObjectId(id) };
    //   const book = req.body;
    //   const update = {
    //     $set: {
    //       image: book.image,
    //       name: book.name,
    //       author: book.author,
    //       category: book.category,
    //       rating: book.rating,
    //     },
    //   };

    //   const option = { upset: true };
    //   const result = await bookcollection.updateOne(filter, update, option);
    //   res.send(result);
    // });

    // /*Borrow*/

    // const borrowcollection = database.collection("borrow");

    // app.get("/borrow", verifyFirebaseToken, verifyEmail, async (req, res) => {
    //   const email = req.query.email;
    //   const query = {};
    //   if (email) {
    //     query.email = email;
    //   }
    //   const cursor = borrowcollection.find(query);
    //   const result = await cursor.toArray();
    //   res.send(result);
    // });

    // app.post("/borrow", async (req, res) => {
    //   //update quantity of book
    //   const id = String(req.body._id);
    //   const filter = { _id: new ObjectId(id) };
    //   const book = await bookcollection.findOne(filter);
    //   const count = book.quantity - 1;
    //   const update = {
    //     $set: {
    //       quantity: count,
    //     },
    //   };

    //   const option = { upset: true };
    //   const result2 = await bookcollection.updateOne(filter, update, option);

    //   //post to borrow database

    //   const newborrow = req.body;
    //   const result = await borrowcollection.insertOne(newborrow);

    //   res.send(result, result2);
    // });

    // Send a ping to confirm a successful connection
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

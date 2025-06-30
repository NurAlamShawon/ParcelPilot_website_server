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
      const newbook = req.body;
      const result = await parcelcollection.insertOne(newbook);
      res.send(result);
    });

    //parcel delete
    app.delete("/parcels/:id", async (req, res) => {
      const id = req.params.id;

      const query = { _id: new ObjectId(id) };
      const result = await parcelcollection.deleteOne(query);

      res.send(result);
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

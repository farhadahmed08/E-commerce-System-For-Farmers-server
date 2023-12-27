const express = require("express");
const app = express();
const cors = require("cors");
const jwt = require("jsonwebtoken");
require("dotenv").config();


const port = process.env.PORT || 5000;
const { MongoClient, ObjectId } = require("mongodb");


// middleware
app.use(cors());
app.use(express.json());


const uri = "mongodb://0.0.0.0:27017/";
const client = new MongoClient(uri);

async function run() {
    try {
      // Connect the client to the server	(optional starting in v4.7)
      await client.connect();

      //database collection
      const userCollection = client.db("organicDb").collection("users");
      const productCollection = client.db("organicDb").collection("products");
      const reviewCollection = client.db("organicDb").collection("reviews");
      const cartCollection = client.db("organicDb").collection("carts");
      const paymentCollection = client.db("organicDb").collection("payments");


       //jwt related api
    app.post("/jwt", async (req, res) => {
        const user = req.body;
        const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
          expiresIn: "1h",
        });
        // console.log(token)
        // res.send({token:token})
        res.send({ token }); //short hand
      });



       //middleware
    const verifyToken = (req, res, next) => {
        console.log("inside verify token", req.headers.authorization);
        if (!req.headers.authorization) {
          return res.status(401).send({ message: "unauthorized access" });
        }
        const token = req.headers.authorization.split(" ")[1];
        jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
          if (err) {
            return res.status(401).send({ message: "unauthorized access" });
          }
          req.decoded = decoded;
          next();
        });
      };


      //user related api
    app.get("/users", verifyToken, async (req, res) => {
        const result = await userCollection.find().toArray();
        res.send(result);
      });


      app.post("/users", async (req, res) => {
        const user = req.body;
        // insert email if user dosent exist
        // you can do this many ways (1.email unique, 2.upsert 3.simple checking)
        const query = { email: user.email };
        // console.log(query)
        const existingUser = await userCollection.findOne(query);
        if (existingUser) {
          return res.send({ message: "user already exists", insertedId: null });
        }
  
        const result = await userCollection.insertOne(user);
        res.send(result);
      });


      // Get user role
    // app.get('/users/:email', async (req, res) => {
    //     const email = req.params.email
    //     const result = await userCollection.findOne({ email })
    //     res.send(result)
    //   })





        //product related apis
    app.get("/product", async (req, res) => {
        const result = await productCollection.find().toArray();
        res.send(result);
      });

      app.get("/product/:id", async (req, res) => {
        const id = req.params.id;
        const query = { _id:new ObjectId (id) };
        const result = await productCollection.findOne(query);
        res.send(result);
      });


      app.post("/product", verifyToken, async (req, res) => {
        const item = req.body;
        console.log(item);
        const result = await productCollection.insertOne(item);
        res.send(result);
      }); 

       //carts
    app.get("/carts", async (req, res) => {
        const email = req.query.email;
        const query = { email: email };
        const result = await cartCollection.find(query).toArray();
        res.send(result);
      });

      //carts collection
    app.post("/carts", async (req, res) => {
        const cartItem = req.body;
        const result = await cartCollection.insertOne(cartItem);
        res.send(result);
      });

      app.delete("/carts/:id", async (req, res) => {
        const id = req.params.id;
        const query = { _id: new ObjectId(id) };
        const result = await cartCollection.deleteOne(query);
        res.send(result);
      }); 




      // Send a ping to confirm a successful connection
      await client.db("admin").command({ ping: 1 });
      console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
      // Ensures that the client will close when you finish/error
    //   await client.close();
    }
  }
  run().catch(console.dir);

  app.get("/", (req, res) => {
    res.send("E-commerce server is running");
  });
  
  app.listen(port, () => {
    console.log(`E-commerce server is sitting on port ${port}`);
  });
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
      const userCollection = client.db("bistroDb").collection("users");


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




      // Send a ping to confirm a successful connection
      await client.db("admin").command({ ping: 1 });
      console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
      // Ensures that the client will close when you finish/error
      await client.close();
    }
  }
  run().catch(console.dir);

  app.get("/", (req, res) => {
    res.send("E-commerce server is running");
  });
  
  app.listen(port, () => {
    console.log(`E-commerce server is sitting on port ${port}`);
  });
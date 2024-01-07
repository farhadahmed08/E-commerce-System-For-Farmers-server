const express = require("express");
const app = express();
const cors = require("cors");
const jwt = require("jsonwebtoken");
require("dotenv").config();
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const formData = require("form-data");
const Mailgun = require("mailgun.js");
const mailgun = new Mailgun(formData);


const port = process.env.PORT || 5000;
const { MongoClient, ObjectId } = require("mongodb");


// middleware
app.use(cors());
app.use(express.json());
const mg = mailgun.client({
  username: "api",
  key: process.env.MAIL_GUN_API_KEY,
});


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


      //use verify admin after verifyToken

    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email }; 
      const user = await userCollection.findOne(query);
      const isAdmin = user?.role === "admin";
      if (!isAdmin) {
        return res.status(403).send({ message: "forbidden access" });
      }
      next();
    };


      //user related api
    app.get("/users", verifyToken,verifyAdmin, async (req, res) => {
        const result = await userCollection.find().toArray();
        res.send(result);
      });


      app.get("/users/admin/:email", verifyToken, async (req, res) => {
        const email = req.params.email;
        if (email !== req.decoded?.email) {
          return res.status(403).send({ message: "forbidden access" });
        }
  
        const query = { email: email };
        const user = await userCollection.findOne(query);
        let admin = false;
        if (user) {
          admin = user?.role === "admin";
        }
        res.send({ admin });
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

      
      app.patch(
        "/users/admin/:id",
        verifyToken,
        verifyAdmin,
        async (req, res) => {
          const id = req.params.id;
          const filter = { _id: new ObjectId(id) };
          const updatedDoc = {
            $set: {
              role: "admin",
            },
          };
          const result = await userCollection.updateOne(filter, updatedDoc);
          res.send(result);
        }
      );

       app.delete("/users/:id", verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;

      const query = { _id: new ObjectId(id) };

      const result = await userCollection.deleteOne(query);
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


      app.post("/product", verifyToken,verifyAdmin, async (req, res) => {
        const item = req.body;
        console.log(item);
        const result = await productCollection.insertOne(item);
        res.send(result);
      }); 


      app.patch("/product/:id", async (req, res) => {
        const item = req.body;
        const id = req.params.id;
        const filter = { _id: new ObjectId (id) };
        const updatedDoc = {
          $set: {
            title: item.title,
            category: item.category,
            price: item.price,
            inventory: item.inventory,
            description: item.description,
            image: item.image,
          },
        };
  
        const result = await productCollection.updateOne(filter, updatedDoc);
        res.send(result);
      });


      app.delete("/product/:id", verifyToken, verifyAdmin, async (req, res) => {
        const id = req.params.id;
        const query = { _id: new ObjectId (id) };
        const result = await productCollection.deleteOne(query);
        res.send(result);
      });

       
      
      
      
      
      //carts
    app.get("/carts", async (req, res) => {
        const email = req.query.email;
        const query = { email: email };
        const result = await cartCollection.find(query).toArray();
        res.send(result);
      });

      
    // app.post("/carts", async (req, res) => {
    //     const cartItem = req.body;
    //     const result = await cartCollection.insertOne(cartItem);
    //     res.send(result);
    //   });


    
      // carts collection
      app.post("/carts", async (req, res) => {
        const cartItem = req.body;
        
        console.log(cartItem);
        const inventoryItem = await productCollection.findOne({ _id: new ObjectId(cartItem.productId) });
        // console.log(inventoryItem.inventory);
        if (!inventoryItem) {
          return res.status(404).json({ error: 'inventoryItem item not found' });
        }

        const availableInventory = inventoryItem.inventory;
        console.log(availableInventory);

        if (cartItem.quantity > availableInventory) {
          return res.status(400).json({ error: 'Quantity exceeds available inventory' });
        }
      
         // Update the inventory in the database
         const Update = await productCollection.updateOne(
          { _id: new ObjectId(cartItem.productId) },
          { $set: { inventory: availableInventory - cartItem.quantity } }
        );
      
        console.log(Update)
        
        
        const result = await cartCollection.insertOne(cartItem);
        res.send(result);
      });











      app.delete("/carts/:id", async (req, res) => {
        const id = req.params.id;
        const query = { _id: new ObjectId(id) };
        const result = await cartCollection.deleteOne(query);
        res.send(result);
      }); 

      //reviews

    app.get("/reviews", async (req, res) => {
      const result = await reviewCollection.find().toArray();
      res.send(result);
    });


    app.post("/reviews", verifyToken, async (req, res) => {
      const item = req.body;
      console.log(item);
      const result = await reviewCollection.insertOne(item);
      res.send(result);
    }); 


      //payment intend
    app.post("/create-payment-intent", async (req, res) => {
      const { price } = req.body;
      const amount = parseInt(price * 100);
      console.log(amount, "amount inside the intent");

      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "usd",
        payment_method_types: ["card"],
      });

      res.send({
        clientSecret: paymentIntent.client_secret,
      });
    });


    app.get("/payments/:email", verifyToken, async (req, res) => {
      const query = { email: req.params.email };
      if (req.params.email !== req.decoded.email) {
        return res.status(403).send({ message: "forbidden access" });
      }
      const result = await paymentCollection.find(query).toArray();
      res.send(result);
    });


    app.post("/payments", async (req, res) => {
      const payment = req.body;
      const paymentResult = await paymentCollection.insertOne(payment);

      //carefully delete each item from the cart

      console.log("payment info", payment);
      const query = {
        _id: {
          $in: payment.cartIds.map((id) => new ObjectId(id)),
        },
      };
      const deleteResult = await cartCollection.deleteMany(query);

      //send user email about payment confirmation
      mg.messages
        .create(process.env.MAIL_SENDING_DOMAIN, {
          from: "Mailgun Sandbox <postmaster@sandbox54984a3ccfc6421d91cf34d0ac6a48b6.mailgun.org>",
          to: ["farhaddhkbd08@gmail.com"],
          subject: "Organic Products Order Confirmed",
          text: "Testing some Mailgun awesomness!",
          html: `<div>
          <h2>Thank you for your order</h2>
          <h4>Your Transaction Id:<strong>${payment.transactionId}</strong></h4>
          <p>Your Product will deliver shortly</p>
          </div>`,
        })
        .then((msg) => console.log(msg)) // logs response data
        .catch((err) => console.log(err)); // logs any error`;

      res.send({ paymentResult, deleteResult });
    });


    
    
    
    //stats or analytics

     app.get("/admin-stats",verifyToken,verifyAdmin, async (req, res) => {
      const users = await userCollection.estimatedDocumentCount();
      const productItems = await productCollection.estimatedDocumentCount();
      const orders = await paymentCollection.estimatedDocumentCount();
      
      // this is not the best way
      // const payments = await paymentCollection.find().toArray();
      // const revenue = payments.reduce((total,payment)=>total+payment.price,0)

      const result = await paymentCollection
        .aggregate([
          {
            $group: {
              _id: null, //mane sobgula id nie korbe
              totalRevenue: {
                $sum: "$price",
              },
            },
          },
        ])
        .toArray();

      const revenue = result.length > 0 ? result[0].totalRevenue : 0;

      res.send({
        users,
        productItems,
        orders,
        revenue,
      });
    });


    // order status

// using aggregate pipeline

app.get("/order-stats",verifyToken,verifyAdmin,  async (req, res) => {
  const result = await paymentCollection
    .aggregate([
      {
        $unwind: "$productIds"
      },
      {
        $lookup: {
            from: "products",
            let: { objectId: { $toObjectId: "$productIds" } },
            pipeline: [
                {
                    $match: {
                        $expr: {
                            $eq: [
                                "$_id",
                                "$$objectId"
                            ]
                        }
                    }
                }
            ],
            as: "productItems"
        }
    },
       // {
      //   $lookup: {
      //     from: "products",
      //     localField: "productIds",
      //     foreignField: "_id",
      //     as: "productItems"
      //   },
      // },
      {
        $unwind: "$productItems",
      },
      {
        $group: {
          _id: "$productItems.category",
          quantity: { $sum: 1 },
          revenue: { $sum: "$productItems.price" },
        },
      },
      {
        $project: {
          _id: 0,
          category: "$_id",
          quantity: "$quantity",
          revenue: "$revenue",
        },
      },
    ])
    .toArray();

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
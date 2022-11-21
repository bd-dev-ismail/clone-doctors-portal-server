const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const jwt = require('jsonwebtoken');
const port = process.env.PORT || 5000;
require('dotenv').config();
const app = express();
//midlewares
app.use(cors());
app.use(express.json());


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.nbna82s.mongodb.net/?retryWrites=true&w=majority`;

const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverApi: ServerApiVersion.v1,
});

// function verfiyJWT(req, res, next){
//   const authHeader = req.headers.authorization;
//   if(!authHeader){
//     return res.status(401).send({message: 'Unauthorized Access!'})
//   }
//   const token = authHeader.split(' ')[1]
//   jwt.verify(token, process.env.ACCESS_TOKEN, function(err , decoded){
//     if(err){
//       return res.status(403).send({message: 'Forbidden Access'})
//     }
//     req.decoded = decoded;
//     next();
//   })
// }

async function run(){
    try{
        const appointmentOptionsCollection = client.db("cloneDoctors").collection("appointmentOptions");
        const bookingCollection = client.db("cloneDoctors").collection('bookings'); 
        const usersCollection = client.db("cloneDoctors").collection('users'); 
        const doctorsCollection = client.db("cloneDoctors").collection('doctors'); 
        app.get("/appointmentOptions", async(req, res)=> {
            const date = req.query.date;
            const query = {};
            // console.log(date)
            const options = await appointmentOptionsCollection.find(query).toArray();
            const bookingQuery = { appointmentDate: date };
            const alreadyBooked = await bookingCollection.find(bookingQuery).toArray();
            options.forEach(option => {
                const optionBooked = alreadyBooked.filter(book => book.treatment === option.name);
                const bookedSlots = optionBooked.map(book => book.slot);
                const remaningSlots = option.slots.filter( slot => !bookedSlots.includes(slot));
                option.slots = remaningSlots;
                
            })
            res.send(options)
        });
        app.get('/bookings/:id', async(req, res)=> {
          const id = req.params.id;
          const query = { _id: ObjectId(id) };
          const result = await bookingCollection.findOne(query);
          res.send(result)
          
        })
        //jwt
        app.get('/jwt', async(req, res)=> {
          const email = req.query.email;
          const query = {email:email}
          const user = await usersCollection.findOne(query);
          if(user){
            const token = jwt.sign({ email }, process.env.ACCESS_TOKEN, {expiresIn: '1d'});
            res.send({accessToken: token})
          }
          res.status(403).send({message: 'Forbidden Access!'})
        });
        app.get('/users', async(req, res)=> {
          const query = {};
          const users = await usersCollection.find(query).toArray();
          res.send(users)
        });
        app.get('/users/admin/:email', async(req, res)=> {
          const email = req.params.email;
          const filter = {email}
          const user = await usersCollection.findOne(filter);
          res.send({isAdmin: user?.role === 'admin'});
        })
        app.put('/users/admin/:id', async(req, res)=> {
          const id = req.params.id;
          const filter = {_id: ObjectId(id)};
          const options = {upsert: true};
          const updatedDoc = {
            $set: {
              role: 'admin'
            }
          }
          const result = await usersCollection.updateOne(filter, updatedDoc, options);
          res.send(result)
        })
        //tempoaray 
        // app.get('/addprice', async(req, res)=> {
        //   const filter = {};
        //   const options = {upsert: true};
        //    const updatedDoc = {
        //      $set: {
        //        price: 99,
        //      },
        //    };
        //    const result = await appointmentOptionsCollection.updateMany(filter, updatedDoc, options);
        //    res.send(result);
        // })
        //save user details
        app.post('/users', async(req, res)=> {
          const user = req.body;
          const result = await usersCollection.insertOne(user);
          res.send(result);
        })
        //get booking
        app.get('/bookings', async(req, res)=> {
          
          const email = req.query.email;
          const query = {email}
          
          
          const result = await bookingCollection.find(query).toArray();
          res.send(result)
        })
        //create booking
        app.post('/bookings', async(req, res)=> {
            const booking = req.body;
            const query = {
                appointmentDate: booking.appointmentDate,
                treatment: booking.treatment,
                email: booking.email
            }
            const alreadyBooked = await bookingCollection.find(query).toArray();
            if(alreadyBooked.length){
                const message = `You have already booked on ${booking.appointmentDate}`;
                return res.send({acknowledged: false, message})
            }
            const result = await bookingCollection.insertOne(booking);
            res.send(result);
        });
        //version v2
        app.get("/v2/appointmentOptions", async(req, res)=> {
            const date = req.query.date;
            const options = await appointmentOptionsCollection.aggregate([
              {
                $lookup: {
                  from: "bookings",
                  localField: "name",
                  foreignField: "treatment",
                  pipeline: [
                    {
                      $match: {
                        $expr: {
                          $eq: ["$appointmentDate", date],
                        },
                      },
                    },
                  ],
                  as: "booked",
                },
              },
              {
                $project: {
                    name: 1,
                    slots: 1,
                    booked: {
                        $map: {
                            input: '$booked',
                            as: 'book',
                            in: '$$book.slot'
                        }
                    }
                }
              },
              {
                $project: {
                    name: 1,
                    slots: {
                        $setDifference: ['$slots', '$booked']
                    }
                }
              }
            ]).toArray();
            res.send(options)
        });
        app.get('/appointmentSpeciality', async(req, res)=> {
          const query = {};
          const result = await appointmentOptionsCollection.find(query).project({name: 1}).toArray();
          res.send(result);
        });
        app.get('/doctors' ,async(req, res)=> {
          const query = {};
          const result = await doctorsCollection.find(query).toArray();
          res.send(result);
        })
        app.post('/doctors', async(req, res)=>{
          const doctor = req.body;
          const result = await doctorsCollection.insertOne(doctor);
          res.send(result);
        });
        app.delete('/doctors/:id', async(req, res)=> {
          const id = req.params.id;
          const filter = {_id: ObjectId(id)};
          const result = await doctorsCollection.deleteOne(filter);
          res.send(result);
        })
    }
    finally{

    }
}
run().catch(error => console.log(error))


app.get('/', async(req,res)=> {
    res.send('Clone Doctors Portal server is running!');
});
app.listen(port, ()=> console.log(`DoctorsServer running on port ${port}`))
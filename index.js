const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion } = require("mongodb");
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

async function run(){
    try{
        const appointmentOptionsCollection = client.db("cloneDoctors").collection("appointmentOptions");
        
        app.get("/appointmentOptions", async(req, res)=> {
            const query = {};
            const options = await appointmentOptionsCollection.find(query).toArray();
            res.send(options)
        });
    }
    finally{

    }
}
run().catch(error => console.log(error))


app.get('/', async(req,res)=> {
    res.send('Clone Doctors Portal server is running!');
});
app.listen(port, ()=> console.log(`DoctorsServer running on port ${port}`))
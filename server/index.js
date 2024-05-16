// server/index.js
require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bodyParser = require('body-parser');
const { v4: uuidv4 } = require('uuid');  
const { Server } = require('socket.io');
const http = require('http');


const app = express();
const port = 3000;
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL,
    methods: ['GET', 'POST'],
  },
});

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL,
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type'],
}));

app.use(bodyParser.json());



// MongoDB connection
mongoose.connect(process.env.MONGODB_URI, {});


const db = mongoose.connection;
db.on('error', console.error.bind(console, 'connection error:'));
db.once('open', () => {
  console.log('Connected to MongoDB');
});

// Define a schema
const stateSchema = new mongoose.Schema({
  mapId: { type: String, required: true, unique: true },
  state: Object,
});

const State = mongoose.model('State', stateSchema);

const areStatesEqual = (state1, state2) => {
  return JSON.stringify(state1) === JSON.stringify(state2);
};

// API endpoints
// endpoint to get map from id
app.get('/api/state/:mapId', async (req, res) => {
  try {
    const { mapId } = req.params;
    const state = await State.findOne({ mapId });
    res.json(state ? state.state : {});
  } catch (err) {
    res.status(500).send(err);
  }
});

// endpoint to save map state using mapId
app.post('/api/state/:mapId', async (req, res) => {
  try {
    const { mapId } = req.params;
    const { state } = req.body;
    const existingState = await State.findOne({ mapId });
    if (!existingState || !areStatesEqual(existingState.state, state)) {
      await State.findOneAndUpdate({ mapId }, { state }, { upsert: true });
      io.to(mapId).emit('stateUpdated', state);
    }

    res.status(201).send('State saved', state, mapId);
  } catch (err) {
    res.status(500).send(err);
  }
});

// endpoint to create a new mapId
app.post('/api/newmap', async (req, res) => {
  try {
    const mapId = uuidv4();
    const state = {};
    await State.create({ mapId, state });
    res.status(201).json({ mapId });
  } catch (err) {
    res.status(500).send(err);
    console.log(err);
  }
});

// Socket.IO connection
io.on('connection', (socket) => {
  console.log('A user connected');

  socket.on('joinMap', (mapId) => {
    socket.join(mapId);
    console.log(`User joined map: ${mapId}`);
  });

  socket.on('disconnect', () => {
    console.log('User disconnected');
  });
});

server.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
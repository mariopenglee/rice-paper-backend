require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bodyParser = require('body-parser');
const { v4: uuidv4 } = require('uuid');  
const { Server } = require('socket.io');
const http = require('http');


const app = express();
const port = process.env.PORT || 3000;
const host = '0.0.0.0'; // Ensure the server listens on all network interfaces
const server = http.createServer(app);
const io = new Server(server, {
  transports: ["websocket"],
  pingInterval: 60000,
  pingTimeout: 60000,
  upgradeTimeout: 30000,
});

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL,
  methods: ['GET', 'POST', 'PATCH'],
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
  version: { type: Number, default: 0 },
});

const State = mongoose.model('State', stateSchema);

const areStatesEqual = (state1, state2) => {
  return JSON.stringify(state1) === JSON.stringify(state2);
};


// API endpoints
app.get('/api/state/:mapId', async (req, res) => {
  try {
    const { mapId } = req.params;
    const state = await State.findOne({ mapId });
    res.json(state ? state : {});
  } catch (err) {
    res.status(500).send(err);
  }
});
app.patch('/api/state/:mapId', async (req, res) => {
  try {
    const { mapId } = req.params;
    const { state, version } = req.body;

    const currentState = await State.findOne({ mapId });

    if (!currentState) {
      return res.status(404).send('Map not found');
    }

    if (currentState.version !== version) {
      return res.status(409).send('Version conflict');
    }

    if (areStatesEqual(currentState.state, state)) {
      return res.status(200).send('State unchanged');
    }

    // Merge the incoming state with the current state
    const newState = {
      ...currentState.state,
      ...state
    };

    await State.updateOne(
      { mapId },
      { $set: { state: newState, version: currentState.version + 1 } }
    );

    io.to(mapId).emit('stateUpdated', newState, currentState.version + 1);
    console.log(`State updated for map: ${mapId}`);

    res.status(201).send('State saved');
  } catch (err) {
    res.status(500).send(err);
  }
});

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

  socket.on('stateUpdated', (mapId, state, version) => {
    console.log(`a user updated the state of map: ${mapId}, ${state}, ${version}`);
  });

});

server.listen(port, host, () => {
  console.log(`Server running on http://${host}:${port}`);
});



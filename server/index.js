// server/index.js

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
const port = 5001;

// Middleware
app.use(cors());
app.use(bodyParser.json());

// MongoDB connection
mongoose.connect('mongodb+srv://mariopeng:Maritolevi123@dev.gt34phs.mongodb.net/?retryWrites=true&w=majority&appName=dev', {
});

const db = mongoose.connection;
db.on('error', console.error.bind(console, 'connection error:'));
db.once('open', () => {
  console.log('Connected to MongoDB');
});

// Define a schema
const stateSchema = new mongoose.Schema({
  state: Object,
});

const State = mongoose.model('State', stateSchema);

// API endpoints
app.get('/api/state', async (req, res) => {
  try {
    const state = await State.findOne();
    res.json(state);
  } catch (err) {
    res.status(500).send(err);
  }
});

app.post('/api/state', async (req, res) => {
  try {
    const { state } = req.body;
    await State.deleteMany({}); // Clear previous state
    const newState = new State({ state });
    await newState.save();
    res.status(201).send(newState);
  } catch (err) {
    res.status(500).send(err);
  }
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});

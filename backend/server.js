import express from 'express'
import cors from 'cors'
// using this library to create the access token 
import crypto from 'crypto'
import mongoose from 'mongoose'
// for hashing the password 
import bcrypt from 'bcrypt-nodejs'

const mongoUrl = process.env.MONGO_URL || "mongodb://localhost/authAPI"
mongoose.connect(mongoUrl, { useNewUrlParser: true, useUnifiedTopology: true, useCreateIndex: true })
mongoose.Promise = Promise

// creating user model
const UserSchema = new mongoose.Schema({
  username: {
    type: String,
    unique: true,
    required: true
  }, 
  password: {
    type: String,
    required: true
  }, 
  accessToken: {
    type: String,
    default: () => crypto.randomBytes(128).toString('hex')
  }
});

const User = mongoose.model('User', UserSchema)

const ThoughtSchema = new mongoose.Schema({
  message: {
    type: String,
    required: true,
  },
});

const Thought = mongoose.model('Thought', ThoughtSchema);

// this function is like a shild between frontend and backend, 
// if you have accessToken you will procded to the secret page, otherwise no
const authenticateUser = async (req, res, next) => {
  // specifiy this header in a frontend 
  // accesstoken sends via request 
  const accessToken = req.header('Authorization')
  try {
    // find user by accesstoken 
    const user = await User.findOne({ accessToken })
    // if there is a user with that token, we going 
    if(user) {
      // next function, inbuilt express function, which simply says move along and going to access get request /thoughts in this case
      next()
    } else {
      // if we dont have a user with that particular accessToken
      res.status(401).json({response: 'Please, log in', success: false})
    }
  } catch (err) {
    res.status(404).json({ response: err, success: false})
  }
}

// Defines the port the app will run on. Defaults to 8080, but can be 
// overridden when starting the server. For example:
//
//   PORT=9000 npm start
const port = process.env.PORT || 8080
const app = express()

// Add middlewares to enable cors and json body parsing
app.use(cors())
app.use(express.json())

// Start defining your routes here
app.get('/', (req, res) => {
  res.send('Hello world! Welcome to API!')
})

app.get('/thoughts', authenticateUser)
// if the user is allowed to visit the page, passing the authenticateUser(), then this request will trigger 
app.get('/thoughts', async (req, res) => {
  const thoughts = await Thought.find({});
  res.status(201).json({ response: thoughts, success: true });
});

app.post('/thoughts', async (req, res) => {
  const { message } = req.body;

  try {
    const newThought = await new Thought({ message }).save();
    res.status(201).json({ response: newThought, success: true });
  } catch (error) {
    res.status(400).json({ response: error, success: false });
  }
});

// request to create a user 
app.post('/signup', async (req, res) => {
  // take in username and password from frontend like a body
  const { username, password } = req.body;

  try {
    // taking users password and randomizing it into hashed string, we can also unhash the string(password)
    // profesionally called salt, this method randomize the string 
    const salt = bcrypt.genSaltSync();

    if (password.length < 5) {
      // throw stopping the execution of try block and redirect to catch block, the error from catch will be the string from throw 
      throw 'Password must be at least 5 characters long'
    } 
    // creating new user here 
    const newUser = await new User({username,
      // hashing password (first argument) and randomize it (second argument) and then saving the user
      password: bcrypt.hashSync(password, salt)
    }).save();
    // 201 = created status code
    // sending back to the frontend
    // accessToken generated by default, dont have to create it manually 
    res.status(201).json({
      response: {
        userId: newUser._id,
        username: newUser.username,
        accessToken: newUser.accessToken,
      },
      success: true,
    })
  } catch (err) {
    if (err.code === 11000) {
      if (err.keyValue.username) {
        res.status(400).json({
          response: "Username already taken, sorry! :)",
          success: false,
          err,
        });
      } 
    }
    res.status(400).json({ response: err, success: false })
  }
})

// this endpoint look for the user with particular username and password combined 
app.post('/signin', async (req, res) => {
  // getting username and password from the user 
  const { username, password } = req.body; 
  try {
    // checking if we have the user, finding the one user  
    const user = await User.findOne({ username });
    // compaing username and unhashing password to compare to the password that is atached to the database which is hashed 
    if(user && bcrypt.compareSync(password, user.password)) {
        res.status(200).json({
          response: {
            userId: user._id,
            username: user.username,
            accessToken: user.accessToken,
          },
          success: true,
        })
    } else { 
      res.status(404).json({ response: 'User password or name does not match', success: false})
    }
  } catch (err) {
    res.status(400).json({ response: err, success: false })
  }
})

// Start the server
app.listen(port, () => {
  // eslint-disable-next-line
  console.log(`Server running on http://localhost:${port}`)
})



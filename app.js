const express = require('express');
const cors = require('cors')
const mongoose = require('mongoose');
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const bcrypt = require('bcrypt');
const app = express();

// Mongo stuff 

const uri = process.env.MONGODB_URI || `mongodb://localhost/dogs`;
mongoose
  .connect(uri, { useNewUrlParser: true })
  .then(x => {
    console.log(`Connected to Mongo! Database name: "${x.connections[0].name}"`)
  })
  .catch(err => {
    console.error('Error connecting to mongo', err)
});

const userSchema = new mongoose.Schema({
  username: String,
  password: String
}, {
  timestamps: {
    createdAt: 'created_at',
    updatedAt: 'updated_at'
  }
});
const User = mongoose.model('User', userSchema);

// Passport stuff

passport.use(new LocalStrategy({
  usernameField: 'username',
  passwordField: 'password'
},
  (username, password, done) => {
    User.findOne({ username })
      .then(foundUser => {
        if (!foundUser) {
          done(null, false, { message: 'Incorrect username' });
          return;
        }

        if (!bcrypt.compareSync(password, foundUser.password)) {
          done(null, false, { message: 'Incorrect password' });
          return;
        }

        done(null, foundUser);
      })
      .catch(err => done(err));
  }
));

passport.serializeUser((loggedInUser, cb) => {
  cb(null, loggedInUser._id);
});

passport.deserializeUser((userIdFromSession, cb) => {
  User.findById(userIdFromSession)
    .then(userDocument => {
      cb(null, userDocument);
    })
    .catch(err => {
      cb(err);
    })
});

app.use(passport.initialize());
app.use(passport.session());

// Express stuff

app.use(cors())

app.listen(process.env.PORT || 3000, function() {
  console.log('My app listening on port 3000!')
});

const bodyParser = require('body-parser');
app.use(bodyParser.urlencoded({ extended: true }));

// auth stuff

app.post("/auth/signup", (req, res, next) => {
  const { username, password, name } = req.body
  console.log(req.body)
  if (!username || !password) {
    res.status(400).json({ message: "Indicate username and password" })
    return
  }
  User.findOne({ username })
    .then(userDoc => {
      if (userDoc !== null) {
        res.status(409).json({ message: "The username already exists" })
        return
      }
      const bcryptSalt = 10
      const salt = bcrypt.genSaltSync(bcryptSalt)
      const hashPass = bcrypt.hashSync(password, salt)
      const newUser = new User({ username, password: hashPass, name })
      return newUser.save()
    })
    .then(userSaved => {
      // LOG IN THIS USER
      // "req.logIn()" is a Passport method that calls "serializeUser()"
      // (that saves the USER ID in the session)
      req.logIn(userSaved, () => {
        // hide "encryptedPassword" before sending the JSON (it's a security risk)
        userSaved.password = undefined;
        res.json( userSaved );
      });
    })
    .catch(err => next(err))
})

app.post("/auth/login", (req, res, next) => {
  const { username, password } = req.body

  // first check to see if there's a document with that username
  User.findOne({ username })
    .then(userDoc => {
      // "userDoc" will be empty if the username is wrong (no document in database)
      if (!userDoc) {
        // create an error object to send to our error handler with "next()"
        next(new Error("Incorrect username "))
        return
      }

      // second check the password
      // "compareSync()" will return false if the "password" is wrong
      if (!bcrypt.compareSync(password, userDoc.password)) {
        // create an error object to send to our error handler with "next()"
        next(new Error("Password is wrong"))
        return
      }

      // LOG IN THIS USER
      // "req.logIn()" is a Passport method that calls "serializeUser()"
      // (that saves the USER ID in the session)
      req.logIn(userDoc, () => {
        // hide "encryptedPassword" before sending the JSON (it's a security risk)
        userDoc.password = undefined
        res.json(userDoc)
      })
    })
    .catch(err => next(err))
})

app.post('/auth/login-with-passport-local-strategy', (req, res, next) => {
  passport.authenticate('local', (err, theUser, failureDetails) => {
    if (err) {
      res.status(500).json({ message: 'Something went wrong' })
      return
    }

    if (!theUser) {
      res.status(401).json(failureDetails)
      return
    }

    req.login(theUser, (err) => {
      if (err) {
        res.status(500).json({ message: 'Something went wrong' })
        return
      }

      // We are now logged in (notice req.user)
      res.json(req.user)
    })
  })(req, res, next)
})

app.get("/auth/logout", (req, res) => {
  req.logout()
  res.json({ message: 'You are out!' })
})

// dogs stuff

var dogs = [
  {
    name: "Kira",
    hungry: "yes",
    colour: "Brown and White"
  },
  {
    name: "Tez",
    hungry: "yes",
    colour: "Gray"
  }
]

app.get('/dogs', function (request, response, next) { 
  response.send(dogs);
});

app.post('/hungry/:dog/:state', function (request, response, next) { 
  for(var i = 0; i < dogs.length; i++) {
    if(dogs[i].name == request.params.dog) {
      dogs[i].hungry = request.params.state
      response.sendStatus(200)
      return;
    }
  }
  response.status(400).send({"error": "Can't find that dog, sunshine."});
});

setInterval(function() {
  for(var i = 0; i < dogs.length; i++) {
    dogs[i].hungry = "yes"
  }
}, 30000)

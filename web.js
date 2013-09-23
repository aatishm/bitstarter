// TODO: Node best practice is to include the node_modules directory in your source repository for faster deploys and dev/prod parity.
// http://12factor.net/dev-prod-parity
var express = require('express');
var fs = require('fs');
var passport = require('passport');
var authentication = require('./authentication.js');
var aws = require("./aws.js");

// Configure common middlewares. Precedence matters. Think of middleware as a stack of handlers that need to be executed one after another for every HTTP Request
var app = express.createServer(
    express.logger(),
    express.static(__dirname + '/public'),
    express.cookieParser(),
    express.bodyParser(),
    express.session({secret: "skjghskdjfhbqigohqdiouk"}),
    passport.initialize(),
//  See Sessions section on http://passportjs.org/guide/configure/
    passport.session()
);

// configure views
app.set('view engine', 'ejs');
app.set('views', __dirname + '/views');
app.set('view options', {layout: false});

app.get('/', function(request, response) {
  // TODO: Should we have a gmail like feature where if the customer is already logged in, should we redirect to dashboard?
  var result = fs.readFileSync('index.html').toString();
  response.send(result);
});

// Configure Passport
authentication.configurePassport(passport);

// Fetch AWS SES object
var ses = aws.ses(); 

// Redirect the user to the OAuth provider (linkedin) for authentication.  When
// complete, the provider will redirect the user back to the application at
//     /auth/provider/callback
app.get('/login', passport.authenticate('linkedin'));

// The OAuth provider has redirected the user back to the application.
// Finish the authentication process by attempting to obtain an access
// token.  If authorization was granted, the user will be logged in.
// Otherwise, authentication has failed.
app.get('/auth/linkedin/callback', function(req, res, next) {
  passport.authenticate('linkedin', function(err, user, info) {
    if (err) { return next(err); }
    if (!user) { return res.redirect('/login'); }
    req.logIn(user, function(err) {
      if (err) { return next(err); }
      ses.sendEmail({
          Source: "aatish.mandelecha@gmail.com",
          Destination: {ToAddresses: ["aatish.mandelecha@gmail.com"]},
          Message: {
            Subject: {
              Data: "Welcome to Intervyouer!",
              Charset: "UTF-8"
            },
            Body: {
              Text: {
                Data: "Welcome! We're happy you joined us. Your login id is aatish.mandelecha@gmail.com",
                Charset: "UTF-8"
              }
            }
          },
          ReturnPath: "aatish.mandelecha@gmail.com"
        }, function(err, data) {
          if (err) { console.log(err); }
          if (data) { console.log(data); }
      });
      return res.redirect('/dashboard');
    });

  })(req, res, next);

});

app.get('/dashboard', ensureAuthenticated, function(request, response) {
  response.render('dashboard');
});

app.get('/interview', ensureAuthenticated, function(request, response) {
    fs.readFile('collaborative_editor.html', function(err, data) {
        response.send(data.toString());
    });
});

//  Simple route middleware to ensure user is authenticated.
//   Use this route middleware on any resource that needs to be protected.  If
//   the request is authenticated (typically via a persistent login session),
//   the request will proceed.  Otherwise, the user will be redirected to the
//   login page.
function ensureAuthenticated(req, res, next) {
  if (req.isAuthenticated()) { return next(); }
  res.redirect('/login');
}

var port = process.env.PORT || 8080;
app.listen(port, function() {
  console.log("Listening on " + port);
});

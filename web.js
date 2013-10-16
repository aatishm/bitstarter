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
    // Use app.use('/static', middleware) so that express.static is not called on every request. See SO below:
    // http://stackoverflow.com/questions/12695591/node-js-express-js-how-does-app-router-work
    express.static(__dirname + '/public'),
    express.cookieParser(),
    express.bodyParser(),
    express.session({secret: "keyboard cat"}),
    passport.initialize(),
//  See Sessions section on http://passportjs.org/guide/configure/
    passport.session()
);

// configure views
app.set('view engine', 'ejs');
app.set('views', __dirname + '/views');
app.set('view options', {layout: false});

app.get('/', function(request, response) {
  response.render('index', {user: request.user});
});

// Configure Passport
authentication.configurePassport(passport);

// Fetch AWS SES object
var ses = aws.ses(); 
var dynamoDB = aws.dynamoDB();

app.get('/login', passport.authenticate('linkedin'));

// TODO: I am not sure what is wrong but on Chrome, when I click on 'Join Now', even after process restarts, it is not asking me for linkedin credentials
// however on Firefox, that is not the case (process restart or not)

// Redirect the user to the OAuth provider (linkedin) for authentication.  When
// complete, the provider will redirect the user back to the application at
//     /auth/provider/callback
app.get('/signUp/:candidateType', function(req, res, next) {
    // Wrapping passport.authenticate middleware in order to store candidateType in session for future actions
    req.session.candidateType = req.params.candidateType;
    req.session.pageType = 'signUp';
    return passport.authenticate('linkedin')(req, res, next);
});

function putIntoDynamo(req, candidateType, callback) {
dynamoDB.putItem({
    TableName: "Candidate",
    Item: {
        linkedin_id: {S: req.user.id},
        candidateType: {S: candidateType},
        displayName: {S: req.user.displayName}
    }
}, function(err, data) {
      logErrorAndData(err, data, "DynamoDB_Put_" + candidateType);
      callback(data);
   }
);
}

function getFromDynamo(req, callback) {
dynamoDB.getItem({
    TableName: "Candidate",
    Key: {
        linkedin_id: {S: req.user.id}
    }
}, function(err, data) {
      logErrorAndData(err, data, "DynamoDB_Get");
      callback(data);
   }
);
}

function sendEmail(req) {
ses.sendEmail({
    Source: "Intervyouer <support@intervyouer.com>",
    Destination: {ToAddresses: [req.user._json.emailAddress]},
        Message: {
            Subject: {
                Data: "Welcome to Intervyouer!",
                Charset: "UTF-8"
            },
            Body: {
                Text: {
                    Data: "Welcome! We're happy you joined us. Your login id is same as your Linkedin id: " + req.user._json.emailAddress,
                    Charset: "UTF-8"
                }
            }
          },
        ReturnPath: "support@intervyouer.com"
    }, function(err, data) {
            logErrorAndData(err, data, "SES");
       }
);}

// The OAuth provider has redirected the user back to the application.
// Finish the authentication process by attempting to obtain an access
// token. If authorization was granted, the user will be logged in.
// Otherwise, authentication has failed.
app.get('/auth/linkedin/callback',
  passport.authenticate('linkedin', { failureRedirect: '/' }), 
  function(req, res) {
      if (req.session.pageType === 'signUp') {
          var candidateType = req.session.candidateType === "interviewer" ? "interviewer" : "interviewee";
          // Create a entry into table
          putIntoDynamo(req, candidateType, function(data) {
              // Send email to the customer
              sendEmail(req);
              // Redirect to dashboard
              candidateType === "interviewer" ? res.redirect('/dashboard/interviewer') : res.redirect('/dashboard/interviewee') ;
          });
      }
      else {
         // it is a login page. Retrieve item from dynamo db
         getFromDynamo(req, function(data) {
             if (data['Item'] != null) {
                 // Redirect to dashboard
                 data['Item'].candidateType.S === "interviewer" ? res.redirect('/dashboard/interviewer') : res.redirect('/dashboard/interviewee') ;
             }
             else {
                 // Since user is already authenticated by linkedin but is not found in our dynamo, we want to logout the session.
                 logout(req); 
                 res.render('error');
             }
         });
      }
  }
);

function logErrorAndData(err, data, moduleName) {
    if (err) { console.log(moduleName + " Error: " + err); }
    if (data) { 
        console.log("Module Name: " + moduleName + "\n");
        for (var key in data) {
            console.log("Key: " + key + "Val: " + data[key]); 
        }
    }
}

app.get('/dashboard/:type', ensureAuthenticated, function(request, response) {
  if (request.params.type === "interviewer") {
      request.user.candidateType = "interviewer";
      response.render('interviewerDashboard', {user: request.user});
  }
  else {
      request.user.candidateType = "interviewee";
      dynamoDB.scan({
          TableName: "Candidate",
          ScanFilter: {
              candidateType: {
                  AttributeValueList: [{S: "interviewer"}],
                  ComparisonOperator: "EQ"
              }
          }
      }, function(err, data) {
          response.render('intervieweeDashboard', {user: request.user,
                                                   interviewers: data});
      });
  }
});

app.get('/interview', ensureAuthenticated, function(request, response) {
    fs.readFile('collaborative_editor.html', function(err, data) {
        response.send(data.toString());
    });
});

app.post('/interviewer/:id', function(req, res) {
    // TODO: Validate inputs before persisting
    dynamoDB.updateItem({
          TableName: "Candidate",
          Key: {
              linkedin_id: {S: req.params.id}
          },
          AttributeUpdates: {
              price: {
                  Action: "PUT",
                  Value: {S: req.body.price}
              },
              languages: {
                  Action: "PUT",
                  Value: {S: req.body.languages}
              },
              areaOfExpertise: {
                  Action: "PUT",
                  Value: {S: req.body.areaOfExpertise}
              },
              description: {
                  Action: "PUT",
                  Value: {S: req.body.description}
             }
          }
      }, function(err, data) {
          logErrorAndData(err, data, "DynamoDB_Update");
      });

    res.send('success');
});

app.post('/scheduleInterview', function(req, res) {
    console.log("Schedule Interview" + req.params);
});

function logout(request) {
    request.user = false;
    request.logout();
    request.session.destroy();
}

app.get('/logout', function(request, response) {
    logout(request);
    response.redirect('/');
});

//  Simple route middleware to ensure user is authenticated.
//   Use this route middleware on any resource that needs to be protected.  If
//   the request is authenticated (typically via a persistent login session),
//   the request will proceed.  Otherwise, the user will be redirected to the
//   login page.
function ensureAuthenticated(req, res, next) {
  if (req.isAuthenticated()) { return next(); }
  res.redirect('/login/');
}

var port = process.env.PORT || 8080;
app.listen(port, function() {
  console.log("Listening on " + port);
});

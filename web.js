// TODO: Node best practice is to include the node_modules directory in your source repository for faster deploys and dev/prod parity.
// http://12factor.net/dev-prod-parity

// TODO: If possible, rename linkedin_id attribute to linkedinId in DynamoDB table and code
var express = require('express');
var fs = require('fs');
var passport = require('passport');
var authentication = require('./authentication.js');
var aws = require("./aws.js");
var shortId = require('shortid');

// Set seed for shortId
shortId.seed(193523723);

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

app.get('/', function(req, res) {
  res.render('index', {user: req.user});
});

// Fetch AWS SES object
var ses = aws.ses(); 
var dynamoDB = aws.dynamoDB();

// Configure Passport
authentication.configurePassport(passport, dynamoDB);

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
        displayName: {S: req.user.displayName},
        // TODO: Should we be persisting email id? Can the user change his emailId in Linkedin? If so, should we always make a call to Linkedin by profileId to get up-to-date info?
        emailAddress: {S: req.user._json.emailAddress}
    }
}, function(err, data) {
      logErrorAndData(err, data, "DynamoDB_Put_" + candidateType);
      callback(data);
   }
);
}

function getFromDynamo(params, callback) {
dynamoDB.getItem({
    TableName: params.tableName,
    Key: {
        linkedin_id: {S: params.id}
    }
}, function(err, data) {
      logErrorAndData(err, data, "DynamoDB_Get");
      callback(data);
   }
);
}

function sendEmail(data, callback) {
ses.sendEmail({
    Source: "Intervyouer <support@intervyouer.com>",
    Destination: {ToAddresses: data.toAddressList},
        Message: {
            Subject: {
                Data: data.subjectData,
                Charset: "UTF-8"
            },
            Body: {
                Html: {
                    Data: data.bodyData, 
                    Charset: "UTF-8"
                }
            }
          },
        ReturnPath: "support@intervyouer.com"
    }, function(err, data) {
            logErrorAndData(err, data, "SES");
            if (callback) {
                callback(data);
            }
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
          // TODO: If the user signs up again and again, all the previous info will be lost as putItem will override it. We should do a getItem and check if item
          // exists, if so, updateItem else putItem
          putIntoDynamo(req, candidateType, function(data) {
              // Send email to the customer
              var emailData = {
                  toAddressList: [req.user._json.emailAddress],
                  subjectData: "Welcome to Intervyouer!",
                  bodyData: "Welcome! We're happy you joined us. Your login id is same as your Linkedin id: " + req.user._json.emailAddress
              };
              sendEmail(emailData);
              // Redirect to dashboard
              candidateType === "interviewer" ? res.redirect('/dashboard/interviewer') : res.redirect('/dashboard/interviewee') ;
          });
      }
      else {
         // it is a login page. Retrieve item from dynamo db
         getFromDynamo({id: req.user.id, tableName: "Candidate"}, function(data) {
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

app.get('/dashboard/:type', ensureAuthenticated, function(req, res) {
  if (req.params.type === "interviewer") {
      res.render('interviewerDashboard', {user: req.user});
  }
  else {
      dynamoDB.scan({
          TableName: "Candidate",
          ScanFilter: {
              candidateType: {
                  AttributeValueList: [{S: "interviewer"}],
                  ComparisonOperator: "EQ"
              }
          }
      }, function(err, data) {
          res.render('intervieweeDashboard', {user: req.user,
                                                   interviewers: data});
      });
  }
});

app.get('/interview/:interviewId/userId/:userId', ensureAuthenticated, function(req, res) {
    res.render('collaborativeEditor', {interviewId: req.params.interviewId,
                                            userId: req.params.userId});
});

app.post('/interviewer/:id', ensureAuthenticated, function(req, res) {
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
          if (err) {
              res.send(500, { error: 'Something blew up!' });
          } else {
              res.send('success');
          }
      });
});

app.post('/scheduleInterview', ensureAuthenticated, function(req, res) {
    // TODO: Validate your inputs
    dynamoDB.putItem({
        TableName: "Interview",
        Item: {
            interviewId: {S: shortId.generate()},
            interviewerId: {S: req.body.interviewerId},
            intervieweeId: {S: req.body.intervieweeId},
            dateTime: {S: req.body.dateTime},
            interviewArea: {S: req.body.interviewArea}
        }
    }, function(err, data) {
           logErrorAndData(err, data, "DynamoDB_Put_ScheduleInterview");
           // get interviewer's email id from db
           getFromDynamo({id: req.body.interviewerId, tableName: "Candidate"}, function(data) {
               // Send email to the interviewer
               var emailData = {
                   toAddressList: [data['Item'].emailAddress.S],
                   subjectData: "Interview Request",
                   bodyData: "Hey " + data['Item'].displayName.S + ",<br/>You have a request for interview.<p>Please visit your <a href=\"http://www.intervyouer.com/dashboard/interviewer\">dashboard</a> to accept/decline the interview. </p><p>Thanks,<br/>Intervyouer Team</p>"
               };
               sendEmail(emailData, function(data) {
                   res.send('success');
               });
           });
       }
    );
});

app.get('/dashboard/interviewer/upcomingInterviews/:id', ensureAuthenticated, function(req, res) {
    dynamoDB.scan({
        TableName: "Interview",
        ScanFilter: {
            interviewerId: {
                AttributeValueList: [{S: req.params.id}],
                ComparisonOperator: "EQ"
            }
        }
    }, function(err, data) {
        // TODO: user should have all the profile info. Remove 'type' property
        res.render('interviewerUpcomingInterviews', {interviews: data, interviewerId: req.params.id, user: req.user});
    });
});

app.get('/dashboard/interviewee/upcomingInterviews/:id', ensureAuthenticated, function(req, res) {
    dynamoDB.scan({
        TableName: "Interview",
        ScanFilter: {
            intervieweeId: {
                AttributeValueList: [{S: req.params.id}],
                ComparisonOperator: "EQ"
            }
        }
    }, function(err, data) {
        // TODO: user should have all the profile info. Remove 'type' property
        res.render('intervieweeUpcomingInterviews', {interviews: data, intervieweeId: req.params.id, user: req.user});
    });
});

function logout(req) {
    req.user = false;
    req.logout();
    req.session.destroy();
}

app.get('/logout', function(req, res) {
    logout(req);
    res.redirect('/');
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

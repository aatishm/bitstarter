var express = require('express');
var fs = require('fs');
var OAuth= require('oauth').OAuth;

// Configure common middlewares. Precedence matters. Think of middleware as a stack of handlers that need to be executed one after another for every HTTP Request
var app = express.createServer(
    express.logger(),
    express.bodyParser(),
    express.cookieParser(),
    express.session({secret: "skjghskdjfhbqigohqdiouk"})
);

// configure views
app.use(express.static(__dirname + '/images'));
app.set('view engine', 'ejs');
app.set('views', __dirname + '/views');
app.set('view options', {layout: false});

app.get('/', function(request, response) {
  var result = fs.readFileSync('index.html').toString();
  response.send(result);
});

var oa = new OAuth(
	"https://api.linkedin.com/uas/oauth/requestToken",
	"https://api.linkedin.com/uas/oauth/accessToken",
	"v8yfm0j3yo65",
	"bbcoKI0lbsdpzr54",
	"1.0",
	"http://ec2-54-200-1-27.us-west-2.compute.amazonaws.com:8080/linkedin_callback",
	"HMAC-SHA1"
);

app.get('/linkedin_login', function(req, res) {
    oa.getOAuthRequestToken(function(error, oauth_token, oauth_token_secret, results){
        if (error) {
            console.log(error);
            res.send("OAuth didn't work.")
        } else {
            req.session.oauth = {};
            req.session.oauth.token = oauth_token;
            req.session.oauth.token_secret = oauth_token_secret;
            res.redirect("https://www.linkedin.com/uas/oauth/authorize?oauth_token=" + oauth_token);
        }
    });
});

app.get('/linkedin_callback', function(req, res) {
    if (req.session.oauth) {
        req.session.oauth.verifier = req.query.oauth_verifier;
        var oauth = req.session.oauth;

        oa.getOAuthAccessToken(oauth.token,oauth.token_secret,oauth.verifier, function(error, oauth_access_token, oauth_access_token_secret, results) {
            req.session.oauth.access_token = oauth_access_token;
            req.session.oauth.access_token_secret = oauth_access_token_secret;
            res.redirect("/dashboard");
        });
    }
});

app.get('/dashboard', function(request, response) {
  response.render('dashboard');
});

var port = process.env.PORT || 8080;
app.listen(port, function() {
  console.log("Listening on " + port);
});

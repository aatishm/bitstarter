var LinkedInStrategy = require('passport-linkedin').Strategy;
var OAuth = require('oauth');

var CONSUMER_KEY = "v8yfm0j3yo65";

exports.configurePassport = function(passport, dynamoDB) {

    passport.use(new LinkedInStrategy({
        //requestTokenURL: "https://api.linkedin.com/uas/oauth/requestToken",
        //accessTokenURL: "https://api.linkedin.com/uas/oauth/accessToken",
        //userAuthorizationURL: "https://api.linkedin.com/uas/oauth/authorize",
        consumerKey: CONSUMER_KEY,
        consumerSecret: process.env.LINKEDIN_SECRET,
        callbackURL: process.env.LINKEDIN_CALLBACK_URL + "auth/linkedin/callback",
        profileFields: ['id', 'first-name', 'last-name', 'email-address', 'headline']
    },
    function(token, tokenSecret, profile, done) {
        // To keep the example simple, the user's LinkedIn profile is returned to
        // represent the logged-in user.  In a typical application, you would want
        // to associate the LinkedIn account with a user record in your database,
        // and return that user instead.
    	console.log("Trying to update token/token_secret of candidate: " + profile.id + ". This operation may fail.");
    	dynamoDB.updateItem({
    	    TableName: "Candidate",
    	    Expected: {
                linkedin_id: {
                    Value: {S: profile.id},
                    Exists: true
                }
            },
    	    Key: {
    		    linkedin_id: {S: profile.id}
    	    },
    	    AttributeUpdates: {
    		token: {
    		    Action: "PUT",
    		    Value: {S: token}
    		},
    		token_secret: {
    		    Action: "PUT",
    		    Value: {S: tokenSecret}
    		}
    	    }
    	}, function(err, data) {
            if (err) {
                console.log("Error while updating Dynamo after Linkedin Authentication. Potentially a new user? " + err);
            }
            
            // Adding token/token_secret so that for new user (via signUp, we can put those attributes on the table)
            profile.token = token;
            profile.token_secret = tokenSecret;
    	    done(null, profile);
    	});
    }));

    passport.serializeUser(function(user, done) {
        done(null, user);
    });

    passport.deserializeUser(function(user, done) {
        dynamoDB.getItem({
            TableName: 'Candidate',
                Key: {
                    linkedin_id: {S: user.id}
                }
            }, function(err, data) {
                err ? done(err, null) : done(null, data['Item']);
            }
        );
    });
}

exports.getOAuth = function() {
    var oauth = new OAuth.OAuth(
      'https://api.linkedin.com/uas/oauth/requestToken',
      'https://api.linkedin.com/uas/oauth/accessToken',
      CONSUMER_KEY,
      process.env.LINKEDIN_SECRET,
      '1.0A',
      null,
      'HMAC-SHA1'
    );
    return oauth;
}

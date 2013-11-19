var LinkedInStrategy = require('passport-linkedin').Strategy;
var OAuth = require('oauth');

exports.configurePassport = function(passport, dynamoDB) {

    passport.use(new LinkedInStrategy({
        //requestTokenURL: "https://api.linkedin.com/uas/oauth/requestToken",
        //accessTokenURL: "https://api.linkedin.com/uas/oauth/accessToken",
        //userAuthorizationURL: "https://api.linkedin.com/uas/oauth/authorize",
        consumerKey: "v8yfm0j3yo65",
        consumerSecret: process.env.LINKEDIN_SECRET,
        callbackURL: process.env.LINKEDIN_CALLBACK_URL + "auth/linkedin/callback",
        profileFields: ['id', 'first-name', 'last-name', 'email-address', 'headline']
    },
    function(token, tokenSecret, profile, done) {
        // To keep the example simple, the user's LinkedIn profile is returned to
        // represent the logged-in user.  In a typical application, you would want
        // to associate the LinkedIn account with a user record in your database,
        // and return that user instead.
	console.log("Trying to update candidate's token/token_secret. This operation may fail.");
	dynamoDB.updateItem({
	    TableName: "Candidate",
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
                var candidate = data['Item'];
                done(null, candidate);
            }
        );
    });
}

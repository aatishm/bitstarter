var LinkedInStrategy = require('passport-linkedin').Strategy;

exports.configurePassport = function(passport) {

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
       
        // See: http://passportjs.org/guide/configure/
        return done(null, profile);
    }
    ));

    passport.serializeUser(function(user, done) {
       // TODO: Add custom serialization/deserialization logic here
       done(null, user);
    });

    passport.deserializeUser(function(id, done) {
        done(null, id);
    });
}

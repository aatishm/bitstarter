// Load the AWS SDK for Node.js
var AWS = require('aws-sdk');

AWS.config.update({accessKeyId: process.env.AWS_ACCESS_KEY_ID, secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY});

// Set your region for future requests.
AWS.config.update({region: 'us-east-1'});

// Locking the API Version
AWS.config.apiVersions = {
  ses: '2010-12-01',
  dynamodb: '2012-08-10'
  // other service API versions
};

exports.ses = function() {
    return new AWS.SES();
}

exports.dynamoDB = function() {
    return new AWS.DynamoDB({
        region: "us-west-2"
    });
}


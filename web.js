var express = require('express');
var fs = require('fs');

var app = express.createServer(express.logger());

app.use(express.static(__dirname + '/images'));

app.get('/', function(request, response) {
  var result = fs.readFileSync('index.html').toString();
  response.send(result);
});

app.get('/dashboard', function(request, response) {
  var result = fs.readFileSync('dashboard.html').toString();
  response.send(result);
});

var port = process.env.PORT || 8080;
app.listen(port, function() {
  console.log("Listening on " + port);
});

var express = require('express');
var fs = require('fs');

var app = express.createServer(express.logger());

app.use(express.static(__dirname + '/images'));
app.set('view engine', 'ejs');
app.set('views', __dirname + '/views');
app.set('view options', {layout: false});

app.get('/', function(request, response) {
  var result = fs.readFileSync('index.html').toString();
  response.send(result);
});

app.get('/dashboard', function(request, response) {
  response.render('dashboard');
});

var port = process.env.PORT || 8080;
app.listen(port, function() {
  console.log("Listening on " + port);
});

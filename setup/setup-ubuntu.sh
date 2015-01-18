# Install git
sudo apt-get install git-core

# Install node
sudo apt-get install -y python-software-properties python g++ make
sudo add-apt-repository ppa:chris-lea/node.js
sudo apt-get update
sudo apt-get install -y nodejs
node --version
npm --version

# Clone our app
git clone https://github.com/johnnyBravo/bitstarter.git

# Install Heroku
wget -q0- https://toolbelt.heroku.com/install-ubuntu.sh | sh

# Add heroku git remote
heroku git:remote -a intervyouer-integ

# Whenever any code changes need to be pushed to heroku
git push heroku master

# Have .env file stored in your app

# Locally start app
foreman start web
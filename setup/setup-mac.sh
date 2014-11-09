#!/bin/bash
# Simple setup.sh for configuring Mac OS Instance
# for headless setup.


# Install brew from this link http://brew.sh/

# Install nvm: node-version manager
brew install -y git
brew install -y curl
brew install npm
npm install nvm

# Install jshint to allow checking of JS code within emacs
# http://jshint.com/
npm install -g jshint

# Install rlwrap to provide libreadline features with node
# See: http://nodejs.org/api/repl.html#repl_repl
brew install -y rlwrap

# Install Heroku toolbelt
https://toolbelt.heroku.com/osx



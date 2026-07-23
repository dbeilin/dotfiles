#!/bin/sh

echo "Setting up Mac..."

# Check for Homebrew and install if we don't have it
if test ! $(which brew); then
  echo "Installing Homebrew..."
  /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
  
  echo 'eval "$(/opt/homebrew/bin/brew shellenv)"' >> $HOME/.zshrc
  eval "$(/opt/homebrew/bin/brew shellenv)"
else
  echo "Homebrew already installed"
fi

# Update Homebrew recipes
echo "Updating Homebrew..."
brew update

# Install all our dependencies with bundle (See Brewfile)
echo "Installing Homebrew packages..."
brew tap homebrew/bundle
brew bundle --file ./Brewfile

# Install Pi. Its tracked configuration is linked into ~/.pi by `stow .`.
echo "Installing Pi..."
npm install -g --ignore-scripts @earendil-works/pi-coding-agent

echo "Setup complete! Run 'stow .' and then restart your terminal or run 'source ~/.zshrc'"

# Set macOS preferences - we will run this last because this will reload the shell
echo "Applying macOS preferences..."
source ./.macos

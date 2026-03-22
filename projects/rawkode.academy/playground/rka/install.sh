#!/bin/bash
# install.sh - Downloaded from https://get.rawkode.academy

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Helper functions
info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1" >&2
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Detect platform and architecture
PLATFORM=$(uname -s | tr '[:upper:]' '[:lower:]')
ARCH=$(uname -m)

# Map arch names
case $ARCH in
    x86_64) ARCH="amd64" ;;
    aarch64|arm64) ARCH="arm64" ;;
    *) 
        error "Unsupported architecture: $ARCH"
        exit 1
        ;;
esac

# Map platform names
case $PLATFORM in
    darwin) PLATFORM="darwin" ;;
    linux) PLATFORM="linux" ;;
    mingw*|msys*|cygwin*) PLATFORM="windows" ;;
    *)
        error "Unsupported platform: $PLATFORM"
        exit 1
        ;;
esac

info "Detected platform: $PLATFORM-$ARCH"

# Check for required commands
check_command() {
    if ! command -v "$1" &> /dev/null; then
        error "$1 is required but not installed"
        exit 1
    fi
}

check_command curl

# Determine installation directory
if [ -n "$RKA_INSTALL_DIR" ]; then
    INSTALL_DIR="$RKA_INSTALL_DIR"
elif [ "$EUID" -eq 0 ]; then
    INSTALL_DIR="/usr/local/bin"
else
    INSTALL_DIR="$HOME/.local/bin"
fi

# Create install directory if it doesn't exist
if [ ! -d "$INSTALL_DIR" ]; then
    info "Creating installation directory: $INSTALL_DIR"
    mkdir -p "$INSTALL_DIR"
fi

# Download binary
BINARY_NAME="rka"
if [ "$PLATFORM" = "windows" ]; then
    BINARY_NAME="rka.exe"
fi

DOWNLOAD_URL="https://releases.rawkode.academy/rka/latest/rka-${PLATFORM}-${ARCH}"
if [ "$PLATFORM" = "windows" ]; then
    DOWNLOAD_URL="${DOWNLOAD_URL}.exe"
fi

info "Downloading RKA from $DOWNLOAD_URL"

TEMP_FILE=$(mktemp)
if ! curl -sSL "$DOWNLOAD_URL" -o "$TEMP_FILE"; then
    error "Failed to download RKA"
    rm -f "$TEMP_FILE"
    exit 1
fi

# Make binary executable
chmod +x "$TEMP_FILE"

# Move to installation directory
TARGET_PATH="$INSTALL_DIR/$BINARY_NAME"
info "Installing to $TARGET_PATH"

if [ "$EUID" -eq 0 ] || [ -w "$INSTALL_DIR" ]; then
    mv "$TEMP_FILE" "$TARGET_PATH"
else
    warning "Elevated permissions required to install to $INSTALL_DIR"
    sudo mv "$TEMP_FILE" "$TARGET_PATH"
fi

# Setup shell completions
setup_completions() {
    local shell="$1"
    local completion_dir="$2"
    local completion_file="$3"
    
    if [ -d "$completion_dir" ]; then
        info "Installing $shell completions"
        if "$TARGET_PATH" completion "$shell" > "$completion_file" 2>/dev/null; then
            info "$shell completions installed"
        else
            warning "Failed to generate $shell completions"
        fi
    fi
}

# Bash completions
if [ -n "$BASH_VERSION" ]; then
    if [ -d "/etc/bash_completion.d" ] && [ "$EUID" -eq 0 ]; then
        setup_completions bash "/etc/bash_completion.d" "/etc/bash_completion.d/rka"
    elif [ -d "$HOME/.local/share/bash-completion/completions" ]; then
        setup_completions bash "$HOME/.local/share/bash-completion/completions" "$HOME/.local/share/bash-completion/completions/rka"
    fi
fi

# Zsh completions
if command -v zsh &> /dev/null; then
    if [ -d "/usr/local/share/zsh/site-functions" ] && [ "$EUID" -eq 0 ]; then
        setup_completions zsh "/usr/local/share/zsh/site-functions" "/usr/local/share/zsh/site-functions/_rka"
    elif [ -d "$HOME/.zsh/completions" ]; then
        setup_completions zsh "$HOME/.zsh/completions" "$HOME/.zsh/completions/_rka"
    fi
fi

# Fish completions
if command -v fish &> /dev/null; then
    FISH_COMPLETION_DIR="$HOME/.config/fish/completions"
    if [ -d "$FISH_COMPLETION_DIR" ]; then
        setup_completions fish "$FISH_COMPLETION_DIR" "$FISH_COMPLETION_DIR/rka.fish"
    fi
fi

# Check if install directory is in PATH
if ! echo "$PATH" | grep -q "$INSTALL_DIR"; then
    warning "$INSTALL_DIR is not in your PATH"
    echo ""
    echo "Add the following to your shell configuration file:"
    echo ""
    echo "  export PATH=\"$INSTALL_DIR:\$PATH\""
    echo ""
fi

# Success message
echo ""
info "${GREEN}RKA installed successfully!${NC}"
echo ""
echo "To get started:"
echo "  1. Run 'rka doctor' to check system compatibility"
echo "  2. Run 'rka list' to see available courses"
echo "  3. Run 'rka start <course-id>' to start learning!"
echo ""
echo "For more information, visit: https://rawkode.academy"
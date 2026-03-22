# RKA - Rawkode Academy CLI

RKA is a command-line tool for managing local playground environments for Rawkode Academy courses. It provides an easy way to spin up pre-configured learning environments on your local machine.

## Features

- 🚀 Quick setup of learning environments
- 🐳 Multiple VM providers (Lima, Docker)
- 🔧 Automatic dependency installation via cloud-init
- 🌐 Web-based terminal access via Teleport
- 📊 Resource management and monitoring
- 🔍 System compatibility checks

## Installation

### Quick Install

```bash
curl -sSL https://get.rawkode.academy | bash
```

### Manual Installation

Download the appropriate binary for your platform from the [releases page](https://github.com/rawkode-academy/rka/releases) and add it to your PATH.

## Usage

### Check System Compatibility

```bash
rka doctor
```

### List Available Courses

```bash
rka list
```

### Start a Playground

```bash
rka start kubernetes-101
```

### Access the Playground

Once started, access your playground at http://localhost:3080

### Stop a Playground

```bash
# Stop but keep the VM
rka stop --keep

# Stop and destroy the VM
rka stop
```

### Execute Commands

```bash
# Run a command in the playground
rka exec kubectl get nodes

# Start an interactive shell
rka exec -i bash
```

### View Logs

```bash
rka logs -n 100
```

## Requirements

- **CPU**: Minimum 2 cores (4+ recommended)
- **Memory**: Minimum 4GB RAM (8GB+ recommended)
- **Disk**: 20GB+ free space
- **OS**: Linux, macOS, or Windows
- **VM Provider**: Lima or Docker

## VM Providers

RKA supports multiple VM providers:

- **Lima** (Recommended for macOS): Provides full VM isolation
- **Docker**: Lighter weight but with some limitations

The CLI will automatically detect and use the best available provider.

## Development

### Building from Source

```bash
# Clone the repository
git clone https://github.com/rawkode-academy/rka
cd rka

# Build the project
cargo build --release

# Run tests
cargo test

# Install locally
cargo install --path .
```

### Running Tests

```bash
# Unit tests
cargo test

# Integration tests
cargo test --test '*'

# With coverage
cargo tarpaulin
```

## Configuration

RKA can be configured via environment variables:

- `RKA_API_ENDPOINT`: Override the default API endpoint
- `RKA_INSTALL_DIR`: Custom installation directory

## Troubleshooting

### "No VM provider found"

Install either Lima or Docker:

```bash
# macOS
brew install lima

# Linux/macOS/Windows
# Install Docker from https://docker.com
```

### "Rate limit exceeded"

RKA limits playground creation to 5 per hour. Wait and try again later.

### Port conflicts

If ports 3080, 8080, 8443, or 6443 are in use, stop the conflicting services or use `rka destroy` to clean up existing playgrounds.

## License

MIT License - see [LICENSE](LICENSE) for details.
# ADR-002: Use Charm Tools for CLI Development

Date: 2024-01-07

## Status

Proposed

## Context

ForgePoint needs a command-line interface for validating schemas, checking references, and browsing product definitions. We need to decide on the CLI framework and user experience approach.

We considered several options:
1. Cobra - Traditional CLI framework, widely used
2. urfave/cli - Simple and straightforward
3. Charm stack (Fang + Bubbletea) - Modern TUI approach
4. Plain Go with flag package

## Decision

We will use the Charm tool stack:
- **Fang** for CLI command structure
- **Bubbletea** for interactive TUI components
- **Lipgloss** for terminal styling
- **Bubbles** for common UI components

## Consequences

### Positive
- Modern, delightful user experience
- Interactive validation with immediate feedback
- Beautiful terminal output with proper styling
- Keyboard-driven navigation for power users
- Progressive enhancement (works in basic terminals too)
- Active community and good documentation
- Consistent with modern CLI tools (gh, lazygit)

### Negative
- Larger dependency footprint
- Learning curve for TUI programming model
- More complex than simple CLI tools
- May be overkill for simple validation
- Requires more testing (UI interactions)

### Neutral
- Need to design both CLI and TUI modes
- Must handle terminal capability detection
- Color output needs to be configurable

## Example

```go
// Interactive validation with live feedback
type validateModel struct {
    files    []string
    errors   []ValidationError
    selected int
}

func (m validateModel) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
    switch msg := msg.(type) {
    case tea.KeyMsg:
        switch msg.String() {
        case "up", "k":
            m.selected--
        case "down", "j":
            m.selected++
        case "enter":
            return m, showErrorDetail(m.errors[m.selected])
        }
    }
    return m, nil
}
```

This approach prioritizes developer experience and makes ForgePoint a joy to use.
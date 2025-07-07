# ADR-001: Use CUE for Schema Definition and Validation

Date: 2024-01-06

## Status

Accepted

## Context

ForgePoint needs a way to define schemas for product artifacts (personas, stories, etc.) that provides:
- Type safety and validation
- Human readability
- Git-friendly text format
- Ability to import/export data
- Support for complex relationships

We considered several options:
1. YAML with JSON Schema
2. Plain JSON
3. TOML
4. CUE

## Decision

We will use CUE (Configure, Unify, Execute) for all schema definitions and data files.

## Consequences

### Positive
- Strong type system with inheritance and composition
- Built-in validation without separate schema files
- Can import CUE definitions across files/packages
- Excellent for configuration and data modeling
- Can export to JSON/YAML for integrations
- Comments and documentation in schema

### Negative
- Learning curve for teams unfamiliar with CUE
- Smaller ecosystem compared to JSON Schema
- Requires CUE tooling to be installed
- Limited IDE support compared to JSON/YAML

### Neutral
- Files use `.cue` extension
- Need to establish CUE conventions for the team
- May need to build custom tooling for some operations

## Example

```cue
#UserStory: {
    id:       string & =~"^story-[a-z0-9-]+$"
    title:    string & =~"^.{1,200}$"
    priority: "must" | "should" | "could" | "wont"
    size:     "XS" | "S" | "M" | "L" | "XL" | null
}
```

This provides validation, documentation, and type safety in a single definition.
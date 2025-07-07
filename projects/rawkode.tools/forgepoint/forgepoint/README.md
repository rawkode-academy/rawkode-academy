# ForgePoint

ForgePoint is a Git-based product evolution system that uses CUE for schema validation and story mapping for product planning.

## What is ForgePoint?

ForgePoint helps product teams:
- Track product capabilities and evolution in Git
- Maintain a living story map of user journeys
- Plan features with clear dependencies
- Separate permanent product decisions from ephemeral task tracking

## Core Concepts

### Story Map
The foundation of ForgePoint is the user story map, which consists of:
- **Personas**: Types of users with specific goals
- **Activities**: Major steps in the user journey
- **Actions**: What users do within activities
- **Stories**: Units of value delivery (As a... I want... So that...)
- **Features**: Enhancements to existing stories

### What Lives in Git
- Product capabilities (what exists and what could exist)
- User stories and feature definitions
- Dependencies for roadmap planning
- Architectural Decision Records (ADRs)
- Personas and their goals

### What Lives in Your Database
- Tasks and implementation details
- Defects and bugs
- Current status and assignments
- Sprint/iteration planning
- Time tracking

## Directory Structure

```
forgepoint/
├── README.md               # This file
├── map.cue                # Story map overview
├── personas/              # User personas
├── activities/            # User journey steps
│   └── {activity}/
│       ├── activity.cue
│       └── actions/       # What users do
├── adrs/                  # Architecture decisions
└── schema/                # CUE type definitions
```

## Getting Started

1. Define your personas in `personas/`
2. Map user activities in `activities/`
3. Break down activities into actions
4. Write user stories for each action
5. Track dependencies and plan releases

## Example

See ForgePoint planning itself in this directory for a complete example of the system in use.

## Integration

ForgePoint data can be:
- Validated using CUE
- Visualized as story maps or Gantt charts
- Exported to project management tools
- Used to generate documentation

## Philosophy

ForgePoint believes that:
- Product evolution should be tracked like code
- User journeys drive feature development
- Permanent decisions belong in Git
- Transient details belong in databases
- Story mapping keeps teams user-focused
# CURRENT.md - ForgePoint Project Status

## Mission

ForgePoint is building the next generation of Rawkode Academy - a cloud-native education platform that combines high-quality technical content with an engaged community. Our mission is to create a modern, user-centric platform that makes learning cloud-native technologies accessible, engaging, and community-driven.

## Where We Are Now

### Architecture Migration ✅
We've successfully migrated from Next.js to Astro, establishing a solid foundation with:
- **Static Site Generation** for optimal performance
- **Content Collections** for structured content management
- **MDX Support** for rich, interactive content
- **TypeScript** throughout for type safety

### Design System Implementation ✅
We've implemented a Linear.app-inspired design system featuring:
- **Dark Theme UI** with consistent styling
- **AppLayout Component** providing unified navigation
- **Command Palette (Cmd+K)** for quick navigation
- **Keyboard Navigation** throughout the application
- **Smooth Animations** and transitions

### Content Model & Schema ✅
Our content architecture is built around:
- **Personas**: Learner, Host, Guest, Contributor, Moderator
- **Activities**: User journeys and workflows
- **Stories**: User stories following agile methodology
- **Actions**: Atomic user interactions
- **Features**: Platform capabilities
- **PRDs & ADRs**: Product and architecture documentation

All content types have proper TypeScript schemas and cross-references.

### Interactive Story Map 🚀
The crown jewel of our current implementation:
- **Visual Story Mapping** using tldraw for interactive canvas
- **Drag-to-Connect** functionality for linking stories to features
- **Story Creation Modal** with Linear-style UI
- **Real-time Collaboration** capabilities (in development mode)
- **API Integration** for content management

### Current Technical Stack
- **Framework**: Astro 5.12.0
- **UI Library**: React (for interactive components)
- **Styling**: Tailwind CSS
- **Visualization**: tldraw (for story map)
- **Build Tool**: Bun
- **Linting/Formatting**: Biome

## Next Steps

### Immediate Priorities
1. **Delete Functionality** - Add ability to remove items from story map
2. **Zoom/Pan Controls** - Improve navigation for large story maps
3. **Story Editing** - Modal for editing existing stories
4. **Bulk Operations** - Select and operate on multiple items

### Medium-term Goals
1. **Authentication & Authorization** - User accounts and permissions
2. **Real-time Collaboration** - Multiple users on the story map
3. **Export Functionality** - Export story maps to various formats
4. **Integration with GitHub** - Sync stories with GitHub issues

### Long-term Vision
1. **AI-Powered Suggestions** - Smart story recommendations
2. **Analytics Dashboard** - Track learning progress and engagement
3. **Community Features** - Forums, discussions, and knowledge sharing
4. **Course Builder** - Create structured learning paths

## Development Guidelines

### Key Principles
- **User Experience First** - Every feature should enhance the learning experience
- **Community-Driven** - Build with and for the community
- **Performance Matters** - Keep the platform fast and responsive
- **Accessibility** - Ensure everyone can use the platform

### Development Workflow
1. All changes go through PR review
2. Run `bun run biome format` and `bun run biome lint` before committing
3. Build must pass (`bun run build`)
4. Follow conventional commits format
5. Update CLAUDE.md for AI assistant context when needed

## Getting Help

- **Documentation**: Check `/content/adrs/` for architectural decisions
- **AI Assistant**: Use Gemini (`gemini -p "question"`) for quick help
- **Story Map**: Visit `/story-map` to visualize the project roadmap

## Recent Achievements

- ✅ Fixed critical story map rendering issue (richText API update)
- ✅ Implemented story creation modal with full form validation
- ✅ Added drag-to-connect for story-to-feature relationships
- ✅ Established consistent UI patterns across all pages
- ✅ Created comprehensive content model with proper references

---

*Last Updated: July 2025*
*Status: Active Development*
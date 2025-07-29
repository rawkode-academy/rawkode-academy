# Rawkode Studio

An Astro-based website with a custom component library built on Radix UI and Tailwind CSS.

## 🧞 Commands

| Command         | Action                                      |
| :-------------- | :------------------------------------------ |
| `bun install`   | Install dependencies                        |
| `bun dev`       | Start dev server at `localhost:4321`        |
| `bun build`     | Build for production to `./dist/`           |
| `bun preview`   | Preview production build                    |

## 🎨 Component Library

Built with:
- **Radix UI** - Unstyled, accessible component primitives
- **Tailwind CSS v4** - Utility-first CSS with CSS variables
- **TypeScript** - Type safety
- **CVA** - Component variant management

### Using Components

```tsx
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'

// Components use design tokens from global.css
<Button variant="primary" size="lg">
  Click me
</Button>
```

## 📁 Import Aliases

The project uses `@/` as an alias for the `src/` directory:

```tsx
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
```
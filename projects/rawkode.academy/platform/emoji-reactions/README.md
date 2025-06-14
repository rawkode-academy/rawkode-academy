# Emoji Reactions Service

This service allows learners to add emoji reactions to content on the Rawkode Academy platform.

## Features

- Add emoji reactions to videos, episodes, and other content types
- Remove emoji reactions
- Query for emoji reactions on content
- Check if a user has reacted with a specific emoji
- Get top emoji reactions across content types

## Data Model

The service stores emoji reactions with the following fields:
- `contentId`: ID of the content being reacted to (generic, works with any content type)
- `personId`: ID of the person adding the reaction
- `emoji`: The emoji used for the reaction
- `reactedAt`: Timestamp when the reaction was added
- `contentTimestamp`: Optional position within video/audio content (in seconds)

## GraphQL Schema

The service extends the existing Video and Episode types to include:

- `emojiReactions`: List of emoji reactions with counts
- `hasReacted`: Boolean indicating if a user has reacted with a specific emoji

It also provides mutations:
- `addEmojiReaction`: Add a new emoji reaction
- `removeEmojiReaction`: Remove an existing emoji reaction

And queries:
- `getTopEmojiReactions`: Get the most popular emoji reactions across all content
- `getEmojiReactionsForContent`: Get emoji reactions for specific content

## Development

```bash
# Install dependencies
npm install

# Generate migrations
npm run generate-migrations

# Run migrations
npm run migrate

# Start development server
npm run dev

# Deploy
npm run deploy

# Publish schema
npm run publish-schema
```
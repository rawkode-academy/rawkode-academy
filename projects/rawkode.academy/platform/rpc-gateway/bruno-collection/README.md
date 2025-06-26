# RPC Gateway Bruno Collection

This Bruno collection provides API documentation and testing for the Rawkode Academy RPC Gateway service.

## Prerequisites

1. Install [Bruno](https://www.usebruno.com/) API client
2. Clone this repository
3. Open the collection in Bruno

## Environment Setup

The collection includes two environments:

- **local**: For local development (http://localhost:8787)
- **production**: For production deployment

### Configuring Your PAT

1. Open Bruno and navigate to the environment settings
2. Update the `pat` variable with your Personal Access Token from Zitadel
3. Ensure your PAT has the `platform-rpc` role

## Available Endpoints

### Health & Discovery
- **Health Check**: Check service health status
- **List Services**: Get available services and their supported methods

### Casting Credits
- **Create Casting Credit**: Link a person to a video with a specific role

### Error Examples
Examples of various error responses for testing and debugging

### Future Services
Examples of planned CRUD operations for other services (not yet implemented)

## Authentication

All RPC endpoints require authentication using a Personal Access Token (PAT) with the `platform-rpc` role.

Add your PAT to the Bearer token in the Authorization header:
```
Authorization: Bearer YOUR_PAT_HERE
```

## Testing

1. Start with the Health Check to ensure the service is running
2. Test authentication with the Create Casting Credit endpoint
3. Use the Error Examples to understand different failure scenarios
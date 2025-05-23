# Realtime Chat Server

A simple WebSocket-based chat server for real-time communication.

## Features

- WebSocket-based real-time messaging
- CORS support for cross-origin requests
- Simple REST API endpoint
- Ready for deployment on Render

## Local Development

1. Install dependencies:
```bash
npm install
```

2. Start the server:
```bash
npm start
```

The server will run on port 10000 (or the PORT environment variable).

## Deployment to Render

This project is configured for easy deployment to Render. Follow these steps:

### 1. Fork or Use This Repository
- Repository URL: https://github.com/gentacupoftea/realtime-chat-server

### 2. Create a New Web Service on Render
1. Go to [Render Dashboard](https://dashboard.render.com/)
2. Click "New +" → "Web Service"
3. Connect your GitHub account if not already connected
4. Select the `realtime-chat-server` repository
5. Configure the service:
   - **Name**: `realtime-chat-server` (or your preferred name)
   - **Region**: Choose the closest to your users
   - **Branch**: `main`
   - **Root Directory**: Leave empty (uses repository root)
   - **Runtime**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Instance Type**: Free (or your preferred tier)

### 3. Environment Variables
No additional environment variables are required. The server uses:
- `PORT`: Automatically set by Render
- CORS is configured to accept all origins (`*`)

### 4. Deploy
Click "Create Web Service" and Render will:
1. Clone your repository
2. Install dependencies
3. Start your server
4. Provide you with a public URL

### 5. Your Server URL
After deployment, your server will be available at:
```
https://[your-service-name].onrender.com
```

### 6. WebSocket Connection
Connect to your WebSocket server using:
```javascript
const ws = new WebSocket('wss://[your-service-name].onrender.com');
```

## API Endpoints

- `GET /` - Health check endpoint (returns "Chat server is running!")
- WebSocket endpoint: `wss://[your-domain]/`

## render.yaml Configuration

The project includes a `render.yaml` file for Infrastructure as Code deployment:

```yaml
services:
  - type: web
    name: realtime-chat-server
    runtime: node
    buildCommand: npm install
    startCommand: npm start
    envVars:
      - key: NODE_ENV
        value: production
```

## Troubleshooting

1. **WebSocket connection fails**: Ensure you're using `wss://` (not `ws://`) for secure connections
2. **CORS issues**: The server is configured to accept all origins. For production, consider restricting this
3. **Port issues**: Render automatically assigns a port via the PORT environment variable

## License

MIT
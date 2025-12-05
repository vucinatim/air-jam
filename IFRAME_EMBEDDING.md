# Iframe Embedding Configuration

For games to work properly when embedded in the Air Jam Platform, they need to allow iframe embedding.

## Development (Vite)

The `vite.config.ts` is already configured with:
```typescript
headers: {
  "Content-Security-Policy": "frame-ancestors *;",
}
```

This allows the game to be embedded in iframes from any origin during development.

## Production Deployment

When deploying games to production, you need to configure your hosting platform to set the appropriate headers.

### Vercel

Add a `vercel.json` file to your game project:
```json
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "Content-Security-Policy",
          "value": "frame-ancestors *;"
        }
      ]
    }
  ]
}
```

### Netlify

Add a `_headers` file in your `public` folder:
```
/*
  Content-Security-Policy: frame-ancestors *;
```

### Other Platforms

Set the HTTP header:
- **Key**: `Content-Security-Policy`
- **Value**: `frame-ancestors *;`

This allows your game to be embedded in iframes from any origin (including the Air Jam Platform).

## Security Note

Using `frame-ancestors *` allows embedding from any origin. For better security in production, you could restrict it to specific domains:
```
Content-Security-Policy: frame-ancestors https://your-platform-domain.com;
```

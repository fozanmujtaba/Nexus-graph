# SSL Certificates

This directory should contain your SSL certificates for production:

- `cert.pem` - SSL certificate
- `key.pem` - SSL private key

## For Development

For local development, you can generate self-signed certificates:

```bash
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout key.pem -out cert.pem \
  -subj "/C=US/ST=State/L=City/O=Organization/CN=localhost"
```

## For Production

Use Let's Encrypt or another CA to generate valid certificates.

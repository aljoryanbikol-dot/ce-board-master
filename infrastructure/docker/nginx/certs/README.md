# TLS certificates
Place production certs here (gitignored):
- `fullchain.pem` — full certificate chain
- `privkey.pem`   — private key

Obtain via Let's Encrypt (certbot) or your CA. For managed deploys (Vercel /
Cloudflare / ALB) TLS is terminated upstream and nginx is not used.

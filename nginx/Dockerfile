# =============================================================================
# Thena — Nginx Dockerfile
# Based on nginx:alpine for minimal image size
# =============================================================================

FROM nginx:1.27-alpine

# Remove the default nginx configuration
RUN rm /etc/nginx/conf.d/default.conf

# Copy our custom nginx configuration
COPY nginx.conf /etc/nginx/nginx.conf

# Create directory for Let's Encrypt ACME challenge
RUN mkdir -p /var/www/certbot

# Expose HTTP and HTTPS ports
EXPOSE 80 443

# Nginx runs in foreground by default in the official image
CMD ["nginx", "-g", "daemon off;"]

#!/bin/bash

# Generate self-signed SSL certificates for local development

CERT_DIR="./certs"
DOMAIN="myapp.local"

# Create certs directory
mkdir -p "$CERT_DIR"

# Generate private key
openssl genrsa -out "$CERT_DIR/privkey.pem" 2048

# Create certificate signing request config
cat > "$CERT_DIR/openssl.cnf" << EOF
[req]
default_bits = 2048
prompt = no
default_md = sha256
distinguished_name = dn
req_extensions = v3_req

[dn]
C=US
ST=State
L=City
O=Organization
OU=Development
CN=*.myapp.local

[v3_req]
subjectAltName = @alt_names

[alt_names]
DNS.1 = myapp.local
DNS.2 = *.myapp.local
DNS.3 = app.myapp.local
DNS.4 = admin.myapp.local
EOF

# Generate certificate signing request
openssl req -new -key "$CERT_DIR/privkey.pem" -out "$CERT_DIR/cert.csr" -config "$CERT_DIR/openssl.cnf"

# Generate self-signed certificate (valid for 365 days)
openssl x509 -req -days 365 -in "$CERT_DIR/cert.csr" -signkey "$CERT_DIR/privkey.pem" -out "$CERT_DIR/fullchain.pem" -extensions v3_req -extfile "$CERT_DIR/openssl.cnf"

echo "✅ SSL certificates generated in $CERT_DIR/"
echo "⚠️  Note: You'll need to trust these certificates in your browser"
echo ""
echo "To trust the certificate:"
echo "  macOS: sudo security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain $CERT_DIR/fullchain.pem"
echo "  Linux: sudo cp $CERT_DIR/fullchain.pem /usr/local/share/ca-certificates/myapp.local.crt && sudo update-ca-certificates"
echo "  Windows: Import $CERT_DIR/fullchain.pem into 'Trusted Root Certification Authorities'"

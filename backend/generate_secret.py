import secrets

def generate_jwt_secret():
    # Generate a secure 32-byte hex string (64 characters)
    secret = secrets.token_hex(32)
    print(f"Generated JWT Secret: {secret}")
    return secret

if __name__ == "__main__":
    generate_jwt_secret()

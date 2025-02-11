import requests

# Step 1: Create a wallet
response = requests.get(url="https://pumpportal.fun/api/create-wallet")

# JSON with keys for a newly generated wallet and the linked API key
data = response.json()

# Extract wallet address and API key
wallet_address = data.get('wallet_address')
api_key = data.get('api_key')

# Check if wallet address and API key were successfully retrieved
if wallet_address and api_key:
    print(f"Wallet Address: {wallet_address}")
    print(f"API Key: {api_key}")
    
    # Step 2: Fund the wallet
    fund_response = requests.post(
        url="https://pumpportal.fun/api/fund-wallet",
        headers={"Authorization": f"Bearer {api_key}"},
        json={"wallet_address": wallet_address, "amount": 1000}  # Example amount to fund
    )
    
    # Check if the funding was successful
    if fund_response.status_code == 200:
        fund_data = fund_response.json()
        print(f"Funding successful: {fund_data}")
    else:
        print(f"Failed to fund wallet: {fund_response.text}")
else:
    print("Failed to create wallet.")
import requests

url = "https://api.callstaticrpc.com/pumpfun/v1"

payload = {}
headers = {
  'Accept': 'application/json',
  'Authorization': 'Bearer 8bee4987-f4c2-492b-86d1-226e67286a7a'
}

response = requests.request("GET", url, headers=headers, data=payload)

print(response.text)
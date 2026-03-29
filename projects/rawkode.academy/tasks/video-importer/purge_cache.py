import os, requests

cf_token = os.environ.get('CLOUDFLARE_API_TOKEN')
cf_zone = os.environ.get('CLOUDFLARE_ZONE_ID')

cuids = [
    'qhc6jajwhi2ul563ncovdrg9',
    'bx2e90jd6p1u2pkvgj1wo6b7',
    's7mhnkw81wdgfe5tc4a2ky18',
    'h1qevuz6tezzpolx3afeo0r2',
    'c94kkvztdlqc5vvil0c91p95',
    'twq63ce7cr33d3nn6olb2aa2',
]

if not cf_token or not cf_zone:
    # Try purging by URL instead
    print("No CF credentials, trying prefix purge...")

urls = []
for cuid in cuids:
    urls.append(f"https://content.rawkode.academy/videos/{cuid}/stream.m3u8")

resp = requests.post(
    f"https://api.cloudflare.com/client/v4/zones/{cf_zone}/purge_cache",
    headers={
        'Authorization': f'Bearer {cf_token}',
        'Content-Type': 'application/json',
    },
    json={'files': urls}
)
print(f"Status: {resp.status_code}")
print(resp.json())

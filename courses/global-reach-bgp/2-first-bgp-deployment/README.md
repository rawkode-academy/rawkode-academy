# First BGP Deployment

In this workshop, we're going to deploy an NGINX server to two metros within the Equinix Metal network.

In-order to following along with this workshop, you need an [Equinix Metal](https://rawkode.academy/metal) account. Use the code "rawkode" when signing up to claim your 200USD FREE credits.

**There's a video of this workshop being completed. If you get stuck, or just want to follow along, you can find it [here](https://www.youtube.com/watch?v=U2tVTlbUE6w).**

## Getting a Global IP

The first thing we need to do is reserve an IPv4 Global IP from Equinix.

- Browse to the [Equinix Console](https://console.equinix.com)
- Select "IPs & Networks -> IPs" from the main menu
- Select "Reserve IP Addresses" button
- Select "Global IPv4"
- Select quantity of 1
- Submit request

## Deploying the Servers

Next up, deploy two Ubuntu servers to the metros of your choice. I'll be using London and Sydney.

- Select "Servers -> OnDemand" from the main menu
- Configure two servers
  - Select metro (remember to use two different, far apart metros)
  - Select instance size (c3.small if available)
  - Select Ubuntu
  - Deploy now

## Advertising our IP with bird

Repeat these steps for each server:

- SSH to your server
  - You can find the IP addresses (and root passwords) from the servers page on the main menu
  - Update `apt` database with `apt update`
  - Install `bird` and `nginx` with `apt install bird nginx`
  - Install `python` so we can leverage the `network-helpers` provided by Equinix: `apt install python3.6 python3-pip git`

### Configure the Interface

Make sure you swap `x.x.x.x` with your Global IPv4 address.

```shell
cat >>/etc/network/interfaces <<EOF
auto lo:0
iface lo:0 inet static
  address x.x.x.x
  netmask 255.255.255.255
EOF

ifup lo:0
```

### Fetching BGP Config

In-order to advertise our IPv4 address within the Equinix network, we need to find out where the top of rack switches are. This is made available to you via the Equinix Metadata service.

```shell
curl https://metadata.platformequinix.com/metadata \
    | jq '.bgp_neighbors[0] | { customer_ip: .customer_ip, customer_as: .customer_as, multihop: .multihop, peer_ips: .peer_ips, peer_as: .peer_as }'
```

We'll also need the ensure we have the appropriate routes in our routing table for the IBX gateway. Remember to substitute `x.x.x.x` and `.x.x.x.z` with your peer IPs from the command above. They'll likely be `169.254.255.1` and `169.254.255.2`, though this could change at anytime.

```shell
curl https://metadata.platformequinix.com/metadata \
    | jq -r '.network.addresses[] | select(.public == true and .address_family == 4) | { gateway: .gateway }'

ip route add x.x.x.x via ${GATEWAY_IP}
ip route add x.x.x.z via ${GATEWAY_IP}
```

### Configuring Bird

Equinix provide some helpers so you don't need to manually configure bird yourself, so lets fetch them and run them.

```shell
cd /opt
git clone https://github.com/packethost/network-helpers.git
cd network-helpers
pip3 install jmespath
pip3 install -e .
./configure.py -r bird | tee /etc/bird/bird.conf
systemctl restart bird
```

## Testing it Works

You can open a bird console with `birdc` and run the query `show protocols all neighbor_v4_1` to see if we're successfully advertising our Global IPv4 address with BGP correctly.

```shell
bird


bird> show protocols all neighbor_v4_1
```

Once you've deployed both servers, you can test the latency from multiple regions to ensure its routed correctly.

You can use an online service like [locaping](https://locaping.com/traceroute) or test it manually with `traceroute`. Remember to substitute `x.x.x.x` for your Global IPv4 address.

```shell
traceroute x.x.x.x
```

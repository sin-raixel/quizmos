import type { Question } from "./types";

// Shared by the tests.
export const question = (over: Partial<Question> = {}): Question => ({
  kind: "def",
  q: "Question?",
  options: ["A", "B", "C"],
  answer: 0,
  why: "",
  front: "Front",
  back: "Back",
  ...over,
});

// Clean, glossary-style notes: 12 definitions plus ordinary sentences that mention the terms.
export const SAMPLE_NOTES = `Networking Basics

A network is a group of connected devices that can share data and resources.
A router is a device that forwards data packets between different networks.
A switch is a device that connects devices within the same network and forwards data using MAC addresses.
An IP address is a unique number that identifies a device on a network.
A protocol is a set of rules that defines how data is sent and received over a network.
DNS: translates domain names such as example.com into IP addresses that computers can use.
DHCP: automatically assigns IP addresses to devices when they join a network.
A firewall is a security system that monitors and filters network traffic based on rules.
Bandwidth is the maximum amount of data that can travel across a network connection in a given time.
Latency is the delay between sending a request and receiving a response across the network.
A packet is a small unit of data that travels across a network from a source to a destination.
HTTP is a protocol that web browsers use to request pages from web servers.

When you open a website, your computer asks a DNS server for the IP address of the site.
The router then forwards each packet toward the web server through several networks.
A firewall can block packets that do not follow the rules set by the network administrator.
High latency makes video calls feel slow, even when the bandwidth of the connection is large.
Every device on a network needs a unique IP address so that packets reach the right destination.
A protocol such as HTTP defines how the browser and the web server talk to each other.
`;

// Notes with headings: two sections that talk about different things.
export const SECTIONED_NOTES = `# Networking Hardware

A router is a device that forwards data packets between different networks.
A switch is a device that connects devices within the same network and forwards data using MAC addresses.
A firewall is a security system that monitors and filters network traffic based on rules.
A modem is a device that converts digital data into signals that travel over phone or cable lines.
The router then forwards each packet toward the web server through several networks.

# Network Protocols

HTTP is a protocol that web browsers use to request pages from web servers.
DNS: translates domain names such as example.com into IP addresses that computers can use.
DHCP: automatically assigns IP addresses to devices when they join a network.
FTP is a protocol that transfers files between a client and a server over a network.
A protocol such as HTTP defines how the browser and the web server talk to each other.
`;

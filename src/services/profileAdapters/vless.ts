import type { ConnectionProfile, VlessDetails } from '../../types';
import { buildBaseProfile, type ParseContext, parsePort } from './common';

export function parseVlessLink(link: string, context: ParseContext): ConnectionProfile {
  const url = new URL(link);
  const details: VlessDetails = {
    uuid: decodeURIComponent(url.username),
    flow: url.searchParams.get('flow') ?? undefined,
    encryption: url.searchParams.get('encryption') ?? 'none',
    transportType: (url.searchParams.get('type') as VlessDetails['transportType']) ?? 'tcp',
    host: url.searchParams.get('host') ?? undefined,
    path: url.searchParams.get('path') ?? undefined,
    serviceName: url.searchParams.get('serviceName') ?? undefined,
    tlsEnabled: (url.searchParams.get('security') ?? 'none') !== 'none',
    tlsServerName: url.searchParams.get('sni') ?? url.hostname,
    tlsInsecure: url.searchParams.get('allowInsecure') === '1',
    fingerprint: url.searchParams.get('fp') ?? undefined,
    realityPublicKey: url.searchParams.get('pbk') ?? undefined,
    realityShortId: url.searchParams.get('sid') ?? undefined,
    realitySpiderX: url.searchParams.get('spx') ?? undefined,
    packetEncoding: (url.searchParams.get('packetEncoding') as VlessDetails['packetEncoding']) ?? 'xudp'
  };

  const name = decodeURIComponent(url.hash.replace(/^#/, '')) || `VLESS ${url.hostname}`;
  return buildBaseProfile({ name, protocol: 'vless', server: url.hostname, port: parsePort(url.port, 443), details, rawInput: link, context });
}

export function exportVlessLink(profile: ConnectionProfile): string {
  const details = profile.details as VlessDetails;
  const url = new URL(`vless://${encodeURIComponent(details.uuid)}@${profile.server}:${profile.port}`);
  const security = details.tlsEnabled ? (details.realityPublicKey ? 'reality' : 'tls') : 'none';
  url.searchParams.set('type', details.transportType ?? 'tcp');
  url.searchParams.set('security', security);
  url.searchParams.set('encryption', details.encryption ?? 'none');
  if (details.flow) url.searchParams.set('flow', details.flow);
  if (details.host) url.searchParams.set('host', details.host);
  if (details.path) url.searchParams.set('path', details.path);
  if (details.serviceName) url.searchParams.set('serviceName', details.serviceName);
  if (details.tlsServerName) url.searchParams.set('sni', details.tlsServerName);
  if (details.tlsInsecure) url.searchParams.set('allowInsecure', '1');
  if (details.fingerprint) url.searchParams.set('fp', details.fingerprint);
  if (details.realityPublicKey) url.searchParams.set('pbk', details.realityPublicKey);
  if (details.realityShortId) url.searchParams.set('sid', details.realityShortId);
  if (details.realitySpiderX) url.searchParams.set('spx', details.realitySpiderX);
  if (details.packetEncoding && details.packetEncoding !== 'none') url.searchParams.set('packetEncoding', details.packetEncoding);
  url.hash = encodeURIComponent(profile.name);
  return url.toString();
}

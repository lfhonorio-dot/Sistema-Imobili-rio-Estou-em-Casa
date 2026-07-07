// Feed XML no padrão VRSync (ZAP+ / VivaReal / OLX) com os imóveis ativos.
// URL pública protegida por token determinístico (HMAC do workspace) — sem
// estado extra e sem expor dados de outros workspaces.

import { Injectable, ForbiddenException } from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';

const PROPERTY_TYPE_MAP: Record<string, string> = {
  APARTMENT: 'Residential / Apartment',
  HOUSE: 'Residential / Home',
  COMMERCIAL: 'Commercial / Building',
  LAND: 'Residential / Land Lot',
  WAREHOUSE: 'Commercial / Industrial',
  LAUNCH: 'Residential / Apartment',
  RURAL: 'Residential / Farm Ranch',
};

function esc(v: unknown): string {
  return String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function cdata(v: unknown): string {
  return `<![CDATA[${String(v ?? '').replace(/\]\]>/g, ']]]]><![CDATA[>')}]]>`;
}

@Injectable()
export class PortalsFeedService {
  constructor(private prisma: PrismaService) {}

  // Token determinístico por workspace (rotaciona trocando o HMAC_SECRET)
  feedToken(workspaceId: string): string {
    const secret = process.env.HMAC_SECRET || 'homolog-hmac-secret';
    return crypto.createHmac('sha256', secret).update(`portal-feed:${workspaceId}`).digest('hex').slice(0, 32);
  }

  assertToken(workspaceId: string, token: string): void {
    const expected = this.feedToken(workspaceId);
    const a = Buffer.from(token.padEnd(32, '0').slice(0, 32));
    const b = Buffer.from(expected);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      throw new ForbiddenException('Token de feed inválido');
    }
  }

  // URL do feed para o usuário colar nos portais
  async getFeedUrl(workspaceId: string): Promise<{ url: string; token: string }> {
    const base = process.env.BACKEND_PUBLIC_URL || process.env.APP_URL || '';
    const token = this.feedToken(workspaceId);
    return {
      token,
      url: `${base}/api/v1/marketing/portals/feed/${workspaceId}/${token}.xml`,
    };
  }

  async buildVrsyncXml(workspaceId: string): Promise<string> {
    const [workspace, properties] = await Promise.all([
      this.prisma.workspace.findUnique({
        where: { id: workspaceId },
        select: { name: true },
      }),
      this.prisma.property.findMany({
        where: {
          workspaceId,
          deletedAt: null,
          status: { in: ['AVAILABLE', 'RESERVED'] },
        },
        include: { photos: { orderBy: { order: 'asc' }, select: { url: true, caption: true } } },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const listings = properties.map((p: any) => {
      const transactionType =
        p.purpose === 'SALE' ? 'For Sale' : p.purpose === 'RENTAL' ? 'For Rent' : 'Sale/Rent';
      const propertyType = PROPERTY_TYPE_MAP[p.type] ?? 'Residential / Home';
      const title = `${p.type === 'APARTMENT' ? 'Apartamento' : p.type === 'HOUSE' ? 'Casa' : 'Imóvel'}${
        p.bedrooms ? ` ${p.bedrooms} quartos` : ''
      }${p.neighborhood ? ` - ${p.neighborhood}` : ''}${p.city ? `, ${p.city}` : ''}`;

      const media = (p.photos ?? [])
        .map((ph: any) => `      <Item medium="image" caption="${esc(ph.caption ?? '')}">${esc(ph.url)}</Item>`)
        .join('\n');

      return `  <Listing>
    <ListingID>${esc(p.code)}</ListingID>
    <Title>${esc(title)}</Title>
    <TransactionType>${transactionType}</TransactionType>
    <Location displayAddress="Neighborhood">
      <Country abbreviation="BR">Brasil</Country>
      <State abbreviation="${esc(p.state ?? '')}">${esc(p.state ?? '')}</State>
      <City>${esc(p.city ?? '')}</City>
      <Neighborhood>${esc(p.neighborhood ?? '')}</Neighborhood>
      <Address>${esc(p.street ?? '')}</Address>
      <StreetNumber>${esc(p.number ?? '')}</StreetNumber>
      <PostalCode>${esc((p.zipCode ?? '').replace(/\D/g, ''))}</PostalCode>
    </Location>
    <Details>
      <PropertyType>${propertyType}</PropertyType>
      <Description>${cdata(p.description ?? title)}</Description>
${p.salePrice ? `      <ListPrice currency="BRL">${Math.round(Number(p.salePrice))}</ListPrice>\n` : ''}${
        p.rentalPrice ? `      <RentalPrice currency="BRL" period="Monthly">${Math.round(Number(p.rentalPrice))}</RentalPrice>\n` : ''
      }${p.condoMonthly ? `      <PropertyAdministrationFee currency="BRL">${Math.round(Number(p.condoMonthly))}</PropertyAdministrationFee>\n` : ''}${
        p.iptuMonthly ? `      <YearlyTax currency="BRL">${Math.round(Number(p.iptuMonthly) * 12)}</YearlyTax>\n` : ''
      }${p.totalArea ? `      <LivingArea unit="square metres">${Math.round(Number(p.totalArea))}</LivingArea>\n` : ''}${
        p.bedrooms != null ? `      <Bedrooms>${p.bedrooms}</Bedrooms>\n` : ''
      }${p.bathrooms != null ? `      <Bathrooms>${p.bathrooms}</Bathrooms>\n` : ''}${
        p.suites != null ? `      <Suites>${p.suites}</Suites>\n` : ''
      }${p.parkingSpaces != null ? `      <Garage type="Parking Space">${p.parkingSpaces}</Garage>\n` : ''}    </Details>
${media ? `    <Media>\n${media}\n    </Media>\n` : ''}  </Listing>`;
    });

    return `<?xml version="1.0" encoding="UTF-8"?>
<ListingDataFeed xmlns="http://www.vivareal.com/schemas/1.0/VRSync"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://www.vivareal.com/schemas/1.0/VRSync http://xml.vivareal.com/vrsync.xsd">
  <Header>
    <Provider>${esc(workspace?.name ?? 'Imobiliária')}</Provider>
    <Email>contato@estouemcasa.com.br</Email>
    <ContactName>${esc(workspace?.name ?? '')}</ContactName>
  </Header>
  <Listings>
${listings.join('\n')}
  </Listings>
</ListingDataFeed>`;
  }
}

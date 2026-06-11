import { IsString, IsEnum, IsArray, IsOptional } from 'class-validator';

export enum PortalType {
  ZAP = 'ZAP',
  VIVAREAL = 'VIVAREAL',
  OLX = 'OLX',
  IMOVELWEB = 'IMOVELWEB',
  I123 = 'I123',
}

export class SavePortalIntegrationDto {
  @IsEnum(PortalType) portal!: PortalType;
  @IsString() apiKey!: string;
}

export class PublishPropertyDto {
  @IsString() propertyId!: string;
  @IsArray() @IsEnum(PortalType, { each: true }) portals!: PortalType[];
}

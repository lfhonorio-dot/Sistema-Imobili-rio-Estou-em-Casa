// Card de imóvel para visualização em grid
'use client';

import Link from 'next/link';
import { Bath, Bed, Car, Maximize } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PropertyStatusBadge } from './property-status-badge';
import type { Property } from '@/hooks/use-properties';

const TYPE_LABELS: Record<string, string> = {
  APARTMENT: 'Apartamento',
  HOUSE: 'Casa',
  COMMERCIAL: 'Comercial',
  LAND: 'Terreno',
  WAREHOUSE: 'Galpão',
  LAUNCH: 'Lançamento',
  RURAL: 'Rural',
};

const PURPOSE_LABELS: Record<string, string> = {
  SALE: 'Venda',
  RENTAL: 'Aluguel',
  SALE_RENTAL: 'Venda/Aluguel',
};

interface PropertyCardProps {
  property: Property;
}

function formatCurrency(value: number | null | undefined) {
  if (!value) return null;
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

export function PropertyCard({ property }: PropertyCardProps) {
  const photo = property.photos?.[0];

  return (
    <Link href={`/properties/${property.id}`}>
      <Card className="overflow-hidden hover:shadow-md transition-shadow cursor-pointer">
        {/* Foto principal */}
        <div className="aspect-video bg-gray-100 relative">
          {photo ? (
            <img
              src={photo.url}
              alt={photo.caption ?? 'Foto do imóvel'}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-400 text-sm">
              Sem foto
            </div>
          )}
          <div className="absolute top-2 left-2 flex gap-1">
            <Badge variant="secondary" className="text-xs">
              {TYPE_LABELS[property.type] ?? property.type}
            </Badge>
            <Badge variant="outline" className="text-xs bg-white">
              {PURPOSE_LABELS[property.purpose] ?? property.purpose}
            </Badge>
          </div>
          <div className="absolute top-2 right-2">
            <PropertyStatusBadge status={property.status} />
          </div>
        </div>

        <CardContent className="p-3">
          {/* Endereço */}
          <p className="font-medium text-sm truncate">
            {property.street
              ? `${property.street}${property.number ? `, ${property.number}` : ''}`
              : 'Endereço não informado'}
          </p>
          <p className="text-xs text-muted-foreground truncate">
            {[property.neighborhood, property.city, property.state].filter(Boolean).join(' • ')}
          </p>

          {/* Preço */}
          <div className="mt-2">
            {property.salePrice && (
              <p className="font-semibold text-sm">{formatCurrency(property.salePrice)}</p>
            )}
            {property.rentalPrice && (
              <p className="text-sm text-muted-foreground">
                Aluguel: {formatCurrency(property.rentalPrice)}/mês
              </p>
            )}
          </div>

          {/* Características */}
          <div className="flex gap-3 mt-2 text-xs text-muted-foreground">
            {property.bedrooms != null && (
              <span className="flex items-center gap-1">
                <Bed className="w-3 h-3" />
                {property.bedrooms}
              </span>
            )}
            {property.bathrooms != null && (
              <span className="flex items-center gap-1">
                <Bath className="w-3 h-3" />
                {property.bathrooms}
              </span>
            )}
            {property.parkingSpaces != null && (
              <span className="flex items-center gap-1">
                <Car className="w-3 h-3" />
                {property.parkingSpaces}
              </span>
            )}
            {property.totalArea != null && (
              <span className="flex items-center gap-1">
                <Maximize className="w-3 h-3" />
                {property.totalArea}m²
              </span>
            )}
          </div>

          {/* Código */}
          <p className="text-xs text-muted-foreground mt-1">{property.code}</p>
        </CardContent>
      </Card>
    </Link>
  );
}
